import test from 'node:test';
import assert from 'node:assert';
import { client } from '../client.js';
import { ingestEarthquakes } from '../ingest-earthquakes.js';

test('Earthquake Ingest - Seeding Famous Events and Ingesting API Responses', async (t) => {
  const queryLogs: string[] = [];
  const insertLogs: { table: string; values: any[] }[] = [];
  const fetchUrls: string[] = [];

  // Mock ClickHouse queries
  t.mock.method(client, 'query', async ({ query }: { query: string }) => {
    queryLogs.push(query.trim());

    // Mock response for famous seeds exist check (return empty to force seeding)
    if (query.includes("event_id = 'valdivia'") || query.includes("event_id = 'alaska'") || 
        query.includes("event_id = 'sumatra'") || query.includes("event_id = 'tohoku'") || 
        query.includes("event_id = 'san_francisco'")) {
      return { json: async () => [] };
    }

    // Mock response for max timestamp check
    if (query.includes('max(timestamp)')) {
      return { json: async () => [{ max_ts: '2024-06-01 12:00:00' }] };
    }

    return { json: async () => [] };
  });

  // Mock ClickHouse inserts
  t.mock.method(client, 'insert', async ({ table, values }: { table: string; values: any[] }) => {
    insertLogs.push({ table, values });
  });

  // Mock USGS GeoJSON API response
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    fetchUrls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          {
            id: 'us6000test',
            properties: {
              title: 'M 6.4 - 15km N of Valparaiso, Chile',
              place: '15km N of Valparaiso, Chile',
              time: 1718884800000, // 2024-06-20T12:00:00.000Z
              mag: 6.4,
              tsunami: 1
            },
            geometry: {
              coordinates: [-71.6, -32.9, 25.0] // [lon, lat, depth]
            }
          }
        ]
      })
    } as any;
  });

  // Execute the Earthquake Ingest module
  await ingestEarthquakes();

  // Assertions:
  
  // 1. Verify famous historical seeds were processed
  const seedInserts = insertLogs.filter(log => log.table === 'earthquake_events' && log.values[0].event_id === 'valdivia');
  assert.strictEqual(seedInserts.length, 1, 'Should have inserted Valdivia earthquake seed');
  assert.strictEqual(seedInserts[0].values[0].magnitude, 9.5, 'Valdivia magnitude should match seed');

  // 2. Verify incremental loading parameters in API call
  assert.strictEqual(fetchUrls.length, 1, 'Should have made 1 fetch call to USGS API');
  const queryUrl = new URL(fetchUrls[0]);
  
  // Max timestamp in DB was '2024-06-01 12:00:00'. Add 1 second -> '2024-06-01T12:00:01.000Z'
  const startTime = queryUrl.searchParams.get('starttime');
  assert.ok(startTime, 'Query URL should contain starttime');
  assert.ok(startTime.startsWith('2024-06-01T12:00:01'), `Query start time mismatch, got: ${startTime}`);
  assert.strictEqual(queryUrl.searchParams.get('minmagnitude'), '6.0', 'Should filter minmagnitude by 6.0+');

  // 3. Verify USGS GeoJSON data is correctly parsed and bulk inserted
  const eventInsert = insertLogs.find(log => log.table === 'earthquake_events' && log.values[0].event_id === 'us6000test');
  assert.ok(eventInsert, 'Should have inserted USGS test earthquake into database');
  
  const parsedEvent = eventInsert.values[0];
  assert.strictEqual(parsedEvent.name, '15km N of Valparaiso, Chile', 'Should extract clean name');
  assert.strictEqual(parsedEvent.country, 'Chile', 'Should parse country name correctly');
  assert.strictEqual(parsedEvent.magnitude, 6.4);
  assert.strictEqual(parsedEvent.depth, 25.0);
  assert.strictEqual(parsedEvent.latitude, -32.9);
  assert.strictEqual(parsedEvent.longitude, -71.6);
  assert.strictEqual(parsedEvent.tsunami, 1);
  assert.strictEqual(parsedEvent.casualties, 0);
  assert.ok(parsedEvent.timestamp.startsWith('2024-06-20'), 'Should convert epoch to ClickHouse timestamp');
});
