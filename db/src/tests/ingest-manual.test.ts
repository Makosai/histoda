import test from 'node:test';
import assert from 'node:assert';
import { client } from '../client.js';
import { ingestManual } from '../ingest-manual.js';
import fs from 'fs';
import { Readable } from 'stream';

test('Manual Ingest - CSV Parsing and Loading Pipeline', async (t) => {
  const insertLogs: { table: string; values: any[] }[] = [];
  const archivedFiles: { src: string; dest: string }[] = [];

  // Mock existsSync
  t.mock.method(fs, 'existsSync', () => true);

  // Mock readdirSync to simulate two CSV files in uploads/
  t.mock.method(fs, 'readdirSync', () => {
    return [
      {
        isFile: () => true,
        name: 'climate_records_june.csv'
      },
      {
        isFile: () => true,
        name: 'earthquake_events_chile.csv'
      }
    ];
  });

  // Mock createReadStream to supply custom CSV rows matching the templates
  t.mock.method(fs, 'createReadStream', (filePath: string) => {
    let csvData = '';
    
    if (filePath.includes('climate')) {
      csvData = 'station_id,date,temp_max,temp_min,temp_avg,precipitation\n' +
                'london,2026-06-20,22.5,12.1,17.3,0.5\n' +
                'london,2026-06-21,24.0,,19.0,0.0\n'; // Missing temp_min to test Nullable
    } else if (filePath.includes('earthquake')) {
      csvData = 'event_id,name,country,timestamp,latitude,longitude,magnitude,depth,tsunami,casualties,description\n' +
                'test_eq,Test Quake,Chile,2026-06-20 12:00:00,-33.0,-71.5,7.2,15.5,1,10,A large test event\n';
    }

    return Readable.from([csvData]);
  });

  // Mock renameSync (moving to processed)
  t.mock.method(fs, 'renameSync', (src: string, dest: string) => {
    archivedFiles.push({ src, dest });
  });

  // Mock ClickHouse insertions
  t.mock.method(client, 'insert', async ({ table, values }: { table: string; values: any[] }) => {
    insertLogs.push({ table, values });
  });

  // Execute manual uploads processing
  await ingestManual();

  // Assertions:

  // 1. Verify two CSV files were processed and archived
  assert.strictEqual(archivedFiles.length, 2, 'Should have archived two processed files');
  assert.ok(archivedFiles[0].dest.includes('climate_records_june.csv'), 'Should archive climate CSV');
  assert.ok(archivedFiles[1].dest.includes('earthquake_events_chile.csv'), 'Should archive earthquake CSV');

  // 2. Verify climate data is parsed and batch-inserted
  const climateInsert = insertLogs.find(log => log.table === 'weather_records');
  assert.ok(climateInsert, 'Should have inserted climate records');
  assert.strictEqual(climateInsert.values.length, 2, 'Should insert 2 weather rows');
  
  const row1 = climateInsert.values[0];
  assert.strictEqual(row1.station_id, 'london');
  assert.strictEqual(row1.date, '2026-06-20');
  assert.strictEqual(row1.temp_max, 22.5);
  assert.strictEqual(row1.temp_min, 12.1);
  assert.strictEqual(row1.temp_avg, 17.3);
  assert.strictEqual(row1.precipitation, 0.5);

  const row2 = climateInsert.values[1];
  assert.strictEqual(row2.temp_min, null, 'Empty CSV columns should be parsed as null');
  assert.strictEqual(row2.temp_avg, 19.0);

  // 3. Verify earthquake data is parsed and batch-inserted
  const eqInsert = insertLogs.find(log => log.table === 'earthquake_events');
  assert.ok(eqInsert, 'Should have inserted earthquake events');
  assert.strictEqual(eqInsert.values.length, 1, 'Should insert 1 earthquake event row');

  const eqRow = eqInsert.values[0];
  assert.strictEqual(eqRow.event_id, 'test_eq');
  assert.strictEqual(eqRow.name, 'Test Quake');
  assert.strictEqual(eqRow.country, 'Chile');
  assert.strictEqual(eqRow.timestamp, '2026-06-20 12:00:00');
  assert.strictEqual(eqRow.latitude, -33.0);
  assert.strictEqual(eqRow.longitude, -71.5);
  assert.strictEqual(eqRow.magnitude, 7.2);
  assert.strictEqual(eqRow.depth, 15.5);
  assert.strictEqual(eqRow.tsunami, 1);
  assert.strictEqual(eqRow.casualties, 10);
  assert.strictEqual(eqRow.description, 'A large test event');
});
