import { client } from './client.js';

async function run() {
  console.log('[Test Query] Querying weather_stations...');
  try {
    const stationsResult = await client.query({
      query: 'SELECT station_id, name, country, first_year, last_year FROM weather_stations',
      format: 'JSONEachRow'
    });
    const stations = await stationsResult.json();
    console.log('[Test Query] Stations found in ClickHouse:', stations);

    console.log('[Test Query] Querying weather_records for london...');
    const recordsResult = await client.query({
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
        stationId: 'london',
        startYear: 1880,
        endYear: 2026
      },
      format: 'JSONEachRow'
    });
    const records = await recordsResult.json();
    console.log(`[Test Query] Records found: ${records.length}`);
    if (records.length > 0) {
      console.log('[Test Query] Sample records:', records.slice(0, 5));
    }
  } catch (error) {
    console.error('[Test Query] Error executing queries:', error);
  } finally {
    await client.close();
  }
}

run();
