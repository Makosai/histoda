import test from 'node:test';
import assert from 'node:assert';
import { client } from '../client.js';
import { ingestConflicts } from '../ingest-conflicts.js';

test('Conflicts Ingest - Seeds Static conflicts list', async (t) => {
  const queryLogs: string[] = [];
  const insertLogs: { table: string; values: any[] }[] = [];

  // Mock ClickHouse queries
  t.mock.method(client, 'query', async ({ query }: { query: string }) => {
    queryLogs.push(query.trim());

    // Mock response for existing conflicts (simulate WW2 already exists in database)
    if (query.includes('FROM historical_conflicts')) {
      return {
        json: async () => [{ conflict_id: 'ww2' }]
      };
    }

    return { json: async () => [] };
  });

  // Mock ClickHouse inserts
  t.mock.method(client, 'insert', async ({ table, values }: { table: string; values: any[] }) => {
    insertLogs.push({ table, values });
  });

  // Run Conflicts Seeder
  await ingestConflicts();

  // Assertions:
  
  // 1. Verify existence check was executed
  assert.ok(queryLogs.some(q => q.includes('FROM historical_conflicts')), 'Should query existing conflict IDs');

  // 2. Verify bulk insert called and filtered out duplicates
  const conflictsInsert = insertLogs.find(log => log.table === 'historical_conflicts');
  assert.ok(conflictsInsert, 'Should have inserted records into historical_conflicts');
  
  // WW2 should be filtered out since we simulated it as already existing in the database
  const ww2Record = conflictsInsert.values.find(c => c.conflict_id === 'ww2');
  assert.strictEqual(ww2Record, undefined, 'WW2 should be skipped because it is already in the database');

  // WW1 and Napoleonic wars should be inserted
  const ww1Record = conflictsInsert.values.find(c => c.conflict_id === 'ww1');
  assert.ok(ww1Record, 'WW1 should be included in the inserted values');
  assert.strictEqual(ww1Record.name, 'World War I');
  assert.strictEqual(ww1Record.start_year, 1914);
  assert.strictEqual(ww1Record.end_year, 1918);
  assert.ok(Array.isArray(ww1Record.combatants), 'combatants should be an array');
});
