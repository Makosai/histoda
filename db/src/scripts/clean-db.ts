import { client } from '../client.js';

async function run() {
  console.log('[Clean DB] Truncating weather_records table...');
  try {
    await client.exec({
      query: 'TRUNCATE TABLE weather_records',
      clickhouse_settings: {
        wait_end_of_query: 1
      }
    });
    console.log('[Clean DB] Table weather_records truncated successfully!');
  } catch (error) {
    console.error('[Clean DB] Failed to truncate table:', error);
  } finally {
    await client.close();
  }
}

run();
