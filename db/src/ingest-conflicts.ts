import { client } from './client.js';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ConflictRecord {
  id: string;
  name: string;
  region: string;
  startYear: number;
  endYear: number;
  combatants: string[];
  casualties: number;
  duration: string;
  description: string;
}

async function run() {
  console.log('[Ingest: Conflicts] Starting conflicts ingestion...');
  
  try {
    // Read conflicts JSON file
    const filePath = join(process.cwd(), 'src/conflicts.json');
    const rawData = readFileSync(filePath, 'utf-8');
    const conflicts = JSON.parse(rawData) as ConflictRecord[];
    
    // Check existing conflict IDs in the database
    const existingResult = await client.query({
      query: 'SELECT conflict_id FROM historical_conflicts',
      format: 'JSONEachRow'
    });
    const existingRows = await existingResult.json() as { conflict_id: string }[];
    const existingIds = new Set(existingRows.map(r => r.conflict_id));
    
    // Filter out conflicts that are already inserted
    const newConflicts = conflicts.filter(c => !existingIds.has(c.id));
    
    if (newConflicts.length === 0) {
      console.log('[Ingest: Conflicts] Database is already up to date. No new conflicts to insert.');
      return;
    }
    
    console.log(`[Ingest: Conflicts] Inserting ${newConflicts.length} new conflict(s)...`);
    
    // Bulk insert into ClickHouse
    await client.insert({
      table: 'historical_conflicts',
      values: newConflicts.map(c => ({
        conflict_id: c.id,
        name: c.name,
        region: c.region,
        start_year: c.startYear,
        end_year: c.endYear,
        combatants: c.combatants,
        casualties: c.casualties,
        duration: c.duration,
        description: c.description
      })),
      format: 'JSONEachRow'
    });
    
    console.log('[Ingest: Conflicts] Conflicts ingestion completed successfully!');
  } catch (error) {
    console.error('[Ingest: Conflicts] Failed during ingestion:', error);
    process.exit(1);
  }
}

// Check if running directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.endsWith('ingest-conflicts.ts')) {
  run().then(() => client.close());
}

export { run as ingestConflicts };
