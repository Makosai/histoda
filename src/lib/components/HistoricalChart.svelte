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
		viewMode: 'annual' | 'seasonal' | 'monthly';
		selectedSeason: string;
		selectedMonth: number;
		earthquakeViewMode: 'event' | 'global';
		earthquakeSubMode: 'decay' | 'trend';
		conflictViewMode: 'event' | 'global';
		dataSource?: 'clickhouse' | 'mock' | 'loading';
	}

	let {
		activeDomain,
		chartData,
		isLoading,
		isCelsius,
		startYear = $bindable(),
		endYear = $bindable(),
		selectedEarthquake,
		selectedConflict,
		viewMode = $bindable('annual'),
		selectedSeason = $bindable('all'),
		selectedMonth = $bindable(0),
		earthquakeViewMode = $bindable('event'),
		earthquakeSubMode = $bindable('decay'),
		conflictViewMode = $bindable('event'),
		dataSource = 'clickhouse'
	}: Props = $props();

	let chartDom: HTMLElement | null = $state(null);
	let chartInstance: any = null;

	// Redraw chart reactively on data or layout state changes
	$effect(() => {
		const _data = chartData;
		const _domain = activeDomain;
		const _unit = isCelsius;
		const _mode = viewMode;
		const _season = selectedSeason;
		const _month = selectedMonth;
		const _eqView = earthquakeViewMode;
		const _eqSub = earthquakeSubMode;
		const _conflictView = conflictViewMode;

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
			if (viewMode === 'seasonal' && selectedSeason === 'all') {
				// 4-line seasonal chart
				const yearsSet = new Set<number>();
				const summerTempsMap = new Map<number, number>();
				const winterTempsMap = new Map<number, number>();
				const springTempsMap = new Map<number, number>();
				const autumnTempsMap = new Map<number, number>();

				for (const row of chartData) {
					yearsSet.add(row.year);
					const temp = isCelsius ? row.tempAvg : parseFloat(((row.tempAvg * 1.8) + 32).toFixed(2));
					if (row.season === 'Summer') summerTempsMap.set(row.year, temp);
					else if (row.season === 'Winter') winterTempsMap.set(row.year, temp);
					else if (row.season === 'Spring') springTempsMap.set(row.year, temp);
					else if (row.season === 'Autumn') autumnTempsMap.set(row.year, temp);
				}

				const years = Array.from(yearsSet).sort((a, b) => a - b);
				const summerTemps = years.map(y => summerTempsMap.get(y) ?? null);
				const winterTemps = years.map(y => winterTempsMap.get(y) ?? null);
				const springTemps = years.map(y => springTempsMap.get(y) ?? null);
				const autumnTemps = years.map(y => autumnTempsMap.get(y) ?? null);

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
								<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">Year ${year} (Seasonal Averages)</div>`;
							params.forEach((param: any) => {
								html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; font-size: 13px;">
									<span style="color: #71717a;">${param.seriesName}</span>
									<span style="font-weight: 600; color: ${param.color}">${param.value !== null ? param.value + `°${isCelsius ? 'C' : 'F'}` : 'N/A'}</span>
								</div>`;
							});
							html += '</div>';
							return html;
						}
					},
					legend: {
						data: ['Winter', 'Spring', 'Summer', 'Autumn'],
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
					yAxis: {
						type: 'value',
						name: `Temp (°${isCelsius ? 'C' : 'F'})`,
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { lineStyle: { color: '#f4f4f5', type: 'dashed' } },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					},
					series: [
						{
							name: 'Winter',
							type: 'line',
							data: winterTemps,
							symbol: 'none',
							smooth: true,
							lineStyle: { width: 2.5, color: '#06b6d4' },
							itemStyle: { color: '#06b6d4' }
						},
						{
							name: 'Spring',
							type: 'line',
							data: springTemps,
							symbol: 'none',
							smooth: true,
							lineStyle: { width: 2.5, color: '#10b981' },
							itemStyle: { color: '#10b981' }
						},
						{
							name: 'Summer',
							type: 'line',
							data: summerTemps,
							symbol: 'none',
							smooth: true,
							lineStyle: { width: 2.5, color: '#f97316' },
							itemStyle: { color: '#f97316' }
						},
						{
							name: 'Autumn',
							type: 'line',
							data: autumnTemps,
							symbol: 'none',
							smooth: true,
							lineStyle: { width: 2.5, color: '#eab308' },
							itemStyle: { color: '#eab308' }
						}
					]
				};
			} else if (viewMode === 'monthly' && selectedMonth === 0) {
				// Continuous monthly timeline with dataZoom
				const timelineLabels = chartData.map(d => `${d.year}-${String(d.month).padStart(2, '0')}`);
				const temps = chartData.map(d => {
					if (isCelsius) return d.tempAvg;
					return parseFloat(((d.tempAvg * 1.8) + 32).toFixed(2));
				});

				option = {
					tooltip: {
						trigger: 'axis',
						backgroundColor: '#ffffff',
						borderColor: '#e4e4e7',
						borderWidth: 1,
						textStyle: { color: '#18181b', fontFamily: 'Outfit' },
						formatter: function (params: any) {
							let dateStr = params[0].name;
							let tempVal = params[0].value;
							return `<div style="padding: 4px 8px; font-family: Outfit;">
								<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">${dateStr}</div>
								<div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; font-size: 13px;">
									<span style="color: #71717a;">Avg Temperature</span>
									<span style="font-weight: 600; color: #4f46e5;">${tempVal}°${isCelsius ? 'C' : 'F'}</span>
								</div>
							</div>`;
						}
					},
					legend: {
						data: ['Avg Temperature'],
						textStyle: { fontFamily: 'Outfit', color: '#71717a' },
						bottom: 0
					},
					grid: { left: '4%', right: '4%', top: '8%', bottom: '22%', containLabel: true },
					xAxis: {
						type: 'category',
						boundaryGap: false,
						data: timelineLabels,
						axisLine: { lineStyle: { color: '#e4e4e7' } },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					},
					yAxis: {
						type: 'value',
						name: `Temp (°${isCelsius ? 'C' : 'F'})`,
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { lineStyle: { color: '#f4f4f5', type: 'dashed' } },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					},
					dataZoom: [
						{
							type: 'slider',
							show: true,
							start: 90, // default zoom to last 10%
							end: 100,
							textStyle: { fontFamily: 'Outfit', color: '#71717a' },
							borderColor: '#e4e4e7',
							bottom: '4%'
						}
					],
					series: [
						{
							name: 'Avg Temperature',
							type: 'line',
							data: temps,
							symbol: 'none',
							smooth: true,
							lineStyle: { width: 2.2, color: '#4f46e5' },
							itemStyle: { color: '#4f46e5' }
						}
					]
				};
			} else {
				// Single line trend (Annual, single season, or single month) over years
				const years = chartData.map((d) => d.year);
				const avgTemps = chartData.map((d) => {
					if (isCelsius) return d.tempAvg;
					return parseFloat(((d.tempAvg * 1.8) + 32).toFixed(2));
				});
				const anomalies = chartData.map((d) => {
					if (isCelsius) return d.globalAnomaly;
					return parseFloat((d.globalAnomaly * 1.8).toFixed(3));
				});

				let seriesName = 'Avg Temperature';
				let lineColor = '#4f46e5';
				
				if (viewMode === 'seasonal') {
					seriesName = `${selectedSeason} Avg Temp`;
					if (selectedSeason === 'Summer') lineColor = '#f97316';
					else if (selectedSeason === 'Winter') lineColor = '#06b6d4';
					else if (selectedSeason === 'Spring') lineColor = '#10b981';
					else if (selectedSeason === 'Autumn') lineColor = '#eab308';
				} else if (viewMode === 'monthly') {
					const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
					seriesName = `${monthNames[selectedMonth]} Avg Temp`;
					lineColor = '#8b5cf6'; // Violet for single month
				}

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
						data: [seriesName, 'Global Anomaly'],
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
							name: seriesName,
							type: 'line',
							data: avgTemps,
							symbol: 'none',
							smooth: true,
							lineStyle: { width: 2.5, color: lineColor },
							itemStyle: { color: lineColor }
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
			}
		} else if (activeDomain === 'earthquakes') {
			const years = chartData.map((d) => d.year);
			const magnitudes = chartData.map((d) => d.mag);
			const frequencies = chartData.map((d) => d.frequency);

			const isGlobal = earthquakeViewMode === 'global';
			const isDecay = !isGlobal && earthquakeSubMode === 'decay';

			const magSeriesName = isDecay 
				? 'Max Magnitude' 
				: (isGlobal ? 'Max Magnitude' : 'Peak Magnitude');
			
			const freqSeriesName = isDecay 
				? 'Daily Aftershocks' 
				: (isGlobal ? 'Total Earthquakes (M6+)' : 'Activity Count (M4+)');

			option = {
				tooltip: {
					trigger: 'axis',
					backgroundColor: '#ffffff',
					borderColor: '#e4e4e7',
					borderWidth: 1,
					textStyle: { color: '#18181b', fontFamily: 'Outfit' },
					formatter: function (params: any) {
						let name = params[0].name;
						let title = isDecay ? name : `Year ${name}`;
						let html = `<div style="padding: 4px 8px; font-family: Outfit;">
							<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px;">${title}</div>`;
						params.forEach((param: any) => {
							const suffix = param.seriesName.includes('Magnitude') ? ' Mw' : ' events';
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
					data: [magSeriesName, freqSeriesName],
					textStyle: { fontFamily: 'Outfit', color: '#71717a' },
					bottom: 0
				},
				grid: { left: '4%', right: '4%', top: '8%', bottom: '12%', containLabel: true },
				xAxis: {
					type: 'category',
					boundaryGap: isDecay ? true : false,
					data: isDecay ? years.map((y) => `Day ${y}`) : years,
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
						name: isDecay ? 'Aftershocks / Day' : 'Events / Year',
						nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
						splitLine: { show: false },
						axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
					}
				],
				series: [
					{
						name: magSeriesName,
						type: 'line',
						data: magnitudes,
						symbol: isGlobal ? 'none' : 'circle',
						symbolSize: 6,
						smooth: true,
						lineStyle: { width: 2.5, color: '#dc2626' },
						itemStyle: { color: '#dc2626' }
					},
					{
						name: freqSeriesName,
						type: 'bar',
						yAxisIndex: 1,
						data: frequencies,
						barWidth: isDecay ? '60%' : (isGlobal ? '60%' : '40%'),
						itemStyle: {
							color: isDecay ? 'rgba(239, 68, 68, 0.25)' : (isGlobal ? 'rgba(239, 68, 68, 0.15)' : 'rgba(113, 113, 122, 0.2)'),
							borderRadius: [4, 4, 0, 0]
						}
					}
				]
			};
		} else if (activeDomain === 'conflicts') {
			const years = chartData.map((d) => d.year);
			const isGlobal = conflictViewMode === 'global';

			if (isGlobal) {
				const activeWars = chartData.map((d) => d.activeWars);
				const totalCasualties = chartData.map((d) => d.totalCasualties);

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
								const valStr = param.seriesName === 'Est. Total Casualties' 
									? param.value.toLocaleString()
									: param.value;
								html += `<div style="display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; font-size: 13px;">
									<span style="color: #71717a;">${param.seriesName}</span>
									<span style="font-weight: 500; color: ${param.color}">${valStr}</span>
								</div>`;
							});
							html += '</div>';
							return html;
						}
					},
					legend: {
						data: ['Active Wars Count', 'Est. Total Casualties'],
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
							name: 'Active Wars Count',
							nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
							splitLine: { lineStyle: { color: '#f4f4f5', type: 'dashed' } },
							axisLabel: { fontFamily: 'Outfit', color: '#71717a' }
						},
						{
							type: 'value',
							name: 'Annual Casualties',
							nameTextStyle: { fontFamily: 'Outfit', color: '#71717a' },
							splitLine: { show: false },
							axisLabel: { 
								fontFamily: 'Outfit', 
								color: '#71717a',
								formatter: function (value: number) {
									if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
									if (value >= 1e3) return (value / 1e3).toFixed(0) + 'k';
									return value;
								}
							}
						}
					],
					series: [
						{
							name: 'Active Wars Count',
							type: 'line',
							data: activeWars,
							symbol: 'none',
							smooth: true,
							lineStyle: { width: 2.5, color: '#8b5cf6' },
							areaStyle: {
								color: {
									type: 'linear',
									x: 0, y: 0, x2: 0, y2: 1,
									colorStops: [
										{ offset: 0, color: 'rgba(139, 92, 246, 0.15)' },
										{ offset: 1, color: 'rgba(139, 92, 246, 0)' }
									]
								}
							},
							itemStyle: { color: '#8b5cf6' }
						},
						{
							name: 'Est. Total Casualties',
							type: 'bar',
							yAxisIndex: 1,
							data: totalCasualties,
							barWidth: '60%',
							itemStyle: {
								color: 'rgba(239, 68, 68, 0.3)',
								borderRadius: [4, 4, 0, 0]
							}
						}
					]
				};
			} else {
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
			{:else if activeDomain === 'earthquakes'}
				{#if earthquakeViewMode === 'global'}
					Global Seismic Activity & Magnitudes (1880 - 2026)
				{:else}
				{#if earthquakeSubMode === 'decay'}
					30-Day Aftershock Decay Timeline
				{:else}
					30-Year Local Seismic Trend
				{/if}
				{/if}
			{:else if activeDomain === 'conflicts'}
				{#if conflictViewMode === 'global'}
					Century Conflict Frequency & Casualties Timeline (1920 - 2026)
				{:else}
					Conflict Battle Intensity Timeline
				{/if}
			{/if}
		</h3>
		
		{#if activeDomain === 'climate'}
			<div class="climate-controls">
				<!-- View Mode Toggle Button Group -->
				<div class="view-toggle">
					<button 
						class="toggle-btn" 
						class:active={viewMode === 'annual'} 
						onclick={() => { viewMode = 'annual'; }}
					>
						Annual
					</button>
					<button 
						class="toggle-btn" 
						class:active={viewMode === 'seasonal'} 
						onclick={() => { viewMode = 'seasonal'; }}
					>
						Seasonal
					</button>
					<button 
						class="toggle-btn" 
						class:active={viewMode === 'monthly'} 
						onclick={() => { viewMode = 'monthly'; }}
					>
						Monthly
					</button>
				</div>

				<!-- Sub-filters based on viewMode -->
				{#if viewMode === 'seasonal'}
					<div class="selector-group">
						<label for="season-select">Season</label>
						<select id="season-select" bind:value={selectedSeason}>
							<option value="all">All Seasons</option>
							<option value="Summer">Summer</option>
							<option value="Winter">Winter</option>
							<option value="Spring">Spring</option>
							<option value="Autumn">Autumn</option>
						</select>
					</div>
				{:else if viewMode === 'monthly'}
					<div class="selector-group">
						<label for="month-select">Month</label>
						<select id="month-select" bind:value={selectedMonth}>
							<option value={0}>All Months</option>
							<option value={1}>January</option>
							<option value={2}>February</option>
							<option value={3}>March</option>
							<option value={4}>April</option>
							<option value={5}>May</option>
							<option value={6}>June</option>
							<option value={7}>July</option>
							<option value={8}>August</option>
							<option value={9}>September</option>
							<option value={10}>October</option>
							<option value={11}>November</option>
							<option value={12}>December</option>
						</select>
					</div>
				{/if}

				<!-- Year Range selectors -->
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
		{:else if activeDomain === 'earthquakes'}
			<div class="climate-controls">
				<div class="view-toggle">
					<button 
						class="toggle-btn" 
						class:active={earthquakeViewMode === 'event'} 
						onclick={() => { earthquakeViewMode = 'event'; }}
					>
						Famous Events
					</button>
					<button 
						class="toggle-btn" 
						class:active={earthquakeViewMode === 'global'} 
						onclick={() => { earthquakeViewMode = 'global'; }}
					>
						Global Trends (140Y)
					</button>
				</div>
				{#if earthquakeViewMode === 'event'}
					<div class="view-toggle">
						<button 
							class="toggle-btn" 
							class:active={earthquakeSubMode === 'decay'} 
							onclick={() => { earthquakeSubMode = 'decay'; }}
						>
							30-Day Decay
						</button>
						<button 
							class="toggle-btn" 
							class:active={earthquakeSubMode === 'trend'} 
							onclick={() => { earthquakeSubMode = 'trend'; }}
						>
							30-Year Trend
						</button>
					</div>
				{/if}
			</div>
		{:else if activeDomain === 'conflicts'}
			<div class="climate-controls">
				<div class="view-toggle">
					<button 
						class="toggle-btn" 
						class:active={conflictViewMode === 'event'} 
						onclick={() => { conflictViewMode = 'event'; }}
					>
						Famous Conflicts
					</button>
					<button 
						class="toggle-btn" 
						class:active={conflictViewMode === 'global'} 
						onclick={() => { conflictViewMode = 'global'; }}
					>
						Century Timeline
					</button>
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
	
	<div class="chart-footer">
		<div class="source-indicator">
			{#if dataSource === 'clickhouse'}
				<span class="badge clickhouse">
					<span class="dot green"></span> Live ClickHouse Database
				</span>
			{:else if dataSource === 'mock'}
				<span class="badge mock">
					<span class="dot yellow"></span> Offline Fallback (Mock Data)
				</span>
			{/if}

			{#if activeDomain === 'conflicts' && conflictViewMode === 'event'}
				<span class="notice">
					ℹ️ Yearly battle intensity and count are mathematically simulated inside the conflict's span.
				</span>
			{:else if activeDomain === 'earthquakes' && earthquakeViewMode === 'event'}
				{#if earthquakeSubMode === 'decay'}
					{#if dataSource === 'clickhouse'}
						<span class="notice">
							ℹ️ Aftershock sequence compiled from static USGS ANSS ComCat catalog records.
						</span>
					{:else}
						<span class="notice">
							ℹ️ Aftershock sequence mathematically modeled using Omori's Law and Gutenberg-Richter equations.
						</span>
					{/if}
				{:else}
					<span class="notice">
						ℹ️ Local country-wide seismic timeline displays M4.0+ events.
					</span>
				{/if}
			{/if}
		</div>
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
		flex-wrap: wrap;
	}

	.chart-header h3 {
		font-size: 0.90rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.climate-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.view-toggle {
		display: flex;
		background: var(--bg-canvas);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.toggle-btn {
		background: transparent;
		color: var(--text-secondary);
		border: none;
		border-radius: calc(var(--radius-md) - 2px);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-btn:hover {
		color: var(--text-primary);
	}

	.toggle-btn.active {
		background: var(--bg-card);
		color: var(--text-primary);
		box-shadow: var(--shadow-sm);
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

	.chart-footer {
		border-top: 1px solid var(--border-color);
		padding-top: 0.75rem;
		margin-top: -0.25rem;
	}

	.source-indicator {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-md);
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.badge.clickhouse {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
	}

	.badge.mock {
		background: rgba(234, 179, 8, 0.1);
		color: #eab308;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.dot.green {
		background-color: #22c55e;
	}

	.dot.yellow {
		background-color: #eab308;
	}

	.notice {
		color: var(--text-secondary);
		font-size: 0.7rem;
		font-style: italic;
		font-weight: 500;
	}
</style>
