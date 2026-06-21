<script lang="ts">
	import { onMount } from 'svelte';
	import type { Earthquake, Conflict } from '$lib/mockData';

	interface Props {
		activeDomain: 'climate' | 'earthquakes' | 'conflicts';
		chartData: any[];
		isLoading: boolean;
		isCelsius: boolean;
		startYear: number;
		endYear: number;
		selectedEarthquake: Earthquake;
		selectedConflict: Conflict;
	}

	let {
		activeDomain,
		chartData,
		isLoading,
		isCelsius,
		startYear = $bindable(),
		endYear = $bindable(),
		selectedEarthquake,
		selectedConflict
	}: Props = $props();

	let chartDom: HTMLElement | null = $state(null);
	let chartInstance: any = null;

	// Redraw chart when chartData, activeDomain, or isCelsius changes
	$effect(() => {
		// Explicit dependencies to track reactivity in Svelte 5
		const _data = chartData;
		const _domain = activeDomain;
		const _unit = isCelsius;

		if (chartInstance) {
			updateChart();
		}
	});

	function updateChart() {
		if (!chartInstance) return;

		if (!chartData || chartData.length === 0) {
			chartInstance.clear();
			return;
		}

		// Ensure container size is updated before drawing
		chartInstance.resize();

		let option: any = {};

		if (activeDomain === 'climate') {
			const years = chartData.map((d) => d.year);
			const avgTemps = chartData.map((d) => {
				if (isCelsius) return d.tempAvg;
				return parseFloat(((d.tempAvg * 1.8) + 32).toFixed(2));
			});
			const anomalies = chartData.map((d) => {
				if (isCelsius) return d.globalAnomaly;
				return parseFloat((d.globalAnomaly * 1.8).toFixed(3));
			});

			option = {
				tooltip: {
					trigger: 'axis',
					backgroundColor: '#ffffff',
					borderColor: '#e4e4e7',
					borderWidth: 1,
					textStyle: { color: '#18181b', fontFamily: 'Outfit' },
					formatter: function (params: any) {
						let year = params[0].name;
						let html = `<div style="padding: 4px 8px; font-family: Outfit;">
							<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">Year ${year}</div>`;
						params.forEach((param: any) => {
							html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; font-size: 13px;">
								<span style="color: #71717a;">${param.seriesName}</span>
								<span style="font-weight: 500; color: ${param.color}">${param.value}°${isCelsius ? 'C' : 'F'}</span>
							</div>`;
						});
						html += '</div>';
						return html;
					}
				},
				legend: {
					data: ['Avg Temperature', 'Global Anomaly'],
					textStyle: { fontFamily: 'Outfit', color: '#71717a' },
					bottom: 0
				},
				grid: { left: '4%', right: '4%', top: '8%', bottom: '12%', containLabel: true },
				xAxis: {
					type: 'category',
					boundaryGap: false,
					data: years,
					axisLine: { lineStyle: { color: '#e4e4e7' } },
					axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
				},
				yAxis: [
					{
						type: 'value',
						name: `Temp (°${isCelsius ? 'C' : 'F'})`,
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { lineStyle: { color: '#f4f4f5', type: 'dashed' } },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					},
					{
						type: 'value',
						name: `Global Anomaly (°${isCelsius ? 'C' : 'F'})`,
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { show: false },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					}
				],
				series: [
					{
						name: 'Avg Temperature',
						type: 'line',
						data: avgTemps,
						symbol: 'none',
						smooth: true,
						lineStyle: { width: 2.5, color: '#4f46e5' },
						itemStyle: { color: '#4f46e5' }
					},
					{
						name: 'Global Anomaly',
						type: 'line',
						yAxisIndex: 1,
						data: anomalies,
						symbol: 'none',
						smooth: true,
						lineStyle: { width: 2, color: '#f59e0b' },
						areaStyle: {
							color: {
								type: 'linear',
								x: 0, y: 0, x2: 0, y2: 1,
								colorStops: [
									{ offset: 0, color: 'rgba(245, 158, 11, 0.15)' },
									{ offset: 1, color: 'rgba(245, 158, 11, 0)' }
								]
							}
						},
						itemStyle: { color: '#f59e0b' }
					}
				]
			};
		} else if (activeDomain === 'earthquakes') {
			const years = chartData.map((d) => d.year);
			const magnitudes = chartData.map((d) => d.mag);
			const frequencies = chartData.map((d) => d.frequency);

			option = {
				tooltip: {
					trigger: 'axis',
					backgroundColor: '#ffffff',
					borderColor: '#e4e4e7',
					borderWidth: 1,
					textStyle: { color: '#18181b', fontFamily: 'Outfit' },
					formatter: function (params: any) {
						let year = params[0].name;
						let html = `<div style="padding: 4px 8px; font-family: Outfit;">
							<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">Year ${year}</div>`;
						params.forEach((param: any) => {
							const suffix = param.seriesName === 'Peak Magnitude' ? ' Mw' : ' events';
							html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; font-size: 13px;">
								<span style="color: #71717a;">${param.seriesName}</span>
								<span style="font-weight: 500; color: ${param.color}">${param.value}${suffix}</span>
							</div>`;
						});
						html += '</div>';
						return html;
					}
				},
				legend: {
					data: ['Peak Magnitude', 'Activity Count (M4+)'],
					textStyle: { fontFamily: 'Outfit', color: '#71717a' },
					bottom: 0
				},
				grid: { left: '4%', right: '4%', top: '8%', bottom: '12%', containLabel: true },
				xAxis: {
					type: 'category',
					boundaryGap: false,
					data: years,
					axisLine: { lineStyle: { color: '#e4e4e7' } },
					axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
				},
				yAxis: [
					{
						type: 'value',
						name: 'Magnitude (Mw)',
						min: 0,
						max: 10,
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { lineStyle: { color: '#f4f4f5', type: 'dashed' } },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					},
					{
						type: 'value',
						name: 'Events / Year',
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { show: false },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					}
				],
				series: [
					{
						name: 'Peak Magnitude',
						type: 'line',
						data: magnitudes,
						symbol: 'circle',
						symbolSize: 6,
						smooth: true,
						lineStyle: { width: 2.5, color: '#dc2626' },
						itemStyle: { color: '#dc2626' }
					},
					{
						name: 'Activity Count (M4+)',
						type: 'bar',
						yAxisIndex: 1,
						data: frequencies,
						barWidth: '40%',
						itemStyle: {
							color: 'rgba(113, 113, 122, 0.2)',
							borderRadius: [4, 4, 0, 0]
						}
					}
				]
			};
		} else if (activeDomain === 'conflicts') {
			const years = chartData.map((d) => d.year);
			const intensities = chartData.map((d) => d.intensity);
			const battleCounts = chartData.map((d) => d.battleCount);

			option = {
				tooltip: {
					trigger: 'axis',
					backgroundColor: '#ffffff',
					borderColor: '#e4e4e7',
					borderWidth: 1,
					textStyle: { color: '#18181b', fontFamily: 'Outfit' },
					formatter: function (params: any) {
						let year = params[0].name;
						let html = `<div style="padding: 4px 8px; font-family: Outfit;">
							<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">Year ${year}</div>`;
						params.forEach((param: any) => {
							const suffix = param.seriesName === 'Conflict Intensity' ? ' %' : ' battles';
							html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; font-size: 13px;">
								<span style="color: #71717a;">${param.seriesName}</span>
								<span style="font-weight: 500; color: ${param.color}">${param.value}${suffix}</span>
							</div>`;
						});
						html += '</div>';
						return html;
					}
				},
				legend: {
					data: ['Conflict Intensity', 'Active Battles'],
					textStyle: { fontFamily: 'Outfit', color: '#71717a' },
					bottom: 0
				},
				grid: { left: '4%', right: '4%', top: '8%', bottom: '12%', containLabel: true },
				xAxis: {
					type: 'category',
					boundaryGap: false,
					data: years,
					axisLine: { lineStyle: { color: '#e4e4e7' } },
					axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
				},
				yAxis: [
					{
						type: 'value',
						name: 'Intensity Index (%)',
						min: 0,
						max: 100,
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { lineStyle: { color: '#f4f4f5', type: 'dashed' } },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					},
					{
						type: 'value',
						name: 'Battles Count',
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { show: false },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					}
				],
				series: [
					{
						name: 'Conflict Intensity',
						type: 'line',
						data: intensities,
						symbol: 'none',
						smooth: true,
						lineStyle: { width: 2.5, color: '#4f46e5' },
						areaStyle: {
							color: {
								type: 'linear',
								x: 0, y: 0, x2: 0, y2: 1,
								colorStops: [
									{ offset: 0, color: 'rgba(79, 70, 229, 0.15)' },
									{ offset: 1, color: 'rgba(79, 70, 229, 0)' }
								]
							}
						},
						itemStyle: { color: '#4f46e5' }
					},
					{
						name: 'Active Battles',
						type: 'bar',
						yAxisIndex: 1,
						data: battleCounts,
						barWidth: '40%',
						itemStyle: {
							color: 'rgba(239, 68, 68, 0.3)',
							borderRadius: [4, 4, 0, 0]
						}
					}
				]
			};
		}

		chartInstance.setOption(option, true);
	}

	onMount(() => {
		// Dynamically import ECharts on client mount
		import('echarts').then((echarts) => {
			if (chartDom) {
				chartInstance = echarts.init(chartDom);
				updateChart();
			}
		});

		// Resizing responsiveness
		const handleResize = () => {
			if (chartInstance) chartInstance.resize();
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
			if (chartInstance) chartInstance.dispose();
		};
	});
</script>

<div class="chart-card">
	<div class="chart-header">
		<h3>
			{#if activeDomain === 'climate'}
				Temperature & Climate Anomaly Trends
			{:else}
				Seismic or battle timelines & indexes metrics
			{/if}
		</h3>
		
		{#if activeDomain === 'climate'}
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
		{/if}
	</div>

	<div class="chart-body">
		{#if isLoading}
			<div class="chart-loading">
				<div class="spinner"></div>
				<span>Querying data series...</span>
			</div>
		{/if}
		<div bind:this={chartDom} class="echarts-container"></div>
	</div>


</div>

<style>
	.chart-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		box-shadow: var(--shadow-md);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		border-bottom: 1px solid #f4f4f5;
		padding-bottom: 0.75rem;
	}

	.chart-header h3 {
		font-size: 0.90rem;
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
		height: 380px;
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
		gap: 0.5rem;
		z-index: 10;
		border-radius: var(--radius-md);
		backdrop-filter: blur(1px);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--border-color);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.chart-loading span {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}


</style>
