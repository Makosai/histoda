import { client } from './client.js';

const isTest = process.env.NODE_ENV === 'test';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, isTest ? 0 : ms));

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
  { station_id: 'sydney', name: 'Sydney Observatory Hill', country: 'Australia', latitude: -33.8598, longitude: 151.2052, elevation: 39, first_year: 1970, last_year: 2026 },
  { station_id: 'tampa', name: 'Tampa International', country: 'United States', latitude: 27.9506, longitude: -82.4572, elevation: 8, first_year: 1970, last_year: 2026 }
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

function groupContiguousDates(sortedDates: string[]): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  if (sortedDates.length === 0) {
    return ranges;
  }

  let rangeStart = sortedDates[0];
  let prevDate = new Date(rangeStart + 'T00:00:00Z');

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i] + 'T00:00:00Z');
    const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      ranges.push({
        start: rangeStart,
        end: prevDate.toISOString().substring(0, 10)
      });
      rangeStart = sortedDates[i];
    }
    prevDate = currentDate;
  }

  ranges.push({
    start: rangeStart,
    end: prevDate.toISOString().substring(0, 10)
  });

  return ranges;
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

    // 2. Query weather records to detect missing date ranges (self-healing backfill)
    for (const station of targetStations) {
      const today = new Date();
      // Open-Meteo archive data takes 2-3 days to be fully verified, so query up to 5 days ago to be safe
      today.setUTCDate(today.getUTCDate() - 5);
      const endDateStr = today.toISOString().substring(0, 10);
      const startDateStr = `${station.first_year}-01-01`;

      console.log(`[Ingest: Climate] Checking for missing weather records for ${station.name} from ${startDateStr} to ${endDateStr}...`);

      const missingDatesResult = await client.query({
        query: `
          SELECT expected.date AS missing_date
          FROM (
              SELECT arrayJoin(
                  arrayMap(
                      x -> toDate(x),
                      range(toInt32(toDate({startDate: String})), toInt32(toDate({endDate: String})) + 1)
                  )
              ) AS date
          ) AS expected
          LEFT ANTI JOIN (
              SELECT date 
              FROM weather_records 
              WHERE station_id = {stationId: String}
          ) AS existing
          ON expected.date = existing.date
          ORDER BY missing_date ASC
        `,
        query_params: {
          startDate: startDateStr,
          endDate: endDateStr,
          stationId: station.station_id
        },
        format: 'JSONEachRow'
      });

      const missingRows = await missingDatesResult.json() as { missing_date: string }[];
      const missingDates = missingRows.map(r => {
        return typeof r.missing_date === 'string' ? r.missing_date.substring(0, 10) : r.missing_date;
      });

      if (missingDates.length === 0) {
        console.log(`[Ingest: Climate] Station ${station.name} is already fully up to date.`);
        continue;
      }

      const ranges = groupContiguousDates(missingDates);
      console.log(`[Ingest: Climate] Found ${missingDates.length} missing days for ${station.name}, grouped into ${ranges.length} range(s).`);

      let stationFailed = false;

      for (const range of ranges) {
        if (stationFailed) {
          break;
        }

        console.log(`[Ingest: Climate] Scraping missing range: ${range.start} to ${range.end}...`);
        
        let currentStart = new Date(range.start + 'T00:00:00Z');
        const end = new Date(range.end + 'T00:00:00Z');

        while (currentStart <= end) {
          // Calculate end date for this chunk (max 5 years)
          let currentEnd = new Date(currentStart);
          currentEnd.setUTCFullYear(currentEnd.getUTCFullYear() + 5);
          if (currentEnd > end) {
            currentEnd = new Date(end);
          }
          
          const chunkStartStr = currentStart.toISOString().substring(0, 10);
          const chunkEndStr = currentEnd.toISOString().substring(0, 10);
          
          console.log(`  -> Fetching chunk: ${chunkStartStr} to ${chunkEndStr}...`);
          
          const openMeteoUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${station.latitude}&longitude=${station.longitude}&start_date=${chunkStartStr}&end_date=${chunkEndStr}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=GMT`;
          
          let retries = 5;
          let res: Response | null = null;
          let delayMs = 2000;

          while (retries > 0) {
            try {
              res = await fetch(openMeteoUrl);
              if (res.ok) {
                break;
              }
              if (res.status === 429) {
                console.warn(`[Ingest: Climate] Rate limit (429) hit for ${station.name}. Retrying in ${delayMs}ms... (${retries - 1} retries left)`);
                await delay(delayMs);
                retries--;
                delayMs *= 2;
              } else {
                console.warn(`[Ingest: Climate] HTTP error ${res.status} for ${station.name}. Retrying in ${delayMs}ms... (${retries - 1} retries left)`);
                await delay(delayMs);
                retries--;
                delayMs *= 2;
              }
            } catch (fetchErr) {
              console.warn(`[Ingest: Climate] Network error for ${station.name}. Retrying in ${delayMs}ms... (${retries - 1} retries left)`, fetchErr);
              await delay(delayMs);
              retries--;
              delayMs *= 2;
            }
          }

          if (!res || !res.ok) {
            console.error(`[Ingest: Climate] Failed to fetch climate records for ${station.name} (${chunkStartStr} to ${chunkEndStr}) after retries. Aborting station ingestion to prevent database gaps.`);
            stationFailed = true;
            break;
          }
          
          const data = await res.json() as OpenMeteoResponse;
          const daily = data.daily;
          if (!daily || !daily.time || daily.time.length === 0) {
            console.log(`  -> No data returned for this chunk.`);
          } else {
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
            
            console.log(`  -> Ingesting ${values.length} records into weather_records...`);
            await client.insert({
              table: 'weather_records',
              values: values,
              format: 'JSONEachRow'
            });
          }
          
          // Advance to the next day after currentEnd
          currentStart = new Date(currentEnd);
          currentStart.setUTCDate(currentStart.getUTCDate() + 1);

          // Sleep for 1000ms between requests to be polite and avoid rate limits
          await delay(1000);
        }
      }
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
