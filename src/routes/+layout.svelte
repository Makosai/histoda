<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import Header from "$lib/components/Header.svelte";
	import "../app.css";

	// Svelte 5 Runes
	let { data, children } = $props();
</script>

<svelte:head>
	<title>Histoda - Climate, Seismic & Historical Conflict Analytics</title>
	<meta name="description" content="Explore and analyze decades of global datasets on Histoda. Monitor temperature anomalies, track peak earthquake magnitudes, and visualize historical war timelines through interactive dashboards." />
	<meta name="keywords" content="historical statistics, climate change, temperatures, earthquakes, war conflicts, interactive charts, clickhouse, analytics" />
	<meta name="robots" content="index, follow" />
	
	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Histoda - Climate, Seismic & Historical Conflict Analytics" />
	<meta property="og:description" content="Explore and analyze decades of global datasets on Histoda. Monitor temperature anomalies, track peak earthquake magnitudes, and visualize historical war timelines through interactive dashboards." />
	
	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:title" content="Histoda - Climate, Seismic & Historical Conflict Analytics" />
	<meta property="twitter:description" content="Explore and analyze decades of global datasets on Histoda. Monitor temperature anomalies, track peak earthquake magnitudes, and visualize historical war timelines through interactive dashboards." />
	
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-layout">
	<!-- Unified Header -->
	<Header isDbAvailable={data.isDbAvailable} />

	<!-- Main Page Content -->
	{@render children()}

	<!-- Footer -->
	<footer class="footer">
		<p class="footer-text">
			© {new Date().getFullYear()} <a href="https://quaintstudios.com" target="_blank" rel="noopener" class="footer-link">Quaint Studios LLC</a>
		</p>
	</footer>
</div>

<style>
	.app-layout {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 2rem 1rem 2rem;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.footer {
		margin-top: auto;
		padding: 2.5rem 0 1rem 0;
		text-align: center;
		border-top: 1px solid var(--border-color);
	}

	.footer-text {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.footer-link {
		color: var(--text-secondary);
		font-weight: 500;
		transition: color 0.15s ease;
	}

	.footer-link:hover {
		color: var(--color-accent);
	}
</style>
