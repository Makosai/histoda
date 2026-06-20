<script lang="ts">
	// Props passed to the header
	let { isDbAvailable = false }: { isDbAvailable: boolean } = $props();
</script>

<header class="header">
	<div class="logo-area">
		<span class="logo-symbol">◆</span>
		<h1 class="logo-title">histoda</h1>
		<span class="logo-subtitle">historical analytics</span>
	</div>

	<div class="status-indicator">
		{#if isDbAvailable}
			<span class="status-dot online"></span>
			<span class="status-label">ClickHouse Connected</span>
		{:else}
			<span class="status-dot demo"></span>
			<span class="status-label">Sandbox Mode (Mock Active)</span>
		{/if}
	</div>
</header>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border-color);
		width: 100%;
		margin-bottom: 1.25rem;
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

	@media (max-width: 640px) {
		.header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}
		
		.status-indicator {
			align-self: flex-start;
		}
	}
</style>
