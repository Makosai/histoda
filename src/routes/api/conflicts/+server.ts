import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clickhouse, testConnection } from '$lib/server/clickhouse';
import { conflicts as defaultConflicts, generateMockConflict } from '$lib/mockData';

export const GET: RequestHandler = async ({ url }) => {
	const conflictId = url.searchParams.get('conflict_id') || 'ww2';
	const view = url.searchParams.get('view') || 'event';

	const isDbAvailable = await testConnection();

	if (isDbAvailable) {
		try {
			if (view === 'global') {
				// Query active wars and casualties per year since 1920
				const query = `
					SELECT 
						year,
						count() AS active_wars,
						sum(casualties) AS total_casualties
					FROM (
						SELECT 
							arrayJoin(range(start_year, greatest(start_year, end_year) + 1)) AS year,
							casualties
						FROM historical_conflicts
					)
					WHERE year >= 1920 AND year <= 2026
					GROUP BY year
					ORDER BY year ASC
				`;
				const resultSet = await clickhouse.query({ query, format: 'JSONEachRow' });
				const rows = await resultSet.json() as any[];

				if (rows.length > 0) {
					const dataMap = new Map(rows.map(r => [Number(r.year), r]));
					const completeData = [];
					for (let y = 1920; y <= 2026; y++) {
						if (dataMap.has(y)) {
							const r = dataMap.get(y)!;
							completeData.push({
								year: y,
								activeWars: Number(r.active_wars),
								totalCasualties: Number(r.total_casualties)
							});
						} else {
							completeData.push({
								year: y,
								activeWars: 0,
								totalCasualties: 0
							});
						}
					}

					return json({
						source: 'clickhouse',
						view,
						data: completeData
					});
				}
			} else {
				// Query details of selected conflict
				const query = `
					SELECT 
						conflict_id AS id,
						name,
						region,
						start_year AS startYear,
						end_year AS endYear,
						combatants,
						casualties,
						duration,
						description
					FROM historical_conflicts
					WHERE conflict_id = {conflictId: String}
					LIMIT 1
				`;
				const resultSet = await clickhouse.query({
					query,
					query_params: { conflictId },
					format: 'JSONEachRow'
				});
				const dbRows = await resultSet.json() as any[];

				if (dbRows.length > 0) {
					const conflict = dbRows[0];
					// Generate the timeline timeline based on startYear, endYear, and casualties
					const start = Number(conflict.startYear);
					const end = Number(conflict.endYear);
					const timelineData = [];

					for (let y = start - 5; y <= Math.min(2026, end + 5); y++) {
						let battleCount = 0;
						let intensity = 0;

						if (y >= start && y <= end) {
							const progress = end === start ? 1 : (y - start) / (end - start);
							// Curve intensity peaks in the middle of the conflict
							intensity = 40 + Math.sin(progress * Math.PI) * 50 + (Math.cos(y * 5) * 10);
							battleCount = Math.floor(intensity / 3) + 2;
						} else {
							// Skirmish noise
							intensity = 2 + Math.floor(Math.abs(Math.sin(y * 11) * 3));
							battleCount = intensity > 3 ? 1 : 0;
						}

						timelineData.push({
							year: y,
							intensity: parseFloat(intensity.toFixed(1)),
							battleCount
						});
					}

					return json({
						source: 'clickhouse',
						view,
						conflictId,
						data: timelineData
					});
				}
			}
		} catch (error) {
			console.error('[ClickHouse] Conflicts query error:', error);
		}
	}

	// Fallback mock dataset
	if (view === 'global') {
		const mockGlobalData = [];
		for (let y = 1920; y <= 2026; y++) {
			let activeWars = 0;
			let casualties = 0;

			// Define mock overlapping active wars per era
			if (y >= 1939 && y <= 1945) {
				activeWars += 1; // WWII
				casualties += 12000000;
			}
			if (y >= 1914 && y <= 1918) { // Range 1920+ check, but safe fallback
				activeWars += 1;
				casualties += 5000000;
			}
			if (y >= 1950 && y <= 1953) {
				activeWars += 1; // Korean War
				casualties += 1000000;
			}
			if (y >= 1955 && y <= 1975) {
				activeWars += 1; // Vietnam War
				casualties += 200000;
			}
			if (y >= 1980 && y <= 1988) {
				activeWars += 1; // Iran-Iraq War (Illustrative)
				casualties += 150000;
			}
			if (y >= 2001 && y <= 2021) {
				activeWars += 1; // Afghanistan War
				casualties += 10000;
			}
			
			// Background random noise
			activeWars += (y % 15 === 0) ? 1 : 0;
			casualties += Math.floor(Math.random() * 5000) + 1000;

			mockGlobalData.push({
				year: y,
				activeWars,
				totalCasualties: casualties
			});
		}

		return json({
			source: 'mock',
			view,
			data: mockGlobalData
		});
	} else {
		const matchedConflict = defaultConflicts.find(c => c.id === conflictId) || defaultConflicts[0];
		const mockData = generateMockConflict(matchedConflict);
		return json({
			source: 'mock',
			view,
			conflictId,
			data: mockData
		});
	}
};
