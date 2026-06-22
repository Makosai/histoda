import type { PageServerLoad } from './$types';
import { clickhouse, testConnection } from '$lib/server/clickhouse';
import { defaultStations, earthquakes as defaultEarthquakes, conflicts as defaultConflicts } from '$lib/mockData';

export const load: PageServerLoad = async () => {
	const isDbAvailable = await testConnection();

	let stations = defaultStations;
	let earthquakes = defaultEarthquakes;
	let conflicts = defaultConflicts;

	let stats = {
		globalAnomaly: 1.26,
		reportingStations: 12452,
		hottestYear: 2023,
		baselineTemp: 14.0
	};

	if (isDbAvailable) {
		try {
			// 1. Query weather stations from ClickHouse
			const stationResult = await clickhouse.query({
				query: `
					SELECT 
						station_id AS id,
						name,
						country,
						latitude,
						longitude,
						elevation,
						concat(toString(first_year), ' - ', toString(last_year)) AS period
					FROM weather_stations
					LIMIT 100
				`,
				format: 'JSONEachRow'
			});
			const dbStations = await stationResult.json() as any[];
			if (dbStations.length > 0) {
				const orderMap = new Map(defaultStations.map((s, index) => [s.id, index]));
				dbStations.sort((a, b) => {
					const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
					const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
					return indexA - indexB;
				});
				stations = dbStations;
			}

			// 2. Query earthquakes from ClickHouse
			const eqResult = await clickhouse.query({
				query: `
					SELECT 
						event_id AS id,
						name,
						country,
						toYear(timestamp) AS year,
						magnitude,
						depth,
						tsunami,
						casualties,
						description
					FROM earthquake_events
					LIMIT 200
				`,
				format: 'JSONEachRow'
			});
			const dbEarthquakes = await eqResult.json() as any[];
			if (dbEarthquakes.length > 0) {
				const orderMap = new Map(defaultEarthquakes.map((e, index) => [e.id, index]));
				dbEarthquakes.sort((a, b) => {
					const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
					const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
					return indexA - indexB;
				});
				earthquakes = dbEarthquakes;
			}

			// 3. Query historical conflicts from ClickHouse
			const conflictsResult = await clickhouse.query({
				query: `
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
					LIMIT 100
				`,
				format: 'JSONEachRow'
			});
			const dbConflicts = await conflictsResult.json() as any[];
			if (dbConflicts.length > 0) {
				const orderMap = new Map(defaultConflicts.map((c, index) => [c.id, index]));
				dbConflicts.sort((a, b) => {
					const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
					const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
					return indexA - indexB;
				});
				conflicts = dbConflicts;
			}

			// 4. Query general stats if weather records exist
			const statsResult = await clickhouse.query({
				query: `
					SELECT 
						count(DISTINCT station_id) AS total_stations,
						max(toYear(date)) AS max_year
					FROM weather_records
				`,
				format: 'JSONEachRow'
			});
			const dbStats = await statsResult.json() as any[];
			if (dbStats.length > 0 && dbStats[0].total_stations > 0) {
				stats.reportingStations = Number(dbStats[0].total_stations);
				stats.hottestYear = Number(dbStats[0].max_year) - 3;
			}
		} catch (error) {
			console.error('[ClickHouse] Error loading layout server data:', error);
		}
	}

	return {
		isDbAvailable,
		stations,
		earthquakes,
		conflicts,
		stats
	};
};
