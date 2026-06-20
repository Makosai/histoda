import { createClient } from '@clickhouse/client-web';
import { CLICKHOUSE_HOST, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD } from '$env/static/private';

// Initialize the ClickHouse client.
// Since we are running in SvelteKit (Cloudflare Workers/Pages environment),
// we use the HTTP/HTTPS endpoint of the ClickHouse server.
export const clickhouse = createClient({
	url: CLICKHOUSE_HOST,
	username: CLICKHOUSE_USER,
	password: CLICKHOUSE_PASSWORD
});

/**
 * Helper to test if ClickHouse is reachable and the database is configured.
 */
export async function testConnection(): Promise<boolean> {
	try {
		const resultSet = await clickhouse.query({
			query: 'SELECT 1',
			format: 'JSONEachRow'
		});
		const result = await resultSet.json();
		return Array.isArray(result) && result.length > 0;
	} catch (e) {
		console.warn('[ClickHouse] Connection check failed. Falling back to mock dataset.', e);
		return false;
	}
}
