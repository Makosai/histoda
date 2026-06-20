<script lang="ts">
	import { onMount } from "svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	// States
	let selectedStation = $derived(data.stations[0]);
	let startYear = $state(1880);
	let endYear = $state(2026);
	let chartData = $state<any[]>([]);
	let isLoading = $state(false);
	let bookmarks = $state<string[]>([]);
	let showImportExport = $state(false);
	let importText = $state("");

	// DOM reference for the ECharts canvas
	let chartDom: HTMLElement | null = $state(null);
	let chartInstance: any = null;

	// Derives
	let isBookmarked = $derived(bookmarks.includes(selectedStation.id));

	// Fetch temperature readings for the selected station
	async function fetchTemperatureData(
		stationId: string,
		start: number,
		end: number,
	) {
		isLoading = true;
		try {
			const res = await fetch(
				`/api/temperatures?station_id=${stationId}&start_year=${start}&end_year=${end}`,
			);
			const json = await res.json();
			chartData = json.data || [];
			if (chartInstance) {
				updateChart();
			}
		} catch (e) {
			console.error("Failed to fetch temperature data", e);
		} finally {
			isLoading = false;
		}
	}

	// Update the ECharts options with current state
	function updateChart() {
		if (!chartInstance || chartData.length === 0) return;

		const years = chartData.map((d) => d.year);
		const avgTemps = chartData.map((d) => d.tempAvg);
		const maxTemps = chartData.map((d) => d.tempMax);
		const minTemps = chartData.map((d) => d.tempMin);
		const anomalies = chartData.map((d) => d.globalAnomaly);

		const option = {
			tooltip: {
				trigger: "axis",
				backgroundColor: "#ffffff",
				borderColor: "#e4e4e7",
				borderWidth: 1,
				textStyle: {
					color: "#18181b",
					fontFamily: "Outfit",
				},
				formatter: function (params: any) {
					let year = params[0].name;
					let html = `<div style="padding: 4px 8px; font-family: Outfit;">
						<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">Year ${year}</div>`;
					params.forEach((param: any) => {
						const valueStr =
							param.value !== null ? `${param.value}°C` : "N/A";
						html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; font-size: 13px;">
							<span style="color: #71717a;">${param.seriesName}</span>
							<span style="font-weight: 500; color: ${param.color}">${valueStr}</span>
						</div>`;
					});
					html += "</div>";
					return html;
				},
			},
			legend: {
				data: ["Avg Temp", "Max Temp", "Min Temp", "Anomaly Anomaly"],
				selected: {
					"Avg Temp": true,
					"Max Temp": false,
					"Min Temp": false,
					"Anomaly Anomaly": true,
				},
				textStyle: {
					fontFamily: "Outfit",
					color: "#71717a",
				},
				bottom: 0,
			},
			grid: {
				left: "4%",
				right: "4%",
				top: "8%",
				bottom: "12%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				boundaryGap: false,
				data: years,
				axisLine: {
					lineStyle: {
						color: "#e4e4e7",
					},
				},
				axisLabel: {
					fontFamily: "Outfit",
					color: "#71717a",
				},
			},
			yAxis: [
				{
					type: "value",
					name: "Temperature (°C)",
					nameTextStyle: {
						fontFamily: "Outfit",
						color: "#71717a",
						padding: [0, 0, 0, 40],
					},
					splitLine: {
						lineStyle: {
							color: "#f4f4f5",
							type: "dashed",
						},
					},
					axisLabel: {
						fontFamily: "Outfit",
						color: "#71717a",
					},
				},
				{
					type: "value",
					name: "Global Anomaly (°C)",
					nameTextStyle: {
						fontFamily: "Outfit",
						color: "#71717a",
						padding: [0, 40, 0, 0],
					},
					splitLine: {
						show: false,
					},
					axisLabel: {
						fontFamily: "Outfit",
						color: "#71717a",
						formatter: "{value}°C",
					},
				},
			],
			series: [
				{
					name: "Avg Temp",
					type: "line",
					data: avgTemps,
					symbol: "none",
					smooth: true,
					lineStyle: {
						width: 2.5,
						color: "#4f46e5",
					},
					itemStyle: {
						color: "#4f46e5",
					},
				},
				{
					name: "Max Temp",
					type: "line",
					data: maxTemps,
					symbol: "none",
					smooth: true,
					lineStyle: {
						width: 1.5,
						type: "dashed",
						color: "#ef4444",
					},
					itemStyle: {
						color: "#ef4444",
					},
				},
				{
					name: "Min Temp",
					type: "line",
					data: minTemps,
					symbol: "none",
					smooth: true,
					lineStyle: {
						width: 1.5,
						type: "dashed",
						color: "#3b82f6",
					},
					itemStyle: {
						color: "#3b82f6",
					},
				},
				{
					name: "Anomaly Anomaly",
					type: "line",
					yAxisIndex: 1,
					data: anomalies,
					symbol: "none",
					smooth: true,
					lineStyle: {
						width: 2,
						color: "#f59e0b",
					},
					areaStyle: {
						color: {
							type: "linear",
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{
									offset: 0,
									color: "rgba(245, 158, 11, 0.15)",
								},
								{ offset: 1, color: "rgba(245, 158, 11, 0)" },
							],
						},
					},
					itemStyle: {
						color: "#f59e0b",
					},
				},
			],
		};

		chartInstance.setOption(option);
	}

	// Trigger data fetching on selection/filter adjustments
	$effect(() => {
		fetchTemperatureData(selectedStation.id, startYear, endYear);
	});

	onMount(() => {
		// Load bookmarks from local storage
		const savedBookmarks = localStorage.getItem("histoda_bookmarks");
		if (savedBookmarks) {
			try {
				bookmarks = JSON.parse(savedBookmarks);
			} catch (e) {
				console.error(e);
			}
		}

		// Dynamically import ECharts on client mount
		import("echarts").then((echarts) => {
			if (chartDom) {
				chartInstance = echarts.init(chartDom);
				updateChart();
			}
		});

		// Handle resize responsiveness
		const handleResize = () => {
			if (chartInstance) {
				chartInstance.resize();
			}
		};

		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
			if (chartInstance) {
				chartInstance.dispose();
			}
		};
	});

	// Bookmark toggling logic
	function toggleBookmark() {
		if (isBookmarked) {
			bookmarks = bookmarks.filter((id) => id !== selectedStation.id);
		} else {
			bookmarks = [...bookmarks, selectedStation.id];
		}
		localStorage.setItem("histoda_bookmarks", JSON.stringify(bookmarks));
	}

	// Export filtered temperature records to CSV
	function exportToCSV() {
		if (chartData.length === 0) return;
		const headers = [
			"Year",
			"GlobalAnomaly_C",
			"LocalAvgTemp_C",
			"LocalMaxTemp_C",
			"LocalMinTemp_C",
		];
		const rows = chartData.map((d) =>
			[d.year, d.globalAnomaly, d.tempAvg, d.tempMax, d.tempMin].join(
				",",
			),
		);
		const csvContent =
			"data:text/csv;charset=utf-8," +
			[headers.join(","), ...rows].join("\n");
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute(
			"download",
			`histoda_temp_${selectedStation.id}_${startYear}-${endYear}.csv`,
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// Export custom bookmarks and settings as JSON
	function exportCustomization() {
		const config = {
			version: "1.0",
			selectedStationId: selectedStation.id,
			yearRange: { start: startYear, end: endYear },
			bookmarks: bookmarks,
		};
		const dataStr =
			"data:text/json;charset=utf-8," +
			encodeURIComponent(JSON.stringify(config, null, 2));
		const link = document.createElement("a");
		link.setAttribute("href", dataStr);
		link.setAttribute("download", "histoda_customizations.json");
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// Import bookmarks and settings
	function importCustomization() {
		try {
			const parsed = JSON.parse(importText);
			if (parsed.bookmarks && Array.isArray(parsed.bookmarks)) {
				bookmarks = parsed.bookmarks;
				localStorage.setItem(
					"histoda_bookmarks",
					JSON.stringify(bookmarks),
				);
			}
			if (parsed.selectedStationId) {
				const match = data.stations.find(
					(s) => s.id === parsed.selectedStationId,
				);
				if (match) selectedStation = match;
			}
			if (parsed.yearRange) {
				if (parsed.yearRange.start) startYear = parsed.yearRange.start;
				if (parsed.yearRange.end) endYear = parsed.yearRange.end;
			}
			showImportExport = false;
			importText = "";
			alert("Settings imported successfully!");
		} catch (e) {
			alert("Failed to parse JSON. Please check your file format.");
		}
	}
</script>

<svelte:head>
	<title>Histoda — Historical Temperature Explorer</title>
</svelte:head>

<div class="dashboard-container animate-fade-in">
	<!-- Top Header Nav -->
	<header class="header">
		<div class="logo-area">
			<span class="logo-symbol">◆</span>
			<h1 class="logo-title">histoda</h1>
			<span class="logo-subtitle">historical analytics</span>
		</div>

		<div class="status-indicator">
			{#if data.isDbAvailable}
				<span class="status-dot online"></span>
				<span class="status-label">ClickHouse Connected</span>
			{:else}
				<span class="status-dot demo"></span>
				<span class="status-label">Sandbox Mode (Mock Active)</span>
			{/if}
		</div>
	</header>

	<div class="main-layout">
		<!-- Sidebar Station Selector -->
		<aside class="sidebar">
			<div class="section-header">
				<h2>Weather Stations</h2>
				<span class="station-count"
					>{data.stations.length} registered</span
				>
			</div>

			<div class="station-list">
				{#each data.stations as station}
					<button
						class="station-card"
						class:active={selectedStation.id === station.id}
						onclick={() => (selectedStation = station)}
					>
						<div class="station-card-header">
							<span class="station-name">{station.name}</span>
							{#if bookmarks.includes(station.id)}
								<span class="bookmark-badge">★</span>
							{/if}
						</div>
						<div class="station-card-details">
							<span>{station.country}</span>
							<span class="dot-separator">•</span>
							<span>{station.period}</span>
						</div>
					</button>
				{/each}
			</div>

			<!-- LocalStorage Bookmarks Details -->
			<div class="bookmarks-box">
				<div class="bookmarks-box-header">
					<h3>Current Station</h3>
					<button class="action-btn" onclick={toggleBookmark}>
						{isBookmarked ? "★ Bookmarked" : "☆ Add Bookmark"}
					</button>
				</div>

				<p class="bookmarks-desc">
					Saves the active station selection directly into your
					browser's LocalStorage.
				</p>
			</div>

			<!-- Customization Import/Export Panel -->
			<div class="customization-box">
				<h3>Share Customization</h3>
				<div class="custom-actions">
					<button class="sub-btn" onclick={exportCustomization}
						>Export Settings</button
					>
					<button
						class="sub-btn"
						onclick={() => (showImportExport = !showImportExport)}
						>Import Settings</button
					>
				</div>

				{#if showImportExport}
					<div class="import-area">
						<textarea
							placeholder="Paste JSON settings string here..."
							bind:value={importText}
						></textarea>
						<button class="action-btn" onclick={importCustomization}
							>Apply Import</button
						>
					</div>
				{/if}
			</div>
		</aside>

		<!-- Main Dashboard Content -->
		<main class="content-panel">
			<!-- Station Details & Statistics -->
			<div class="panel-header">
				<div class="title-wrap">
					<h2>{selectedStation.name}</h2>
					<p class="subtitle">
						{selectedStation.country} — Lat: {selectedStation.latitude}°
						| Long: {selectedStation.longitude}° | Elev: {selectedStation.elevation}m
					</p>
				</div>
				<div class="export-wrap">
					<button class="action-btn outline" onclick={exportToCSV}>
						🗂️ Export CSV
					</button>
				</div>
			</div>

			<!-- Dashboard Key Stats -->
			<div class="metrics-grid">
				<div class="metric-card">
					<span class="metric-label">Estimated Global Anomaly</span>
					<div class="metric-value-wrap">
						<span class="metric-value"
							>+{data.stats.globalAnomaly}°C</span
						>
						<span class="metric-sub-label text-red"
							>vs 1960–90 baseline</span
						>
					</div>
				</div>

				<div class="metric-card">
					<span class="metric-label">Hottest Year on Record</span>
					<div class="metric-value-wrap">
						<span class="metric-value"
							>{data.stats.hottestYear}</span
						>
						<span class="metric-sub-label"
							>Extreme anomaly cycle</span
						>
					</div>
				</div>

				<div class="metric-card">
					<span class="metric-label">Reporting Stations</span>
					<div class="metric-value-wrap">
						<span class="metric-value"
							>{data.stats.reportingStations.toLocaleString()}</span
						>
						<span class="metric-sub-label"
							>Global coverage network</span
						>
					</div>
				</div>

				<div class="metric-card">
					<span class="metric-label">Baseline Global Avg</span>
					<div class="metric-value-wrap">
						<span class="metric-value"
							>{data.stats.baselineTemp}°C</span
						>
						<span class="metric-sub-label"
							>Standard reference period</span
						>
					</div>
				</div>
			</div>

			<!-- Dynamic ECharts visualization -->
			<div class="chart-card">
				<div class="chart-header">
					<h3>Temperature & Climate Anomaly Trends (1880 - 2026)</h3>
					<div class="range-selectors">
						<div class="selector-group">
							<label for="start-year">From</label>
							<select id="start-year" bind:value={startYear}>
								{#each Array.from({ length: 147 }, (_, i) => 1880 + i) as year}
									{#if year < endYear}
										<option value={year}>{year}</option>
									{/if}
								{/each}
							</select>
						</div>

						<div class="selector-group">
							<label for="end-year">To</label>
							<select id="end-year" bind:value={endYear}>
								{#each Array.from({ length: 147 }, (_, i) => 1880 + i) as year}
									{#if year > startYear}
										<option value={year}>{year}</option>
									{/if}
								{/each}
							</select>
						</div>
					</div>
				</div>

				<div class="chart-body">
					{#if isLoading}
						<div class="chart-loading">
							<div class="spinner"></div>
							<span>Querying ClickHouse DB...</span>
						</div>
					{/if}
					<div bind:this={chartDom} class="echarts-container"></div>
				</div>
			</div>
		</main>
	</div>
</div>

<style>
	/* Styles conforming directly to Vercel/Linear slate aesthetics */
	.dashboard-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 1.5rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.logo-area {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.logo-symbol {
		color: var(--color-accent);
		font-size: 1.5rem;
		font-weight: 700;
	}

	.logo-title {
		font-size: 1.35rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		color: var(--text-primary);
	}

	.logo-subtitle {
		font-size: 0.8rem;
		color: var(--text-secondary);
		background-color: var(--border-color);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		font-weight: 500;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		box-shadow: var(--shadow-sm);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-dot.online {
		background-color: var(--color-success);
		box-shadow: 0 0 8px var(--color-success);
	}

	.status-dot.demo {
		background-color: var(--color-warning);
		box-shadow: 0 0 8px var(--color-warning);
	}

	.status-label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	/* Main Layout Structure */
	.main-layout {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 2rem;
		align-items: start;
	}

	/* Sidebar Elements */
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-header h2 {
		font-size: 0.95rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}

	.station-count {
		font-size: 0.75rem;
		color: var(--text-muted);
		background-color: var(--bg-card);
		border: 1px solid var(--border-color);
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-sm);
	}

	.station-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.station-card {
		text-align: left;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 0.85rem 1rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: var(--shadow-sm);
	}

	.station-card:hover {
		border-color: var(--border-color-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
	}

	.station-card.active {
		border-color: var(--color-accent-border);
		background-color: var(--color-accent-soft);
		box-shadow: 0 0 0 1px var(--color-accent);
	}

	.station-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.station-name {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.station-card.active .station-name {
		color: var(--color-accent);
	}

	.bookmark-badge {
		color: var(--color-warning);
		font-size: 0.85rem;
	}

	.station-card-details {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.dot-separator {
		color: var(--text-muted);
	}

	/* Bookmarks Box & Customizations */
	.bookmarks-box,
	.customization-box {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bookmarks-box h3,
	.customization-box h3 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.bookmarks-box-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.bookmarks-desc {
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.custom-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.import-area {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.import-area textarea {
		width: 100%;
		height: 60px;
		font-size: 0.7rem;
		font-family: monospace;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.4rem;
		resize: none;
		outline: none;
	}

	.import-area textarea:focus {
		border-color: var(--color-accent);
	}

	/* Buttons & Controls */
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

	.sub-btn {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 0.35rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.sub-btn:hover {
		background: var(--bg-canvas);
		color: var(--text-primary);
		border-color: var(--border-color-hover);
	}

	/* Content Area */
	.content-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.5rem;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.25rem 1.5rem;
		box-shadow: var(--shadow-sm);
	}

	.title-wrap h2 {
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-top: 0.15rem;
	}

	/* Metrics Grid */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.metric-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.metric-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.metric-value-wrap {
		display: flex;
		flex-direction: column;
	}

	.metric-value {
		font-size: 1.5rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.metric-sub-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.1rem;
	}

	.metric-sub-label.text-red {
		color: #ef4444;
		font-weight: 500;
	}

	/* Chart Card */
	.chart-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--shadow-md);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		border-bottom: 1px solid #f4f4f5;
		padding-bottom: 1rem;
	}

	.chart-header h3 {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.range-selectors {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.selector-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.selector-group label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.selector-group select {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		outline: none;
		cursor: pointer;
		font-weight: 500;
		color: var(--text-primary);
	}

	.selector-group select:focus {
		border-color: var(--color-accent);
	}

	.chart-body {
		position: relative;
		height: 400px;
		width: 100%;
	}

	.echarts-container {
		width: 100%;
		height: 100%;
	}

	.chart-loading {
		position: absolute;
		inset: 0;
		background: rgba(255, 255, 255, 0.7);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		z-index: 10;
		border-radius: var(--radius-md);
		backdrop-filter: blur(1px);
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2.5px solid var(--border-color);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.chart-loading span {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	/* Responsive Media Queries */
	@media (max-width: 1024px) {
		.main-layout {
			grid-template-columns: 1fr;
		}

		.metrics-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 640px) {
		.dashboard-container {
			padding: 1rem;
		}

		.metrics-grid {
			grid-template-columns: 1fr;
		}

		.header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.status-indicator {
			align-self: flex-start;
		}

		.chart-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}
	}
</style>
