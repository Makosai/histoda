<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	
	// Import helper components
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MetricsGrid from '$lib/components/MetricsGrid.svelte';
	import HistoricalChart from '$lib/components/HistoricalChart.svelte';
	
	// Import mock data types
	import type { Station, Earthquake, Conflict } from '$lib/mockData';

	// Props passed from SvelteKit page server load
	let { data }: { data: PageData } = $props();

	// Core State Runes
	type Domain = 'climate' | 'earthquakes' | 'conflicts';
	let activeDomain = $state<Domain>('climate');
	let searchQuery = $state('');
	let isCelsius = $state(true);

	// Selections
	let selectedStation = $state<Station>(data.stations[0]);
	let selectedEarthquake = $state<Earthquake>(data.earthquakes[0]);
	let selectedConflict = $state<Conflict>(data.conflicts[0]);

	// Year range filter controls
	let startYear = $state(1880);
	let endYear = $state(2026);

	// Domain view controls
	let viewMode = $state<'annual' | 'seasonal' | 'monthly'>('annual');
	let selectedSeason = $state<string>('all');
	let selectedMonth = $state<number>(0);
	
	let earthquakeViewMode = $state<'event' | 'global'>('event');
	let conflictViewMode = $state<'event' | 'global'>('event');
	
	// Chart state and local caching
	let rawWeatherData = $state<any[]>([]);
	let rawEarthquakeData = $state<any[]>([]);
	let rawConflictData = $state<any[]>([]);

	let isLoading = $state(false);
	let bookmarks = $state<string[]>([]);
	let hasMounted = $state(false);

	// Derived chartData updates reactively in the browser (user CPU)
	let chartData = $derived.by(() => {
		if (activeDomain === 'climate') {
			let filtered = rawWeatherData.filter((d) => d.year >= startYear && d.year <= endYear);
			if (viewMode === 'seasonal' && selectedSeason !== 'all') {
				filtered = filtered.filter((d) => d.season === selectedSeason);
			} else if (viewMode === 'monthly' && selectedMonth !== 0) {
				filtered = filtered.filter((d) => d.month === selectedMonth);
			}
			return filtered;
		} else if (activeDomain === 'earthquakes') {
			return rawEarthquakeData;
		} else if (activeDomain === 'conflicts') {
			return rawConflictData;
		}
		return [];
	});

	// Fetch weather dataset only when the selected station, active domain, or view changes
	async function loadClimateData() {
		isLoading = true;
		try {
			const res = await fetch(`/api/temperatures?station_id=${selectedStation.id}&view=${viewMode}`);
			const json = await res.json();
			rawWeatherData = json.data || [];
		} catch (e) {
			console.error('Failed to load climate dataset timeline', e);
		} finally {
			isLoading = false;
		}
	}

	// Fetch earthquake dataset
	async function loadEarthquakeData() {
		isLoading = true;
		try {
			const res = await fetch(`/api/earthquakes?event_id=${selectedEarthquake.id}&view=${earthquakeViewMode}`);
			const json = await res.json();
			rawEarthquakeData = json.data || [];
		} catch (e) {
			console.error('Failed to load earthquake dataset timeline', e);
		} finally {
			isLoading = false;
		}
	}

	// Fetch conflict dataset
	async function loadConflictData() {
		isLoading = true;
		try {
			const res = await fetch(`/api/conflicts?conflict_id=${selectedConflict.id}&view=${conflictViewMode}`);
			const json = await res.json();
			rawConflictData = json.data || [];
		} catch (e) {
			console.error('Failed to load conflict dataset timeline', e);
		} finally {
			isLoading = false;
		}
	}

	// Trigger load reactively based on active domain & parameters
	$effect(() => {
		if (activeDomain === 'climate') {
			const _stationId = selectedStation.id;
			const _viewMode = viewMode;
			loadClimateData();
		} else if (activeDomain === 'earthquakes') {
			const _eventId = selectedEarthquake.id;
			const _eqView = earthquakeViewMode;
			loadEarthquakeData();
		} else if (activeDomain === 'conflicts') {
			const _conflictId = selectedConflict.id;
			const _conflictView = conflictViewMode;
			loadConflictData();
		}
	});

	// Save temperature unit preference reactively after mount
	$effect(() => {
		if (hasMounted) {
			localStorage.setItem('histoda_temp_unit', String(isCelsius));
		}
	});

	onMount(() => {
		const savedBookmarks = localStorage.getItem('histoda_bookmarks');
		if (savedBookmarks) {
			try {
				bookmarks = JSON.parse(savedBookmarks);
			} catch (e) {
				console.error(e);
			}
		}
		const savedUnit = localStorage.getItem('histoda_temp_unit');
		if (savedUnit !== null) {
			isCelsius = savedUnit === 'true';
		}
		hasMounted = true;
	});

	// Export active data to CSV
	function exportToCSV() {
		if (chartData.length === 0) return;
		let headers: string[] = [];
		let rows: string[] = [];
		let filename = '';

		if (activeDomain === 'climate') {
			const suffix = isCelsius ? 'C' : 'F';
			const tempFormatter = (t: number) => isCelsius ? t : parseFloat(((t * 1.8) + 32).toFixed(2));
			const anomalyFormatter = (a: number) => isCelsius ? a : parseFloat((a * 1.8).toFixed(3));

			if (viewMode === 'seasonal') {
				headers = ['Year', 'Season', `GlobalAnomaly_${suffix}`, `LocalAvgTemp_${suffix}`];
				rows = chartData.map((d) => [d.year, d.season, anomalyFormatter(d.globalAnomaly), tempFormatter(d.tempAvg)].join(','));
				filename = `histoda_temp_seasonal_${selectedStation.id}.csv`;
			} else if (viewMode === 'monthly') {
				headers = ['Year', 'Month', `GlobalAnomaly_${suffix}`, `LocalAvgTemp_${suffix}`];
				rows = chartData.map((d) => [d.year, d.month, anomalyFormatter(d.globalAnomaly), tempFormatter(d.tempAvg)].join(','));
				filename = `histoda_temp_monthly_${selectedStation.id}.csv`;
			} else {
				headers = ['Year', `GlobalAnomaly_${suffix}`, `LocalAvgTemp_${suffix}`];
				rows = chartData.map((d) => [d.year, anomalyFormatter(d.globalAnomaly), tempFormatter(d.tempAvg)].join(','));
				filename = `histoda_temp_annual_${selectedStation.id}.csv`;
			}
		} else if (activeDomain === 'earthquakes') {
			headers = ['Year', 'PeakMagnitude', 'EventsCount'];
			rows = chartData.map((d) => [d.year, d.mag, d.frequency].join(','));
			filename = `histoda_seismic_${selectedEarthquake.id}.csv`;
		} else if (activeDomain === 'conflicts') {
			headers = ['Year', 'IntensityPercent', 'BattlesCount'];
			rows = chartData.map((d) => [d.year, d.intensity, d.battleCount].join(','));
			filename = `histoda_conflict_${selectedConflict.id}.csv`;
		}

		const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', filename);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="dashboard-wrapper animate-fade-in">
	<!-- Domain Switcher Toolbar -->
	<nav class="domain-switcher">
		<button 
			class="domain-tab" 
			class:active={activeDomain === 'climate'} 
			onclick={() => { activeDomain = 'climate'; searchQuery = ''; }}
		>
			🌡️ Climate & Temperatures
		</button>
		<button 
			class="domain-tab" 
			class:active={activeDomain === 'earthquakes'} 
			onclick={() => { activeDomain = 'earthquakes'; searchQuery = ''; }}
		>
			🌋 Seismic & Earthquakes
		</button>
		<button 
			class="domain-tab" 
			class:active={activeDomain === 'conflicts'} 
			onclick={() => { activeDomain = 'conflicts'; searchQuery = ''; }}
		>
			⚔️ Wars & Conflicts
		</button>
	</nav>

	<div class="main-layout">
		<!-- Sidebar Controls Component -->
		<Sidebar 
			{activeDomain}
			stations={data.stations}
			earthquakes={data.earthquakes}
			conflicts={data.conflicts}
			bind:isCelsius
			bind:searchQuery
			bind:selectedStation
			bind:selectedEarthquake
			bind:selectedConflict
			bind:bookmarks
			{earthquakeViewMode}
			{conflictViewMode}
		/>

		<!-- Content Panel -->
		<main class="content-panel">
			<!-- Selected Header Card -->
			<div class="panel-header">
				<div class="title-wrap">
					{#if activeDomain === 'climate'}
						<h2>{selectedStation.name}</h2>
						<p class="subtitle">{selectedStation.country} — Lat: {selectedStation.latitude}° | Long: {selectedStation.longitude}° | Elev: {selectedStation.elevation}m</p>
					{:else if activeDomain === 'earthquakes'}
						{#if earthquakeViewMode === 'global'}
							<h2>Global Seismic Trends</h2>
							<p class="subtitle">Visualizing 2.9 million earthquakes over the past 140 years (1880 - 2026)</p>
						{:else}
							<h2>{selectedEarthquake.name}</h2>
							<p class="subtitle">{selectedEarthquake.country} — Year: {selectedEarthquake.year} | Magnitude: {selectedEarthquake.magnitude} Mw | Depth: {selectedEarthquake.depth} km</p>
						{/if}
					{:else if activeDomain === 'conflicts'}
						{#if conflictViewMode === 'global'}
							<h2>Century Conflict Timeline</h2>
							<p class="subtitle">Visualizing active wars and casualties over the past century (1920 - 2026)</p>
						{:else}
							<h2>{selectedConflict.name}</h2>
							<p class="subtitle">{selectedConflict.region} — Span: {selectedConflict.startYear} - {selectedConflict.endYear} | Duration: {selectedConflict.duration}</p>
						{/if}
					{/if}
				</div>
				<div class="export-wrap">
					<button class="action-btn outline" onclick={exportToCSV}>
						🗂️ Export CSV
					</button>
				</div>
			</div>

			<!-- Metrics Grid Component -->
			<MetricsGrid 
				{activeDomain}
				{isCelsius}
				stats={data.stats}
				{selectedEarthquake}
				{selectedConflict}
			/>

			<!-- Visual ECharts Chart Component -->
			<HistoricalChart 
				{activeDomain}
				{chartData}
				{isLoading}
				{isCelsius}
				bind:startYear
				bind:endYear
				bind:viewMode
				bind:selectedSeason
				bind:selectedMonth
				bind:earthquakeViewMode
				bind:conflictViewMode
				{selectedEarthquake}
				{selectedConflict}
			/>
		</main>
	</div>
</div>

<style>
	/* Grid layout styles conforming to Vercel/Linear slate aesthetics */
	.dashboard-wrapper {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
		padding-bottom: 2rem;
	}

	/* Domain Switcher Toolbar */
	.domain-switcher {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 0.4rem;
		box-shadow: var(--shadow-sm);
	}

	.domain-tab {
		background: transparent;
		color: var(--text-secondary);
		border: none;
		border-radius: var(--radius-md);
		padding: 0.65rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
	}

	.domain-tab:hover {
		background: var(--bg-canvas);
		color: var(--text-primary);
	}

	.domain-tab.active {
		background: var(--color-accent-soft);
		color: var(--color-accent);
		box-shadow: inset 0 0 0 1px var(--color-accent-border);
	}

	/* Main Layout: gap reduced to 1.25rem */
	.main-layout {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.content-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.5rem;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1rem 1.25rem;
		box-shadow: var(--shadow-sm);
	}

	.title-wrap h2 {
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-top: 0.15rem;
	}

	.action-btn {
		background: var(--color-accent);
		color: #ffffff;
		border: none;
		border-radius: var(--radius-md);
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.action-btn:hover {
		background: var(--color-accent-hover);
	}

	.action-btn.outline {
		background: transparent;
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow-sm);
	}

	.action-btn.outline:hover {
		background: var(--bg-canvas);
		border-color: var(--border-color-hover);
	}

	@media (max-width: 1024px) {
		.main-layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.domain-switcher {
			grid-template-columns: 1fr;
		}
	}
</style>
