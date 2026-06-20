<script lang="ts">
	// Props definition
	interface Props {
		activeDomain: "climate" | "earthquakes" | "conflicts";
		isCelsius: boolean;
		stats: {
			globalAnomaly: number;
			reportingStations: number;
			hottestYear: number;
			baselineTemp: number;
		};
		selectedEarthquake: {
			magnitude: number;
			depth: number;
			tsunami: number;
			casualties: number;
		};
		selectedConflict: {
			casualties: number;
			combatants: string[];
			duration: string;
			region: string;
		};
	}

	let {
		activeDomain,
		isCelsius,
		stats,
		selectedEarthquake,
		selectedConflict,
	}: Props = $props();

	// Reactive temperature formatters
	function formatTemp(celsius: number): string {
		if (isCelsius) {
			return `${celsius.toFixed(1)}°C`;
		} else {
			const fahrenheit = celsius * 1.8 + 32;
			return `${fahrenheit.toFixed(1)}°F`;
		}
	}

	function formatAnomaly(celsius: number): string {
		if (isCelsius) {
			return `+${celsius.toFixed(2)}°C`;
		} else {
			const fahrenheitDelta = celsius * 1.8;
			return `+${fahrenheitDelta.toFixed(2)}°F`;
		}
	}
</script>

<div class="metrics-grid">
	{#if activeDomain === "climate"}
		<div class="metric-card">
			<span class="metric-label">Estimated Anomaly</span>
			<span class="metric-value"
				>{formatAnomaly(stats.globalAnomaly)}</span
			>
			<span class="metric-sub text-red">vs 1960–90 baseline</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Hottest Year Recorded</span>
			<span class="metric-value">{stats.hottestYear}</span>
			<span class="metric-sub">Extreme anomaly cycle</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Active Stations</span>
			<span class="metric-value"
				>{stats.reportingStations.toLocaleString()}</span
			>
			<span class="metric-sub">Global coverage network</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Baseline Temp</span>
			<span class="metric-value">{formatTemp(stats.baselineTemp)}</span>
			<span class="metric-sub">Reference baseline average</span>
		</div>
	{:else if activeDomain === "earthquakes"}
		<div class="metric-card">
			<span class="metric-label">Peak Magnitude</span>
			<span class="metric-value">{selectedEarthquake.magnitude} Mw</span>
			<span class="metric-sub">Moment magnitude scale</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Focal Depth</span>
			<span class="metric-value">{selectedEarthquake.depth} km</span>
			<span class="metric-sub">Underground depth limit</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Tsunami Triggered</span>
			<span class="metric-value"
				>{selectedEarthquake.tsunami === 1 ? "Yes" : "No"}</span
			>
			<span class="metric-sub">Sea wave displacement</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Est. Casualties</span>
			<span class="metric-value"
				>{selectedEarthquake.casualties.toLocaleString()}</span
			>
			<span class="metric-sub">Total casualties estimated</span>
		</div>
	{:else}
		<div class="metric-card">
			<span class="metric-label">Est. Casualties</span>
			<span class="metric-value"
				>{selectedConflict.casualties.toLocaleString()}</span
			>
			<span class="metric-sub">Total military/civilian deaths</span>
		</div>
		<div class="metric-card">
			<span class="metric-label">Combatants Groups</span>
			<span class="metric-value"
				>{selectedConflict.combatants.length}</span
			>
			<span class="metric-sub"
				>{selectedConflict.combatants.join(", ")}</span
			>
		</div>
		<div class="metric-card">
			<span class="metric-label">Active Span</span>
			<span class="metric-value">{selectedConflict.duration}</span>
			<span class="metric-sub"
				>{selectedConflict.duration} timeline limit</span
			>
		</div>
		<div class="metric-card">
			<span class="metric-label">Conflict Scope</span>
			<span class="metric-value">{selectedConflict.region}</span>
			<span class="metric-sub">Geographical impact zone</span>
		</div>
	{/if}
</div>

<style>
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
	}

	.metric-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1rem;
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.metric-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.metric-value {
		font-size: 1.35rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.metric-sub {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.metric-sub.text-red {
		color: #ef4444;
		font-weight: 500;
	}

	@media (max-width: 1024px) {
		.metrics-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 640px) {
		.metrics-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
