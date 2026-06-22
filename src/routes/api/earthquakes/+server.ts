import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clickhouse, testConnection } from '$lib/server/clickhouse';
import { earthquakes as defaultEarthquakes, generateMockSeismic } from '$lib/mockData';

// Generate mock daily aftershocks count and magnitude decay using Omori's Law
function generateMockDecay(mainMagnitude: number): any[] {
	const data = [];
	const k = 40 * (mainMagnitude - 5.0); // scale factor based on magnitude
	const c = 0.5; // offset
	
	for (let day = 1; day <= 30; day++) {
		const baseFreq = k / (day + c);
		const frequency = Math.max(0, Math.floor(baseFreq + (Math.sin(day * 7) * (baseFreq * 0.2)) + (Math.random() * 2)));
		
		let mag = 0;
		if (frequency > 0) {
			const decayFactor = (day - 1) / 29;
			const maxPossibleMag = Math.max(3.5, mainMagnitude - 1.0 - (decayFactor * 2.5));
			mag = parseFloat((maxPossibleMag - (Math.random() * 0.8)).toFixed(1));
		}
		
		data.push({
			year: day, // map X-axis to day number
			mag,
			frequency
		});
	}
	return data;
}

export const GET: RequestHandler = async ({ url }) => {
	const eventId = url.searchParams.get('event_id') || 'valdivia';
	const view = url.searchParams.get('view') || 'event';

	const isDbAvailable = await testConnection();

	if (isDbAvailable) {
		try {
			if (view === 'global') {
				// Query all earthquakes grouped by year from 1880 to 2026
				const query = `
					SELECT 
						toYear(timestamp) AS year,
						round(max(magnitude), 2) AS mag,
						count() AS frequency
					FROM earthquake_events
					WHERE toYear(timestamp) >= 1880 AND toYear(timestamp) <= 2026
					GROUP BY year
					ORDER BY year ASC
				`;
				const resultSet = await clickhouse.query({ query, format: 'JSONEachRow' });
				const rows = await resultSet.json() as any[];

				if (rows.length > 0) {
					// Map to complete 1880-2026 range to fill potential gaps
					const dataMap = new Map(rows.map(r => [Number(r.year), r]));
					const completeData = [];
					for (let y = 1880; y <= 2026; y++) {
						if (dataMap.has(y)) {
							const r = dataMap.get(y)!;
							completeData.push({
								year: y,
								mag: Number(r.mag),
								frequency: Number(r.frequency)
							});
						} else {
							// Baseline background noise
							completeData.push({
								year: y,
								mag: 0.0,
								frequency: 0
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
				const subtype = url.searchParams.get('subtype') || 'decay';

				if (subtype === 'decay') {
					// Query event timestamp and details using ReplacingMergeTree FINAL
					const eventCheck = await clickhouse.query({
						query: `
							SELECT timestamp, magnitude 
							FROM earthquake_events FINAL
							WHERE event_id = {eventId: String}
							LIMIT 1
						`,
						query_params: { eventId },
						format: 'JSONEachRow'
					});
					const eventRows = await eventCheck.json() as any[];

					if (eventRows.length > 0) {
						const mainEvent = eventRows[0];
						const mainTime = new Date(mainEvent.timestamp.replace(' ', 'T') + 'Z');
						const mainMagnitude = Number(mainEvent.magnitude);

						// Query all aftershocks from ClickHouse
						const aftershocksQuery = await clickhouse.query({
							query: `
								SELECT timestamp, magnitude 
								FROM earthquake_aftershocks FINAL 
								WHERE parent_event_id = {eventId: String}
								ORDER BY timestamp ASC
							`,
							query_params: { eventId },
							format: 'JSONEachRow'
						});
						const asRows = await aftershocksQuery.json() as any[];

						// Aggregate daily for 30 days
						const completeData = Array.from({ length: 30 }, (_, i) => ({
							year: i + 1, // mapped to day
							mag: 0.0,
							frequency: 0
						}));

						for (const asRow of asRows) {
							const asTime = new Date(asRow.timestamp.replace(' ', 'T') + 'Z');
							const diffMs = asTime.getTime() - mainTime.getTime();
							const dayOffset = Math.floor(diffMs / (24 * 60 * 60 * 1000));
							if (dayOffset >= 0 && dayOffset < 30) {
								completeData[dayOffset].frequency += 1;
								completeData[dayOffset].mag = Math.max(completeData[dayOffset].mag, Number(asRow.magnitude));
							}
						}

						// Format magnitudes
						for (const d of completeData) {
							d.mag = parseFloat(d.mag.toFixed(1));
						}

						return json({
							source: 'clickhouse',
							view,
							eventId,
							subtype,
							data: completeData
						});
					}
				} else {
					// Query selected event details to get its country and year
					const eventCheck = await clickhouse.query({
						query: `
							SELECT country, toYear(timestamp) AS year 
							FROM earthquake_events FINAL
							WHERE event_id = {eventId: String}
							LIMIT 1
						`,
						query_params: { eventId },
						format: 'JSONEachRow'
					});
					const eventRows = await eventCheck.json() as any[];

					if (eventRows.length > 0) {
						const { country, year } = eventRows[0];
						const startYear = year - 15;
						const endYear = Math.min(2026, year + 15);

						// Query seismic events in that country during the 30-year window
						const query = `
							SELECT 
								toYear(timestamp) AS year,
								round(max(magnitude), 2) AS mag,
								count() AS frequency
							FROM earthquake_events FINAL
							WHERE country = {country: String}
							  AND toYear(timestamp) >= {startYear: UInt16}
							  AND toYear(timestamp) <= {endYear: UInt16}
							GROUP BY year
							ORDER BY year ASC
						`;
						const resultSet = await clickhouse.query({
							query,
							query_params: {
								country,
								startYear,
								endYear
							},
							format: 'JSONEachRow'
						});
						const rows = await resultSet.json() as any[];

						const dataMap = new Map(rows.map(r => [Number(r.year), r]));
						const completeData = [];

						for (let y = startYear; y <= endYear; y++) {
							if (dataMap.has(y)) {
								const r = dataMap.get(y)!;
								completeData.push({
									year: y,
									mag: Number(r.mag),
									frequency: Number(r.frequency)
								});
							} else {
								// Base background magnitude noise (usually minor: 1.0 to 3.5)
								let baseMag = 2.0 + (Math.sin(y * 17) * 0.6) + (Math.cos(y * 3) * 0.3);
								let freq = 10 + Math.floor(Math.sin(y * 2) * 4);
								
								// If this year matches the actual event year, overlay the event magnitude
								if (y === year) {
									const originalEvent = defaultEarthquakes.find(e => e.id === eventId);
									baseMag = originalEvent?.magnitude || 7.0;
									freq = 100; // Spike in aftershocks
								}

								completeData.push({
									year: y,
									mag: parseFloat(baseMag.toFixed(1)),
									frequency: freq
								});
							}
						}

						return json({
							source: 'clickhouse',
							view,
							eventId,
							subtype,
							data: completeData
						});
					}
				}
			}
		} catch (error) {
			console.error('[ClickHouse] Earthquakes query error:', error);
		}
	}

	// Fallback mock dataset
	if (view === 'global') {
		const mockGlobalData = [];
		for (let y = 1880; y <= 2026; y++) {
			// Detection count rises exponentially due to technology
			const progress = (y - 1880) / 146;
			const freq = Math.floor(200 + Math.pow(progress, 2.5) * 18000 + Math.sin(y * 11) * 300 + Math.random() * 400);
			let mag = 7.0 + Math.sin(y * 0.6) * 1.0 + Math.cos(y * 1.9) * 0.5 + Math.random() * 0.4;
			
			// Hardcode the famous spikes in fallback
			if (y === 1960) mag = 9.5; // Valdivia
			if (y === 1964) mag = 9.2; // Alaska
			if (y === 1976) mag = 7.5; // Tangshan
			if (y === 1995) mag = 6.9; // Kobe
			if (y === 2004) mag = 9.1; // Sumatra
			if (y === 2008) mag = 7.9; // Sichuan
			if (y === 2010) mag = 7.0; // Haiti
			if (y === 2011) mag = 9.0; // Tohoku
			if (y === 1906) mag = 7.9; // San Francisco

			mockGlobalData.push({
				year: y,
				mag: parseFloat(mag.toFixed(2)),
				frequency: freq
			});
		}

		return json({
			source: 'mock',
			view,
			data: mockGlobalData
		});
	} else {
		const matchedEvent = defaultEarthquakes.find(e => e.id === eventId) || defaultEarthquakes[0];
		const subtype = url.searchParams.get('subtype') || 'decay';

		if (subtype === 'decay') {
			const mockData = generateMockDecay(matchedEvent.magnitude);
			return json({
				source: 'mock',
				view,
				eventId,
				subtype,
				data: mockData
			});
		} else {
			const mockData = generateMockSeismic(matchedEvent);
			return json({
				source: 'mock',
				view,
				eventId,
				subtype,
				data: mockData
			});
		}
	}
};
