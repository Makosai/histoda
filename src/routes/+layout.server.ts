import type { LayoutServerLoad } from './$types';
import { testConnection } from '$lib/server/clickhouse';

export const load: LayoutServerLoad = async () => {
	const isDbAvailable = await testConnection();

	return {
		isDbAvailable
	};
};
