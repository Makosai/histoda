<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import Header from "$lib/components/Header.svelte";
	import "../app.css";

	// Svelte 5 Runes
	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-layout">
	<!-- Unified Header -->
	<Header isDbAvailable={data.isDbAvailable} />

	<!-- Main Page Content -->
	{@render children()}
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
</style>
