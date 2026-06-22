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
	let earthquakeSubMode = $state<'decay' | 'trend'>('decay');
	let conflictViewMode = $state<'event' | 'global'>('event');
	
	// Chart state and local caching
	let rawWeatherData = $state<any[]>([]);
	let rawEarthquakeData = $state<any[]>([]);
	let rawConflictData = $state<any[]>([]);

	let isLoading = $state(false);
	let bookmarks = $state<string[]>([]);
	let hasMounted = $state(false);
	let showMethodology = $state(false);

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

	// DataSource tracker runes
	let weatherDataSource = $state<'clickhouse' | 'mock' | 'loading'>('loading');
	let earthquakeDataSource = $state<'clickhouse' | 'mock' | 'loading'>('loading');
	let conflictDataSource = $state<'clickhouse' | 'mock' | 'loading'>('loading');

	let currentDataSource = $derived.by(() => {
		if (activeDomain === 'climate') return weatherDataSource;
		if (activeDomain === 'earthquakes') return earthquakeDataSource;
		if (activeDomain === 'conflicts') return conflictDataSource;
		return 'loading';
	});

	// Client-side caches to prevent duplicate network requests (maps keys to { data, source })
	const climateCache = new Map<string, { data: any[]; source: 'clickhouse' | 'mock' }>();
	const earthquakeCache = new Map<string, { data: any[]; source: 'clickhouse' | 'mock' }>();
	const conflictCache = new Map<string, { data: any[]; source: 'clickhouse' | 'mock' }>();

	// Fetch weather dataset only when the selected station, active domain, or view changes
	async function loadClimateData() {
		if (!selectedStation) return;
		const cacheKey = `${selectedStation.id}_${viewMode}`;
		if (climateCache.has(cacheKey)) {
			const cached = climateCache.get(cacheKey)!;
			rawWeatherData = cached.data;
			weatherDataSource = cached.source;
			return;
		}
		isLoading = true;
		try {
			const res = await fetch(`/api/temperatures?station_id=${selectedStation.id}&view=${viewMode}`);
			const json = await res.json();
			const data = json.data || [];
			const source = json.source || (data.length > 0 && data[0].diagnostics ? 'mock' : 'clickhouse');
			climateCache.set(cacheKey, { data, source });
			rawWeatherData = data;
			weatherDataSource = source;
		} catch (e) {
			console.error('Failed to load climate dataset timeline', e);
			weatherDataSource = 'mock';
		} finally {
			isLoading = false;
		}
	}

	// Fetch earthquake dataset
	async function loadEarthquakeData() {
		if (!selectedEarthquake) return;
		const cacheKey = `${selectedEarthquake.id}_${earthquakeViewMode}_${earthquakeSubMode}`;
		if (earthquakeCache.has(cacheKey)) {
			const cached = earthquakeCache.get(cacheKey)!;
			rawEarthquakeData = cached.data;
			earthquakeDataSource = cached.source;
			return;
		}
		isLoading = true;
		try {
			const res = await fetch(`/api/earthquakes?event_id=${selectedEarthquake.id}&view=${earthquakeViewMode}&subtype=${earthquakeSubMode}`);
			const json = await res.json();
			const data = json.data || [];
			const source = json.source || 'mock';
			earthquakeCache.set(cacheKey, { data, source });
			rawEarthquakeData = data;
			earthquakeDataSource = source;
		} catch (e) {
			console.error('Failed to load earthquake dataset timeline', e);
			earthquakeDataSource = 'mock';
		} finally {
			isLoading = false;
		}
	}

	// Fetch conflict dataset
	async function loadConflictData() {
		if (!selectedConflict) return;
		const cacheKey = `${selectedConflict.id}_${conflictViewMode}`;
		if (conflictCache.has(cacheKey)) {
			const cached = conflictCache.get(cacheKey)!;
			rawConflictData = cached.data;
			conflictDataSource = cached.source;
			return;
		}
		isLoading = true;
		try {
			const res = await fetch(`/api/conflicts?conflict_id=${selectedConflict.id}&view=${conflictViewMode}`);
			const json = await res.json();
			const data = json.data || [];
			const source = json.source || 'mock';
			conflictCache.set(cacheKey, { data, source });
			rawConflictData = data;
			conflictDataSource = source;
		} catch (e) {
			console.error('Failed to load conflict dataset timeline', e);
			conflictDataSource = 'mock';
		} finally {
			isLoading = false;
		}
	}

	// Trigger load reactively based on active domain & parameters
	$effect(() => {
		if (activeDomain === 'climate' && selectedStation) {
			const _stationId = selectedStation.id;
			const _viewMode = viewMode;
			loadClimateData();
		} else if (activeDomain === 'earthquakes' && selectedEarthquake) {
			const _eventId = selectedEarthquake.id;
			const _eqView = earthquakeViewMode;
			const _subMode = earthquakeSubMode;
			loadEarthquakeData();
		} else if (activeDomain === 'conflicts' && selectedConflict) {
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
				<div class="export-wrap" style="display: flex; gap: 0.5rem;">
					<button class="action-btn outline" onclick={() => { showMethodology = true; }}>
						🔬 Methodology
					</button>
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
				dataSource={currentDataSource}
				{chartData}
				{isLoading}
				{isCelsius}
				bind:startYear
				bind:endYear
				bind:viewMode
				bind:selectedSeason
				bind:selectedMonth
				bind:earthquakeViewMode
				bind:earthquakeSubMode
				bind:conflictViewMode
				{selectedEarthquake}
				{selectedConflict}
			/>
		</main>
	</div>

	{#if showMethodology}
		<div class="modal-backdrop" onclick={() => { showMethodology = false; }}>
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h3>🔬 Scientific Methodology & Data Provenance</h3>
					<button class="close-btn" onclick={() => { showMethodology = false; }}>&times;</button>
				</div>
				<div class="modal-body">
					<section class="methodology-section">
						<h4>🌡️ Climate & Temperatures</h4>
						<p><strong>Primary Source:</strong> NASA GISTEMP (Global Temperature Anomaly) & NOAA Global Historical Climatology Network (GHCN-Daily).</p>
						<p><strong>Baseline Reference:</strong> Anomalies are computed relative to the 1960–1990 global average temperature (~14.0°C / 57.2°F).</p>
						<p><strong>Formula:</strong> Anomaly = Local average temperature minus baseline reference temperature.</p>
					</section>

					<section class="methodology-section">
						<h4>🌋 Seismic & Earthquakes</h4>
						<p><strong>Primary Source:</strong> USGS ANSS Comprehensive Earthquake Catalog (ComCat) API.</p>
						<p><strong>Aftershock Decay:</strong> Modeled using **Omori's Law** for frequency decay:
							<code class="math">n(t) = k / (c + t)^p</code> (where <em>c = 0.1</em>, <em>p = 1.0</em>, and <em>k</em> scales exponentially with the main shock magnitude).
						</p>
						<p><strong>Magnitude Distribution:</strong> Modeled using the **Gutenberg-Richter Law**:
							<code class="math">log10(N) = a - bM</code> (with <em>b = 1.0</em> for standard seismic size scaling).
						</p>
					</section>

					<section class="methodology-section">
						<h4>⚔️ Wars & Conflicts</h4>
						<p><strong>Primary Source:</strong> Correlates of War (COW) Project & Uppsala Conflict Data Program (UCDP).</p>
						<p><strong>Conflict Intensity Curve:</strong> For individual events, battle intensity is modeled over the war's span using a bell-curve (sine wave) peaking at mid-conflict, supplemented with random skirmish noise:
							<code class="math">Intensity(p) = 40 + 50 * sin(p * &pi;) + CosNoise</code>
						</p>
						<p><strong>Global Timeline:</strong> Real active conflict counts and estimated annual casualties aggregated from historical database records.</p>
					</section>

					<div class="scientific-disclaimer">
						<p><strong>⚠️ Scientific Disclaimer:</strong> While macro-level metadata (war spans, total casualties, earthquake coordinates, climate station logs) represents accurate, peer-reviewed historical records, high-resolution daily timeline parameters (e.g. battle intensity index, daily aftershock counts) are mathematically simulated to project timeline trends where granular data is unavailable.</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
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

	/* Scientific Methodology Modal styles conforming to premium glassmorphism theme */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		width: 90%;
		max-width: 600px;
		max-height: 85vh;
		overflow-y: auto;
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		animation: modalSlide 0.2s ease-out;
	}

	@keyframes modalSlide {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.close-btn {
		background: transparent;
		border: none;
		font-size: 1.5rem;
		color: var(--text-secondary);
		cursor: pointer;
		line-height: 1;
		padding: 0;
	}

	.close-btn:hover {
		color: var(--text-primary);
	}

	.modal-body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		text-align: left;
	}

	.methodology-section {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.methodology-section h4 {
		margin: 0 0 0.25rem 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.methodology-section p {
		margin: 0;
		font-size: 0.775rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.math {
		background: var(--bg-canvas);
		padding: 0.15rem 0.35rem;
		border-radius: var(--radius-sm);
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--text-primary);
	}

	.scientific-disclaimer {
		background: rgba(239, 68, 68, 0.05);
		border: 1px solid rgba(239, 68, 68, 0.15);
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		margin-top: 0.5rem;
	}

	.scientific-disclaimer p {
		margin: 0;
		font-size: 0.725rem;
		color: #ef4444;
		line-height: 1.4;
	}
</style>
