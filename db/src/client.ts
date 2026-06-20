import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';

// Load local .env if present (useful when running scripts outside Docker)
dotenv.config();

const host = process.env.CLICKHOUSE_HOST || 'localhost';
const port = process.env.CLICKHOUSE_PORT || '8123';
const username = process.env.CLICKHOUSE_USER || 'default';
const password = process.env.CLICKHOUSE_PASSWORD || '';

const clickhouseHost = host.startsWith('http') ? host : `http://${host}:${port}`;

console.log(`[ClickHouse Client] Connecting to: ${clickhouseHost} as user: ${username}`);

export const client = createClient({
  url: clickhouseHost,
  username: username,
  password: password,
  database: 'default',
  clickhouse_settings: {
    // Enable multi-statement queries if needed, or adjust timeout settings
    max_execution_time: 60,
  }
});
