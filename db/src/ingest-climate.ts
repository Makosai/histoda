import { client } from './client.js';

interface ClimateStation {
  station_id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation: number;
  first_year: number;
  last_year: number;
}

const targetStations: ClimateStation[] = [
  { station_id: 'london', name: 'London Heathrow', country: 'United Kingdom', latitude: 51.4776, longitude: -0.4614, elevation: 25, first_year: 1970, last_year: 2026 },
  { station_id: 'tokyo', name: 'Tokyo International', country: 'Japan', latitude: 35.5533, longitude: 139.7811, elevation: 6, first_year: 1970, last_year: 2026 },
  { station_id: 'new_york', name: 'New York Central Park', country: 'United States', latitude: 40.7829, longitude: -73.9654, elevation: 40, first_year: 1970, last_year: 2026 },
  { station_id: 'cairo', name: 'Cairo International', country: 'Egypt', latitude: 30.1219, longitude: 31.4056, elevation: 74, first_year: 1970, last_year: 2026 },
  { station_id: 'sydney', name: 'Sydney Observatory Hill', country: 'Australia', latitude: -33.8598, longitude: 151.2052, elevation: 39, first_year: 1970, last_year: 2026 }
];

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    temperature_2m_mean: (number | null)[];
    precipitation_sum: (number | null)[];
  };
}

async function run() {
  console.log('[Ingest: Climate] Starting climate data ingestion...');

  try {
    // 1. Seed weather stations if missing
    for (const station of targetStations) {
      const existCheck = await client.query({
        query: `SELECT station_id FROM weather_stations WHERE station_id = '${station.station_id}'`,
        format: 'JSONEachRow'
      });
      const rows = await existCheck.json();
      if (rows.length === 0) {
        console.log(`[Ingest: Climate] Seeding station: ${station.name}`);
        await client.insert({
          table: 'weather_stations',
          values: [station],
          format: 'JSONEachRow'
        });
      }
    }

    // 2. Query weather records incrementally per station
    for (const station of targetStations) {
      const maxResult = await client.query({
        query: `SELECT max(date) as max_date FROM weather_records WHERE station_id = '${station.station_id}'`,
        format: 'JSONEachRow'
      });
      const maxRows = await maxResult.json() as { max_date: string }[];
      
      let startDateStr = '1970-01-01';
      if (maxRows[0]?.max_date && maxRows[0].max_date !== '1970-01-01' && maxRows[0].max_date !== '0000-00-00') {
        const lastDate = new Date(maxRows[0].max_date + 'T00:00:00Z');
        lastDate.setUTCDate(lastDate.getUTCDate() + 1);
        startDateStr = lastDate.toISOString().substring(0, 10);
      }

      const today = new Date();
      // Open-Meteo archive data takes 2-3 days to be fully verified, so query up to 5 days ago to be safe
      today.setUTCDate(today.getUTCDate() - 5);
      const endDateStr = today.toISOString().substring(0, 10);

      if (startDateStr >= endDateStr) {
        console.log(`[Ingest: Climate] Station ${station.name} is already up to date.`);
        continue;
      }

      console.log(`[Ingest: Climate] Scraping daily weather for ${station.name} from ${startDateStr} to ${endDateStr}...`);
      
      const openMeteoUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${station.latitude}&longitude=${station.longitude}&start_date=${startDateStr}&end_date=${endDateStr}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=GMT`;
      
      const res = await fetch(openMeteoUrl);
      if (!res.ok) {
        console.error(`[Ingest: Climate] Failed to fetch climate records for ${station.name}: status ${res.status}`);
        continue;
      }

      const data = await res.json() as OpenMeteoResponse;
      const daily = data.daily;
      if (!daily || !daily.time || daily.time.length === 0) {
        console.log(`[Ingest: Climate] No data returned for ${station.name}`);
        continue;
      }

      const values = daily.time.map((time, idx) => {
        return {
          station_id: station.station_id,
          date: time,
          temp_max: daily.temperature_2m_max[idx],
          temp_min: daily.temperature_2m_min[idx],
          temp_avg: daily.temperature_2m_mean[idx],
          precipitation: daily.precipitation_sum[idx]
        };
      });

      console.log(`[Ingest: Climate] Ingesting ${values.length} records into weather_records for ${station.name}...`);
      
      await client.insert({
        table: 'weather_records',
        values: values,
        format: 'JSONEachRow'
      });
    }

    console.log('[Ingest: Climate] Climate data ingestion completed successfully!');
  } catch (error) {
    console.error('[Ingest: Climate] Failed during ingestion:', error);
    process.exit(1);
  }
}

// Check if running directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('ingest-climate.ts')) {
  run().then(() => client.close());
}

export { run as ingestClimate };
