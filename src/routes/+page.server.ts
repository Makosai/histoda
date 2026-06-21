import type { PageServerLoad } from './$types';
import { clickhouse, testConnection } from '$lib/server/clickhouse';

interface Station {
	id: string;
	name: string;
	country: string;
	latitude: number;
	longitude: number;
	elevation: number;
	period: string;
}

const defaultStations: Station[] = [
	{ id: 'tampa', name: 'Tampa International', country: 'United States', latitude: 27.9506, longitude: -82.4572, elevation: 8, period: '1880 - 2026' },
	{ id: 'new_york', name: 'New York Central Park', country: 'United States', latitude: 40.7829, longitude: -73.9654, elevation: 40, period: '1880 - 2026' },
	{ id: 'toronto', name: 'Toronto Pearson International', country: 'Canada', latitude: 43.6777, longitude: -79.6248, elevation: 173, period: '1880 - 2026' },
	{ id: 'lagos', name: 'Lagos International', country: 'Nigeria', latitude: 6.5774, longitude: 3.3212, elevation: 40, period: '1880 - 2026' },
	{ id: 'london', name: 'London Heathrow', country: 'United Kingdom', latitude: 51.4776, longitude: -0.4614, elevation: 25, period: '1880 - 2026' },
	{ id: 'tokyo', name: 'Tokyo International', country: 'Japan', latitude: 35.5533, longitude: 139.7811, elevation: 6, period: '1880 - 2026' },
	{ id: 'cairo', name: 'Cairo International', country: 'Egypt', latitude: 30.1219, longitude: 31.4056, elevation: 74, period: '1880 - 2026' },
	{ id: 'sydney', name: 'Sydney Observatory Hill', country: 'Australia', latitude: -33.8598, longitude: 151.2052, elevation: 39, period: '1880 - 2026' }
];

export const load: PageServerLoad = async () => {
	const isDbAvailable = await testConnection();

	let stations = defaultStations;
	let stats = {
		globalAnomaly: 1.26,
		reportingStations: 12452,
		hottestYear: 2023,
		baselineTemp: 14.0
	};

	if (isDbAvailable) {
		try {
			// Query weather stations from ClickHouse if configured
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
				stations = dbStations;
			}

			// Query general stats if records table has content
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
				stats.hottestYear = Number(dbStats[0].max_year) - 3; // Approx calculation
			}
		} catch (error) {
			console.error('[ClickHouse] Error loading layout server data:', error);
		}
	}

	return {
		isDbAvailable,
		stations,
		stats
	};
};
