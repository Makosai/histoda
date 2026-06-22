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
	const initialStation = data.stations[0];
	const initialEarthquake = data.earthquakes[0];
	const initialConflict = data.conflicts[0];

	let selectedStation = $state<Station>(initialStation);
	let selectedEarthquake = $state<Earthquake>(initialEarthquake);
	let selectedConflict = $state<Conflict>(initialConflict);

	// Sync selections reactively if layout data updates
	$effect(() => {
		if (data.stations && selectedStation && !data.stations.some(s => s.id === selectedStation.id)) {
			selectedStation = data.stations[0];
		}
		if (data.earthquakes && selectedEarthquake && !data.earthquakes.some(e => e.id === selectedEarthquake.id)) {
			selectedEarthquake = data.earthquakes[0];
		}
		if (data.conflicts && selectedConflict && !data.conflicts.some(c => c.id === selectedConflict.id)) {
			selectedConflict = data.conflicts[0];
		}
	});

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
	let activeMethodologyTab = $state<'climate' | 'seismic' | 'conflicts' | 'completeness'>('climate');


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
</div>

{#if showMethodology}
	<div class="modal-backdrop" onclick={() => { showMethodology = false; }}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>🔬 Scientific Methodology & Data Provenance</h3>
				<button class="close-btn" onclick={() => { showMethodology = false; }}>&times;</button>
			</div>
			
			<div class="methodology-tabs">
				<button class="tab-pill" class:active={activeMethodologyTab === 'climate'} onclick={() => activeMethodologyTab = 'climate'}>🌡️ Climate</button>
				<button class="tab-pill" class:active={activeMethodologyTab === 'seismic'} onclick={() => activeMethodologyTab = 'seismic'}>🌋 Seismology</button>
				<button class="tab-pill" class:active={activeMethodologyTab === 'conflicts'} onclick={() => activeMethodologyTab = 'conflicts'}>⚔️ Conflicts</button>
				<button class="tab-pill" class:active={activeMethodologyTab === 'completeness'} onclick={() => activeMethodologyTab = 'completeness'}>⚠️ Completeness</button>
			</div>

			<div class="modal-body">
				{#if activeMethodologyTab === 'climate'}
					<div class="methodology-section animate-fade-in-quick">
						<p class="modal-intro">
							Histoda integrates verified meteorological database records with macro climate datasets and localized temperature approximation models.
						</p>

						<div class="metadata-grid">
							<div class="metadata-item">
								<strong>Primary Sources:</strong> 
								<span>NASA Goddard Institute for Space Studies (GISTEMP v4) & NOAA Global Historical Climatology Network (GHCN-Daily) archives.</span>
							</div>
							<div class="metadata-item">
								<strong>Reference Baseline:</strong>
								<span>Anomalies and local trends are calculated relative to the standard 1960–1990 global average temperature baseline: <code class="math-inline">T_baseline ≈ 14.0°C (57.2°F)</code>.</span>
							</div>
						</div>

						<div class="completeness-comparison">
							<div class="comparison-card have">
								<h5>🟢 Verified Data (ClickHouse)</h5>
								<ul>
									<li>Station metadata (coordinates, elevation, names)</li>
									<li>NASA GISTEMP global annual temperature anomalies</li>
									<li>Daily local weather station records from 1970 to 2026</li>
								</ul>
							</div>
							<div class="comparison-card miss">
								<h5>🔴 Modeled Gaps & Limitations</h5>
								<ul>
									<li>Pre-1970 localized station daily weather logs</li>
									<li>Secondary parameters (humidity, wind speed, solar radiation)</li>
								</ul>
							</div>
						</div>

						<div class="formula-block">
							<h5>Mathematical Formulations</h5>
							<div class="formula-item">
								<h6>Local Temperature Anomaly</h6>
								<code class="math-display">A_local(y, m) = T_avg(y, m) - T_baseline</code>
								<p>Calculates the deviation from the historic 1960–1990 climatological baseline.</p>
							</div>
							<div class="formula-item">
								<h6>Microclimate Sensitivity Correlation</h6>
								<code class="math-display">A_local(y) ≈ γ · A_global(y) + ε</code>
								<p>Relates local anomalies to global changes. The sensitivity factor <code class="math-inline">γ</code> ranges from 0.9 (e.g., Lagos, tropical thermal inertia) to 1.3 (e.g., New York, Tokyo, urban heat island/high-latitude).</p>
							</div>
							<div class="formula-item">
								<h6>Pre-1970 Fallback Temperature Curve</h6>
								<code class="math-display">T_avg(y, m) = T_base + [ (R/2) · sin((m-6)π/6) ] + (ΔA_global(y) · γ) + ε_noise</code>
								<p>Models baseline seasonal variations ($R$ = station temperature range, $m$ = month index 1–12) augmented by the long-term global warming trend.</p>
							</div>
						</div>
					</div>
				{:else if activeMethodologyTab === 'seismic'}
					<div class="methodology-section animate-fade-in-quick">
						<p class="modal-intro">
							Seismological visualizations combine official global epicenter catalogs with standard decay and magnitude frequency distribution equations.
						</p>

						<div class="metadata-grid">
							<div class="metadata-item">
								<strong>Primary Sources:</strong> 
								<span>USGS Advanced National Seismic System (ANSS) Comprehensive Earthquake Catalog (ComCat).</span>
							</div>
							<div class="metadata-item">
								<strong>Real-Time Sync:</strong>
								<span>A background sync daemon continuously queries the USGS API for global events of magnitude <code class="math-inline">M ≥ 6.0</code>.</span>
							</div>
						</div>

						<div class="completeness-comparison">
							<div class="comparison-card have">
								<h5>🟢 Verified Data (ClickHouse)</h5>
								<ul>
									<li>Main shock epicenters, magnitudes, depths, and casualty statistics</li>
									<li>Global yearly earthquake frequency statistics (1880–2026)</li>
								</ul>
							</div>
							<div class="comparison-card miss">
								<h5>🔴 Modeled Gaps & Limitations</h5>
								<ul>
									<li>Real-time query of high-resolution local aftershock chains directly via API (prevented by rate-limits and latency constraints)</li>
								</ul>
							</div>
						</div>

						<div class="formula-block">
							<h5>Mathematical Formulations</h5>
							<div class="formula-item">
								<h6>Aftershock Decay (Omori's Law)</h6>
								<code class="math-display">n(t) = k / (t + c)^p</code>
								<p>Models the exponential decay of aftershocks over time. <code class="math-inline">p = 1.0</code> is the decay exponent, <code class="math-inline">c = 0.1</code> represents a time-offset constant, and the productivity constant <code class="math-inline">k = 15 · 1.5^(M - 5.0)</code> scales exponentially with main shock magnitude <code class="math-inline">M</code>.</p>
							</div>
							<div class="formula-item">
								<h6>Magnitude Distribution (Gutenberg-Richter Law)</h6>
								<code class="math-display">log10 N(M) = a - bM</code>
								<p>Determines aftershock magnitude frequency. Standard scaling parameter <code class="math-inline">b = 1.0</code> is used. The sequence is bound between <code class="math-inline">M_min = 3.0</code> and <code class="math-inline">M_max = M_main - 1.0</code>.</p>
							</div>
						</div>
					</div>
				{:else if activeMethodologyTab === 'conflicts'}
					<div class="methodology-section animate-fade-in-quick">
						<p class="modal-intro">
							Conflict visualizations blend historical battle registries with mathematical progression curves.
						</p>

						<div class="metadata-grid">
							<div class="metadata-item">
								<strong>Primary Sources:</strong> 
								<span>Correlates of War (COW) Project (v5.0) & Uppsala Conflict Data Program (UCDP) Battle-Related Deaths Dataset.</span>
							</div>
						</div>

						<div class="completeness-comparison">
							<div class="comparison-card have">
								<h5>🟢 Verified Data (ClickHouse)</h5>
								<ul>
									<li>Verified start and end years, combatants, regions, and estimated total casualties</li>
									<li>Annual global active conflict counts and aggregate annual deaths (since 1920)</li>
								</ul>
							</div>
							<div class="comparison-card miss">
								<h5>🔴 Modeled Gaps & Limitations</h5>
								<ul>
									<li>Day-by-day battlefield coordinates, local troop movements</li>
									<li>Localized skirmishes and minor conflicts resulting in fewer than 1,000 casualties</li>
								</ul>
							</div>
						</div>

						<div class="formula-block">
							<h5>Mathematical Formulations</h5>
							<div class="formula-item">
								<h6>Conflict Intensity Curve</h6>
								<code class="math-display">I(p) = 40 + 50 · sin(p · π) + 10 · cos(y · 5)</code>
								<p>Simulates conflict intensity progression. The parameter <code class="math-inline">p = (y - y_start) / (y_end - y_start)</code> is the progress fraction ($0 \le p \le 1$).</p>
							</div>
							<div class="formula-item">
								<h6>Daily Battle Count Estimate</h6>
								<code class="math-display">B(t) = ⌊ I(t) / 3 ⌋ + η</code>
								<p>Estimates battle occurrences over the timeline, where <code class="math-inline">η</code> represents random skirmish noise modeling minor engagements during peace or low engagement.</p>
							</div>
						</div>
					</div>
				{:else if activeMethodologyTab === 'completeness'}
					<div class="methodology-section animate-fade-in-quick">
						<p class="modal-intro">
							This dashboard is designed to provide visual timelines and historical context. It is essential to distinguish between peer-reviewed historical records and mathematical models.
						</p>

						<div class="scientific-disclaimer" style="margin-top: 0;">
							<p><strong>⚠️ Scientific Disclaimer:</strong> While macro-level metadata (spans of wars, total casualties, climate station coordinates, earthquake locations, and main shock magnitudes) represents accurate, peer-reviewed historical records, high-resolution daily timeline parameters (e.g. local battle intensity index, daily aftershock counts, pre-1970 weather records) are mathematically simulated to project timeline trends where granular data is unavailable.</p>
						</div>

						<div class="completeness-guide">
							<h5>How to Interpret the Dashboard Data</h5>
							<div class="guide-item">
								<span class="badge badge-clickhouse">🟢 ClickHouse</span>
								<p>Denotes that the active timeline query is fully populated by peer-reviewed datasets stored directly in the database.</p>
							</div>
							<div class="guide-item">
								<span class="badge badge-mock">🟡 Simulated</span>
								<p>Denotes that the active timeline contains mathematical simulations or seasonal/statistical extrapolations due to historical data gaps.</p>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

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
		overflow: hidden; /* Prevent content scrollbar from clipping outer rounded corners */
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

	/* Segmented Pill Tabs Navigation */
	.methodology-tabs {
		display: flex;
		background: var(--bg-canvas);
		border-bottom: 1px solid var(--border-color);
		padding: 0.4rem 1.25rem;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: none; /* Hide scrollbar for tabs on small screens */
	}
	.methodology-tabs::-webkit-scrollbar {
		display: none;
	}

	.tab-pill {
		background: transparent;
		color: var(--text-secondary);
		border: none;
		border-radius: var(--radius-md);
		padding: 0.45rem 0.75rem;
		font-size: 0.775rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
		display: flex;
		align-items: center;
		gap: 0.35rem;
		white-space: nowrap;
	}

	.tab-pill:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.05);
	}

	.tab-pill.active {
		background: var(--color-accent-soft);
		color: var(--color-accent);
		box-shadow: inset 0 0 0 1px var(--color-accent-border);
		font-weight: 600;
	}

	.modal-body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		text-align: left;
		overflow-y: auto; /* Enable scrolling exclusively inside the body */
		flex: 1;
	}

	.methodology-section {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.methodology-section h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.section-intro {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
		line-height: 1.45;
	}

	/* Metadata block grid styling */
	.metadata-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		background: var(--bg-canvas);
		border: 1px solid var(--border-color);
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
	}

	.metadata-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.725rem;
	}

	.metadata-item strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	.metadata-item span {
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* Have vs Miss comparison layout */
	.completeness-comparison {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	@media (max-width: 520px) {
		.completeness-comparison {
			grid-template-columns: 1fr;
		}
	}

	.comparison-card {
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-color);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.comparison-card.have {
		background: rgba(16, 185, 129, 0.02);
		border-color: rgba(16, 185, 129, 0.12);
	}

	.comparison-card.miss {
		background: rgba(239, 68, 68, 0.02);
		border-color: rgba(239, 68, 68, 0.12);
	}

	.comparison-card h5 {
		margin: 0;
		font-size: 0.775rem;
		font-weight: 600;
	}

	.comparison-card.have h5 {
		color: rgb(16, 185, 129);
	}

	.comparison-card.miss h5 {
		color: rgb(239, 68, 68);
	}

	.comparison-card ul {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.725rem;
		color: var(--text-secondary);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		line-height: 1.4;
	}

	/* Formula container styling */
	.formula-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.formula-block h5 {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.formula-item {
		background: var(--bg-canvas);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.formula-item h6 {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.math-display {
		font-family: monospace;
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.15);
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-sm);
		color: var(--color-accent);
		overflow-x: auto;
		display: block;
		white-space: pre-wrap;
		border: 1px solid var(--border-color);
	}

	.math-inline {
		font-family: monospace;
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.15);
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
		color: var(--color-accent);
		border: 1px solid var(--border-color);
	}

	.formula-item p {
		margin: 0;
		font-size: 0.7rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	/* Scientific disclaimer block */
	.scientific-disclaimer {
		background: rgba(239, 68, 68, 0.04);
		border: 1px solid rgba(239, 68, 68, 0.12);
		padding: 0.85rem 1rem;
		border-radius: var(--radius-md);
	}

	.scientific-disclaimer p {
		margin: 0;
		font-size: 0.725rem;
		color: #ef4444;
		line-height: 1.45;
	}

	/* Completeness guide legends */
	.completeness-guide {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: var(--bg-canvas);
		border: 1px solid var(--border-color);
		padding: 1rem;
		border-radius: var(--radius-md);
	}

	.completeness-guide h5 {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.guide-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.badge {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.2rem 0.4rem;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.badge-clickhouse {
		background: rgba(16, 185, 129, 0.08);
		color: rgb(16, 185, 129);
		border: 1px solid rgba(16, 185, 129, 0.16);
	}

	.badge-mock {
		background: rgba(245, 158, 11, 0.08);
		color: rgb(245, 158, 11);
		border: 1px solid rgba(245, 158, 11, 0.16);
	}

	.guide-item p {
		margin: 0;
		font-size: 0.725rem;
		color: var(--text-secondary);
		line-height: 1.45;
	}

	.modal-intro {
		font-size: 0.8rem;
		color: var(--text-secondary);
		line-height: 1.45;
		margin: 0;
	}

	.animate-fade-in-quick {
		animation: fadeInQuick 0.15s ease-out;
	}

	@keyframes fadeInQuick {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
