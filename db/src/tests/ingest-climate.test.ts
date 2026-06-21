process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import { client } from '../client.js';
import { ingestClimate } from '../ingest-climate.js';

test('Climate Ingest - Seeding and Incremental Loading', async (t) => {
  const queryLogs: string[] = [];
  const insertLogs: { table: string; values: any[] }[] = [];
  const fetchUrls: string[] = [];

  // Mock ClickHouse query method
  t.mock.method(client, 'query', async ({ query }: { query: string }) => {
    queryLogs.push(query.trim());

    // Mock response for weather stations check (simulate no stations exist)
    if (query.includes('FROM weather_stations')) {
      return {
        json: async () => []
      };
    }

    // Mock response for weather records gaps check (simulate missing dates)
    if (query.includes('LEFT ANTI JOIN')) {
      return {
        json: async () => [
          { missing_date: '1970-01-01' },
          { missing_date: '1970-01-02' }
        ]
      };
    }

    return {
      json: async () => []
    };
  });

  // Mock ClickHouse insert method
  t.mock.method(client, 'insert', async ({ table, values }: { table: string; values: any[] }) => {
    insertLogs.push({ table, values });
  });

  // Mock global fetch to return sample Open-Meteo payload
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    fetchUrls.push(url);
    
    // Extract start and end dates from URL
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const endDate = urlObj.searchParams.get('end_date');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        daily: {
          time: [startDate, endDate],
          temperature_2m_max: [10.5, 12.0],
          temperature_2m_min: [2.1, 4.5],
          temperature_2m_mean: [6.3, 8.25],
          precipitation_sum: [0.0, 1.2]
        }
      })
    } as any;
  });

  // Execute the Climate Ingest module
  await ingestClimate();

  // Assertions:
  
  // 1. Verify weather stations were seeded
  const stationInsert = insertLogs.find(log => log.table === 'weather_stations');
  assert.ok(stationInsert, 'Should have inserted records into weather_stations');
  assert.strictEqual(stationInsert.values.length, 1, 'Should insert stations one by one');
  
  // 2. Verify we check for missing dates for each target station
  const dateChecks = queryLogs.filter(q => q.includes('LEFT ANTI JOIN'));
  assert.strictEqual(dateChecks.length, 6, 'Should check missing dates for 6 target stations');

  // 3. Verify weather records were inserted
  const weatherInserts = insertLogs.filter(log => log.table === 'weather_records');
  assert.ok(weatherInserts.length > 0, 'Should have inserted weather records');
  
  // Verify structure of weather records
  const sampleRecord = weatherInserts[0].values[0];
  assert.ok(sampleRecord.station_id, 'Record should have station_id');
  assert.ok(sampleRecord.date, 'Record should have date');
  assert.strictEqual(sampleRecord.temp_max, 10.5);
  assert.strictEqual(sampleRecord.temp_min, 2.1);
  assert.strictEqual(sampleRecord.temp_avg, 6.3);
  assert.strictEqual(sampleRecord.precipitation, 0.0);
});

test('Climate Ingest - Chunking Large Date Ranges', async (t) => {
  const fetchUrls: string[] = [];

  // Mock ClickHouse queries (simulate last recorded date is long ago, forcing a large date span)
  t.mock.method(client, 'query', async ({ query }: { query: string }) => {
    if (query.includes('FROM weather_stations')) {
      // Simulate stations exist so we skip seeding stations
      return { json: async () => [{ station_id: 'london' }] };
    }
    if (query.includes('LEFT ANTI JOIN')) {
      // Simulate missing dates between 2015-01-02 and 2026-06-15 (~11.5 years)
      const dates: { missing_date: string }[] = [];
      const start = new Date('2015-01-02T00:00:00Z');
      const end = new Date('2026-06-15T00:00:00Z');
      let curr = new Date(start);
      while (curr <= end) {
        dates.push({ missing_date: curr.toISOString().substring(0, 10) });
        curr.setUTCDate(curr.getUTCDate() + 1);
      }
      return { json: async () => dates };
    }
    return { json: async () => [] };
  });

  t.mock.method(client, 'insert', async () => {});

  t.mock.method(globalThis, 'fetch', async (url: string) => {
    fetchUrls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        daily: {
          time: ['2015-01-02'],
          temperature_2m_max: [10.0],
          temperature_2m_min: [2.0],
          temperature_2m_mean: [6.0],
          precipitation_sum: [0.0]
        }
      })
    } as any;
  });

  await ingestClimate();

  // Assert that chunking split the requests:
  // London Heathrow (first station) span: 2015-01-02 to 2026-06-15
  // Chunk 1: 2015-01-02 to 2020-01-02
  // Chunk 2: 2020-01-03 to 2025-01-03
  // Chunk 3: 2025-01-04 to 2026-06-15
  // Since there are 6 stations in total, we should see multiple chunk fetches per station.
  assert.ok(fetchUrls.length > 6, 'Should make multiple chunked requests across stations');
  
  // Verify date parameters in the first station's chunk URLs
  const firstUrlObj = new URL(fetchUrls[0]);
  assert.strictEqual(firstUrlObj.searchParams.get('start_date'), '2015-01-02');
  assert.strictEqual(firstUrlObj.searchParams.get('end_date'), '2020-01-02');
  
  const secondUrlObj = new URL(fetchUrls[1]);
  assert.strictEqual(secondUrlObj.searchParams.get('start_date'), '2020-01-03');
  assert.strictEqual(secondUrlObj.searchParams.get('end_date'), '2025-01-03');
});
