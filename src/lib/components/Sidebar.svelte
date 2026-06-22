<script lang="ts">
	import type { Station, Earthquake, Conflict } from '$lib/mockData';

	interface Props {
		activeDomain: 'climate' | 'earthquakes' | 'conflicts';
		stations: Station[];
		earthquakes: Earthquake[];
		conflicts: Conflict[];
		isCelsius: boolean;
		searchQuery: string;
		selectedStation: Station;
		selectedEarthquake: Earthquake;
		selectedConflict: Conflict;
		bookmarks: string[];
		earthquakeViewMode: 'event' | 'global';
		conflictViewMode: 'event' | 'global';
	}

	let {
		activeDomain,
		stations,
		earthquakes,
		conflicts,
		isCelsius = $bindable(),
		searchQuery = $bindable(),
		selectedStation = $bindable(),
		selectedEarthquake = $bindable(),
		selectedConflict = $bindable(),
		bookmarks = $bindable(),
		earthquakeViewMode,
		conflictViewMode
	}: Props = $props();

	// Local state
	let showImportExport = $state(false);
	let importText = $state('');
	let showBookmarksOnly = $state(false);

	$effect(() => {
		// Reset bookmarks filter when switching domain
		const _domain = activeDomain;
		showBookmarksOnly = false;
	});

	// Svelte 5 Derived Runes for lists
	let filteredStations = $derived(
		stations.filter((s) => 
			(!showBookmarksOnly || bookmarks.includes(`climate:${s.id}`)) &&
			(s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
			 s.country.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	let filteredEarthquakes = $derived(
		earthquakes.filter((e) => 
			(!showBookmarksOnly || bookmarks.includes(`earthquakes:${e.id}`)) &&
			(e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
			 e.country.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	let filteredConflicts = $derived(
		conflicts.filter((c) => 
			(!showBookmarksOnly || bookmarks.includes(`conflicts:${c.id}`)) &&
			(c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
			 c.region.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	let isBookmarked = $derived(
		activeDomain === 'climate' ? bookmarks.includes(`climate:${selectedStation.id}`) :
		activeDomain === 'earthquakes' ? bookmarks.includes(`earthquakes:${selectedEarthquake.id}`) :
		bookmarks.includes(`conflicts:${selectedConflict.id}`)
	);

	function toggleBookmark() {
		const key = activeDomain === 'climate' ? `climate:${selectedStation.id}` :
					activeDomain === 'earthquakes' ? `earthquakes:${selectedEarthquake.id}` :
					`conflicts:${selectedConflict.id}`;
		if (isBookmarked) {
			bookmarks = bookmarks.filter((id) => id !== key);
		} else {
			bookmarks = [...bookmarks, key];
		}
		localStorage.setItem('histoda_bookmarks', JSON.stringify(bookmarks));
	}

	function exportCustomization() {
		const config = {
			version: '1.0',
			activeDomain,
			isCelsius,
			selectedStationId: selectedStation.id,
			selectedEarthquakeId: selectedEarthquake.id,
			selectedConflictId: selectedConflict.id,
			bookmarks
		};
		const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
		const link = document.createElement('a');
		link.setAttribute('href', dataStr);
		link.setAttribute('download', 'histoda_customizations.json');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function importCustomization() {
		try {
			const parsed = JSON.parse(importText);
			if (parsed.bookmarks && Array.isArray(parsed.bookmarks)) {
				bookmarks = parsed.bookmarks;
				localStorage.setItem('histoda_bookmarks', JSON.stringify(bookmarks));
			}
			if (parsed.isCelsius !== undefined) isCelsius = parsed.isCelsius;
			
			if (parsed.selectedStationId) {
				const match = stations.find((s) => s.id === parsed.selectedStationId);
				if (match) selectedStation = match;
			}
			if (parsed.selectedEarthquakeId) {
				const match = earthquakes.find((e) => e.id === parsed.selectedEarthquakeId);
				if (match) selectedEarthquake = match;
			}
			if (parsed.selectedConflictId) {
				const match = conflicts.find((c) => c.id === parsed.selectedConflictId);
				if (match) selectedConflict = match;
			}
			showImportExport = false;
			importText = '';
			alert('Settings imported successfully!');
		} catch (e) {
			alert('Failed to parse JSON configuration.');
		}
	}
</script>

<aside class="sidebar">
	<!-- Config Card: Unit Toggle -->
	<div class="sidebar-card config-box">
		<div class="card-title-wrap">
			<h3>Configuration</h3>
		</div>
		<div class="unit-toggle-row">
			<span class="toggle-label">Temperature Unit</span>
			<div class="toggle-btn-group">
				<button class="toggle-choice" class:active={isCelsius} onclick={() => isCelsius = true}>
					°C
				</button>
				<button class="toggle-choice" class:active={!isCelsius} onclick={() => isCelsius = false}>
					°F
				</button>
			</div>
		</div>
	</div>

	<!-- Search Input -->
	<div class="search-wrap">
		<span class="search-icon">🔍</span>
		<input 
			type="text" 
			placeholder="Search location or event..." 
			bind:value={searchQuery}
		/>
		{#if searchQuery}
			<button class="clear-search" onclick={() => searchQuery = ''}>×</button>
		{/if}
	</div>

	<!-- Bookmarks filter pills -->
	<div class="filters-bar">
		<button 
			class="filter-pill" 
			class:active={!showBookmarksOnly} 
			onclick={() => showBookmarksOnly = false}
		>
			All
		</button>
		<button 
			class="filter-pill" 
			class:active={showBookmarksOnly} 
			onclick={() => showBookmarksOnly = true}
		>
			★ Bookmarked ({bookmarks.filter(b => b.startsWith(activeDomain === 'climate' ? 'climate:' : activeDomain === 'earthquakes' ? 'earthquakes:' : 'conflicts:')).length})
		</button>
	</div>

	<!-- List View -->
	<div class="list-header">
		<h4>
			{#if activeDomain === 'climate'}
				Weather Stations
			{:else}
				Historical Events
			{/if}
		</h4>
		<span class="count-badge">
			{#if activeDomain === 'climate'}
				{filteredStations.length}
			{:else if activeDomain === 'earthquakes'}
				{filteredEarthquakes.length}
			{:else}
				{filteredConflicts.length}
			{/if}
		</span>
	</div>

	<div class="station-list">
			{#if activeDomain === 'climate'}
				{#each filteredStations as station}
					<button 
						class="station-card" 
						class:active={selectedStation.id === station.id}
						onclick={() => selectedStation = station}
					>
						<div class="item-header">
							<span class="item-title">{station.name}</span>
							{#if bookmarks.includes(`climate:${station.id}`)}
								<span class="star-badge">★</span>
							{/if}
						</div>
						<div class="item-meta">
							<span>{station.country}</span>
						</div>
					</button>
				{/each}
				{#if filteredStations.length === 0}
					<div class="empty-state">
						<p>No weather stations found.</p>
						{#if showBookmarksOnly}
							<p class="empty-hint">Try bookmarking some stations first!</p>
						{/if}
					</div>
				{/if}
			{:else if activeDomain === 'earthquakes'}
				{#if earthquakeViewMode === 'global'}
					<div class="global-view-banner animate-fade-in">
						<span class="banner-icon">🌐</span>
						<div class="banner-text">
							<h5>Global Trends Active</h5>
							<p>Displaying data for 2.9M+ earthquakes. Individual selection is disabled.</p>
						</div>
					</div>
				{/if}
				<div class="list-wrapper-container" class:disabled-view={earthquakeViewMode === 'global'}>
					{#each filteredEarthquakes as eq}
						<button 
							class="station-card" 
							class:active={selectedEarthquake.id === eq.id}
							onclick={() => { if (earthquakeViewMode !== 'global') selectedEarthquake = eq; }}
							disabled={earthquakeViewMode === 'global'}
						>
							<div class="item-header">
								<span class="item-title">{eq.name}</span>
								{#if bookmarks.includes(`earthquakes:${eq.id}`)}
									<span class="star-badge">★</span>
								{/if}
							</div>
							<div class="item-meta">
								<span>Mag {eq.magnitude} Mw</span>
								<span class="dot">•</span>
								<span>{eq.year}</span>
							</div>
						</button>
					{/each}
					{#if filteredEarthquakes.length === 0}
						<div class="empty-state">
							<p>No earthquakes found.</p>
							{#if showBookmarksOnly}
								<p class="empty-hint">Try bookmarking some earthquakes first!</p>
							{/if}
						</div>
					{/if}
				</div>
			{:else if activeDomain === 'conflicts'}
				{#if conflictViewMode === 'global'}
					<div class="global-view-banner animate-fade-in">
						<span class="banner-icon">⚔️</span>
						<div class="banner-text">
							<h5>Century Timeline Active</h5>
							<p>Displaying active wars and casualty rates. Individual selection is disabled.</p>
						</div>
					</div>
				{/if}
				<div class="list-wrapper-container" class:disabled-view={conflictViewMode === 'global'}>
					{#each filteredConflicts as conflict}
						<button 
							class="station-card" 
							class:active={selectedConflict.id === conflict.id}
							onclick={() => { if (conflictViewMode !== 'global') selectedConflict = conflict; }}
							disabled={conflictViewMode === 'global'}
						>
							<div class="item-header">
								<span class="item-title">{conflict.name}</span>
								{#if bookmarks.includes(`conflicts:${conflict.id}`)}
									<span class="star-badge">★</span>
								{/if}
							</div>
							<div class="item-meta">
								<span>{conflict.region}</span>
								<span class="dot">•</span>
								<span>{conflict.startYear}–{conflict.endYear}</span>
							</div>
						</button>
					{/each}
					{#if filteredConflicts.length === 0}
						<div class="empty-state">
							<p>No conflicts found.</p>
							{#if showBookmarksOnly}
								<p class="empty-hint">Try bookmarking some conflicts first!</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>

	<!-- Bookmark Action Card -->
	<div class="sidebar-card bookmarks-box">
		<div class="bookmark-header">
			<h4>Bookmark Selection</h4>
			<button class="action-btn sm" onclick={toggleBookmark}>
				{isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
			</button>
		</div>
		<p class="card-desc">Save this view to browser LocalStorage.</p>
	</div>

	<!-- Sharing Customizations Card -->
	<div class="sidebar-card customization-box">
		<h4>Settings Sharing</h4>
		<div class="settings-actions">
			<button class="sub-btn" onclick={exportCustomization}>Export</button>
			<button class="sub-btn" onclick={() => showImportExport = !showImportExport}>Import</button>
		</div>
		{#if showImportExport}
			<div class="import-area">
				<textarea placeholder="Paste JSON settings string..." bind:value={importText}></textarea>
				<button class="action-btn sm" onclick={importCustomization}>Apply</button>
			</div>
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.sidebar-card {
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.config-box {
		gap: 0.65rem;
	}

	.sidebar-card h3,
	.list-header h4 {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.bookmarks-box h4,
	.customization-box h4 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		text-transform: none;
		letter-spacing: normal;
	}

	.card-desc {
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.35;
	}

	/* Config Toggle Row */
	.unit-toggle-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.toggle-label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.toggle-btn-group {
		display: flex;
		background: var(--bg-canvas);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 0.15rem;
	}

	.toggle-choice {
		background: transparent;
		color: var(--text-secondary);
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-choice.active {
		background: var(--bg-card);
		color: var(--text-primary);
		box-shadow: var(--shadow-sm);
	}

	/* Search input box */
	.search-wrap {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--bg-card);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-md);
		padding: 0.4rem 0.6rem;
		box-shadow: var(--shadow-sm);
		transition: all 0.15s ease;
	}

	.search-wrap:focus-within {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 1px var(--color-accent), var(--shadow-sm);
	}

	.search-icon {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.search-wrap input {
		border: none;
		background: transparent;
		outline: none;
		font-size: 0.8rem;
		color: var(--text-primary);
		width: 100%;
		font-weight: 500;
	}

	.clear-search {
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.1rem;
	}

	/* Bookmarks Filter Pills */
	.filters-bar {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.4rem;
	}

	.filter-pill {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
		border-radius: 99px;
		padding: 0.25rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.filter-pill:hover {
		background: var(--bg-canvas);
		border-color: var(--border-color-hover);
		color: var(--text-primary);
	}

	.filter-pill.active {
		background: var(--color-accent-soft);
		color: var(--color-accent);
		border-color: var(--color-accent-border);
		font-weight: 600;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		text-align: center;
		color: var(--text-secondary);
		background: var(--bg-card);
		border: 1px dashed var(--border-color);
		border-radius: var(--radius-md);
		gap: 0.25rem;
	}

	.empty-state p {
		font-size: 0.8rem;
		font-weight: 500;
		margin: 0;
	}

	.empty-hint {
		font-size: 0.75rem !important;
		color: var(--text-muted);
	}

	/* Global View Active Banner */
	.global-view-banner {
		background: var(--color-accent-soft);
		border: 1px solid var(--color-accent-border);
		border-radius: var(--radius-md);
		padding: 0.75rem;
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		margin-bottom: 0.75rem;
		box-shadow: var(--shadow-sm);
	}

	.banner-icon {
		font-size: 1.1rem;
		line-height: 1.15;
	}

	.banner-text h5 {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-accent);
		margin: 0 0 0.15rem 0;
	}

	.banner-text p {
		font-size: 0.7rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.35;
	}

	.list-wrapper-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.2s ease;
	}

	.list-wrapper-container.disabled-view {
		opacity: 0.4;
		pointer-events: none;
		user-select: none;
		filter: grayscale(80%);
	}

	/* Selection list header */
	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #f4f4f5;
		padding-bottom: 0.5rem;
		margin-top: 0.5rem;
	}

	.count-badge {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-secondary);
		background: var(--bg-canvas);
		border: 1px solid var(--border-color);
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-sm);
	}

	.station-list {
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 400px;
		padding-right: 0.15rem;
		scrollbar-width: thin;
		scrollbar-color: var(--border-color) transparent;
	}

	.station-list::-webkit-scrollbar {
		width: 3px;
	}

	.station-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.station-list::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 99px;
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
		gap: 0.25rem;
		box-shadow: var(--shadow-sm);
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.station-card:hover {
		border-color: var(--border-color-hover);
		transform: translateY(-0.5px);
		box-shadow: var(--shadow-md);
	}

	.station-card.active {
		border-color: var(--color-accent);
		background-color: var(--color-accent-soft);
		box-shadow: 0 0 0 1px var(--color-accent), var(--shadow-sm);
	}

	.station-card.active .item-title {
		color: var(--color-accent);
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.item-title {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.star-badge {
		color: var(--color-warning);
		font-size: 0.75rem;
	}

	.item-meta {
		font-size: 0.7rem;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.dot {
		color: var(--text-muted);
	}

	/* Handled by .sidebar-card class */

	.bookmark-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.settings-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.import-area {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.25rem;
	}

	.import-area textarea {
		width: 100%;
		height: 50px;
		font-size: 0.7rem;
		font-family: monospace;
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: 0.35rem;
		resize: none;
		outline: none;
	}

	.import-area textarea:focus {
		border-color: var(--color-accent);
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

	.action-btn.sm {
		font-size: 0.7rem;
		padding: 0.25rem 0.5rem;
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
</style>
