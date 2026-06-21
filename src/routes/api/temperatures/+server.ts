import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clickhouse, testConnection } from '$lib/server/clickhouse';

// Generated historical weather data (1880 to 2026)
// This serves as the fallback dataset if ClickHouse is not configured or empty.
interface TemperatureReading {
	year: number;
	globalAnomaly: number;
	tempAvg: number;
	tempMax: number;
	tempMin: number;
}

// Generate mock data dynamically
function generateMockData(cityId: string, startYear = 1880, endYear = 2026): TemperatureReading[] {
	const baseTemps: Record<string, { avg: number; range: number }> = {
		london: { avg: 10.2, range: 12.0 },
		tokyo: { avg: 15.4, range: 15.0 },
		new_york: { avg: 12.8, range: 18.0 },
		cairo: { avg: 22.1, range: 10.0 },
		sydney: { avg: 18.3, range: 8.0 }
	};

	const base = baseTemps[cityId] || { avg: 15.0, range: 10.0 };
	const data: TemperatureReading[] = [];

	for (let year = startYear; year <= endYear; year++) {
		// Global warming curve: starts slightly negative, rises sharply after 1970
		const progress = (year - 1880) / (2026 - 1880);
		const globalAnomalyBase = -0.3 + progress * 1.5; // -0.3 to +1.2
		// Add some natural variations / solar cycles
		const solarCycle = 0.08 * Math.sin((year * Math.PI) / 11);
		const volcanicDip = year === 1883 || year === 1991 ? -0.25 : 0;
		const randomNoise = (Math.sin(year * 13) * 0.12) + (Math.cos(year * 7) * 0.08);

		const globalAnomaly = parseFloat((globalAnomalyBase + solarCycle + volcanicDip + randomNoise).toFixed(3));

		// Calculate local temperatures based on the global anomaly
		const localAnomalyMultiplier = cityId === 'tokyo' || cityId === 'new_york' ? 1.3 : 0.9;
		const localAnomaly = globalAnomaly * localAnomalyMultiplier;

		const tempAvg = parseFloat((base.avg + localAnomaly + (Math.sin(year * 29) * 0.15)).toFixed(2));
		const tempMax = parseFloat((tempAvg + (base.range / 2) + 1.2 + (Math.cos(year * 19) * 0.6)).toFixed(2));
		const tempMin = parseFloat((tempAvg - (base.range / 2) - 1.2 + (Math.sin(year * 23) * 0.6)).toFixed(2));

		data.push({
			year,
			globalAnomaly,
			tempAvg,
			tempMax,
			tempMin
		});
	}

	return data;
}

export const GET: RequestHandler = async ({ url }) => {
	const stationId = url.searchParams.get('station_id') || 'london';
	let startYear = parseInt(url.searchParams.get('start_year') || '1880', 10);
	let endYear = parseInt(url.searchParams.get('end_year') || '2026', 10);

	if (isNaN(startYear)) startYear = 1880;
	if (isNaN(endYear)) endYear = 2026;

	const isDbAvailable = await testConnection();

	if (isDbAvailable) {
		try {
			// Query the database for temperature records
			const resultSet = await clickhouse.query({
				query: `
					SELECT 
						toYear(date) AS year,
						round(avg(temp_avg), 2) AS tempAvg,
						round(max(temp_max), 2) AS tempMax,
						round(min(temp_min), 2) AS tempMin
					FROM weather_records
					WHERE station_id = {stationId: String}
					  AND toYear(date) >= {startYear: UInt16}
					  AND toYear(date) <= {endYear: UInt16}
					GROUP BY year
					ORDER BY year ASC
				`,
				query_params: {
					stationId,
					startYear,
					endYear
				},
				format: 'JSONEachRow'
			});

			const rows = await resultSet.json() as any[];

			if (rows.length > 0) {
				// Inject calculated global anomaly for mock alignment
				const parsedRows = rows.map((row) => {
					const progress = (row.year - 1880) / (2026 - 1880);
					const baseAnomaly = -0.3 + progress * 1.5;
					return {
						year: Number(row.year),
						globalAnomaly: parseFloat((baseAnomaly + (Math.sin(row.year * 13) * 0.1)).toFixed(3)),
						tempAvg: Number(row.tempAvg),
						tempMax: Number(row.tempMax),
						tempMin: Number(row.tempMin)
					};
				});

				return json({
					source: 'clickhouse',
					stationId,
					data: parsedRows
				}, {
					headers: {
						'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600'
					}
				});
			} else {
				// ClickHouse is connected, but query returned 0 rows. Let's run diagnostics.
				const countResult = await clickhouse.query({
					query: 'SELECT count() as cnt FROM weather_records',
					format: 'JSONEachRow'
				});
				const countRows = await countResult.json() as any[];
				const totalRecords = countRows[0]?.cnt ? Number(countRows[0].cnt) : 0;

				const stationsResult = await clickhouse.query({
					query: 'SELECT DISTINCT station_id FROM weather_records LIMIT 10',
					format: 'JSONEachRow'
				});
				const dbStations = await stationsResult.json() as any[];
				const activeStations = dbStations.map((s: any) => s.station_id);

				const mockData = generateMockData(stationId, startYear, endYear);
				return json({
					source: 'mock',
					stationId,
					data: mockData,
					diagnostics: {
						clickhouseConnected: true,
						totalRecordsInDb: totalRecords,
						availableStationsInDb: activeStations,
						searchedStationId: stationId,
						searchedRange: `${startYear} - ${endYear}`
					}
				}, {
					headers: {
						'Cache-Control': 'no-store'
					}
				});
			}
		} catch (error: any) {
			console.error('[ClickHouse] Error querying records:', error);
			const mockData = generateMockData(stationId, startYear, endYear);
			return json({
				source: 'mock',
				stationId,
				data: mockData,
				diagnostics: {
					clickhouseConnected: true,
					error: error.message || String(error)
				}
			}, {
				headers: {
					'Cache-Control': 'no-store'
				}
			});
		}
	}

	// Fallback mock dataset (database completely unreachable)
	const mockData = generateMockData(stationId, startYear, endYear);
	return json({
		source: 'mock',
		stationId,
		data: mockData,
		diagnostics: {
			clickhouseConnected: false
		}
	}, {
		headers: {
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
