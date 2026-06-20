import { client } from './client.js';
import { ingestClimate } from './ingest-climate.js';
import { ingestEarthquakes } from './ingest-earthquakes.js';
import { ingestConflicts } from './ingest-conflicts.js';
import { ingestManual } from './ingest-manual.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function initializeDatabase() {
  console.log('[Scheduler] Ensuring database tables exist...');
  try {
    // Check for monthly partitions on existing tables and drop them to migrate to yearly partitions
    try {
      const tablesToCheck = ['weather_records', 'earthquake_events'];
      for (const table of tablesToCheck) {
        const checkQuery = await client.query({
          query: `SELECT partition_key FROM system.tables WHERE database = currentDatabase() AND name = '${table}'`,
          format: 'JSONEachRow'
        });
        const rows = await checkQuery.json() as { partition_key: string }[];
        if (rows.length > 0) {
          const pKey = rows[0].partition_key;
          if (pKey.includes('toYYYYMM')) {
            console.log(`[Scheduler] Legacy partition key "${pKey}" detected for table "${table}". Dropping for schema update...`);
            await client.exec({
              query: `DROP TABLE IF EXISTS ${table}`,
              clickhouse_settings: { wait_end_of_query: 1 }
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Scheduler] Skipping legacy partition check:', err);
    }

    const schemaPath = join(process.cwd(), 'init/schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');

    // Split queries by semicolon, cleaning up comments and whitespace
    const queries = schemaSql
      .split(';')
      .map(q => {
        // Strip line comments
        return q
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter(q => q.length > 0);

    for (const query of queries) {
      console.log(`[Scheduler] Checking/creating table schema...`);
      await client.exec({
        query: query,
        clickhouse_settings: {
          wait_end_of_query: 1
        }
      });
    }
    console.log('[Scheduler] Database schema verification completed.');
  } catch (error) {
    console.error('[Scheduler] Database schema initialization failed:', error);
    throw error;
  }
}

async function triggerUpdates() {
  console.log('\n==================================================');
  console.log(`[Scheduler] Triggering scheduled data collection cycle at: ${new Date().toISOString()}`);
  console.log('==================================================\n');

  try {
    console.log('[Scheduler] Running Climate Scraper...');
    await ingestClimate();
  } catch (err) {
    console.error('[Scheduler] Climate Scraper failed, continuing...', err);
  }

  try {
    console.log('[Scheduler] Running Earthquakes Scraper...');
    await ingestEarthquakes();
  } catch (err) {
    console.error('[Scheduler] Earthquakes Scraper failed, continuing...', err);
  }

  try {
    console.log('[Scheduler] Running Conflicts Seed...');
    await ingestConflicts();
  } catch (err) {
    console.error('[Scheduler] Conflicts Seed failed, continuing...', err);
  }

  try {
    console.log('[Scheduler] Running Manual Uploads Scanner...');
    await ingestManual();
  } catch (err) {
    console.error('[Scheduler] Manual Uploads Scanner failed, continuing...', err);
  }

  console.log('\n==================================================');
  console.log(`[Scheduler] Ingestion cycle complete. Next update scheduled in 24 hours.`);
  console.log('==================================================\n');
}

async function run() {
  console.log('==================================================');
  console.log('[Scheduler] HISTODA Database Daemon Starting...');
  console.log('==================================================');

  // Make sure schemas exist first
  await initializeDatabase();

  // Initial seed run on container startup
  await triggerUpdates();

  // Set interval to run incrementally every 24 hours
  setInterval(async () => {
    await triggerUpdates();
  }, UPDATE_INTERVAL_MS);
}

run().catch((err) => {
  console.error('[Scheduler] Fatal error in background daemon:', err);
  process.exit(1);
});
