import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import dns from 'node:dns';
import { join } from 'path';

// Load local .env if present (useful when running scripts outside Docker)
dotenv.config(); // CWD
// Also load parent .env if running from the db/ subdirectory
dotenv.config({ path: join(process.cwd(), '../.env') });
dotenv.config({ path: join(process.cwd(), 'db/.env') });

// Configure DNS resolution order based on env variables (defaults to ipv4first to avoid Docker IPv6 network timeouts)
const dnsOrder = (process.env.DNS_RESOLUTION_ORDER || process.env.DNS_ORDER || 'ipv4first').toLowerCase();
if (dnsOrder === 'ipv4first' || dnsOrder === 'ipv4') {
  dns.setDefaultResultOrder('ipv4first');
} else if (dnsOrder === 'verbatim' || dnsOrder === 'ipv6') {
  dns.setDefaultResultOrder('verbatim');
}

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
