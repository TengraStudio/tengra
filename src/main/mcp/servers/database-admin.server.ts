import { buildActions, McpDeps, validateNumber } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildDatabaseAdminServer(deps: McpDeps): McpService {
    return {
        name: 'database-admin',
        description: 'Database diagnostics, schema checks, and query analytics',
        actions: buildActions([
            {
                name: 'queryAnalysis',
                description: 'Get aggregated query analysis (default limit=25, max=200)',
                handler: ({ limit }) => {
                    const safeLimit = limit !== undefined ? validateNumber(limit, 1, 200) : 25;
                    return {
                        success: true,
                        data: deps.database.getQueryAnalysis(safeLimit)
                    };
                }
            },
            {
                name: 'slowQueries',
                description: 'Get recent slow queries (default limit=25, max=200)',
                handler: ({ limit }) => {
                    const safeLimit = limit !== undefined ? validateNumber(limit, 1, 200) : 25;
                    return {
                        success: true,
                        data: deps.database.getSlowQueries(safeLimit)
                    };
                }
            },
            {
                name: 'schemaHealth',
                description: 'Validate schema and return summary',
                handler: async () => {
                    const result = await deps.database.validateSchema();
                    return { success: true, data: result };
                }
            },
            {
                name: 'clearQueryAnalytics',
                description: 'Reset query analytics counters',
                handler: async () => {
                    deps.database.clearQueryAnalytics();
                    return { success: true, data: { cleared: true } };
                }
            }
        ], 'database-admin', deps.auditLog)
    };
}

