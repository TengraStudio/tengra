import { buildActions, McpDeps, validateNumber, validateString } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

function buildSqlTemplate(goal: string, table: string, limit: number): string {
    const trimmedGoal = goal.toLowerCase();
    if (trimmedGoal.includes('count') || trimmedGoal.includes('total')) {
        return `SELECT COUNT(*) AS total FROM ${table};`;
    }
    if (trimmedGoal.includes('latest') || trimmedGoal.includes('recent')) {
        return `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ${limit};`;
    }
    return `SELECT * FROM ${table} LIMIT ${limit};`;
}

function buildIndexCandidates(slowQueries: Array<{ sql: string; durationMs: number }>): string[] {
    const candidates = new Set<string>();
    for (const query of slowQueries.slice(0, 10)) {
        const match = query.sql.match(/\bwhere\s+([a-zA-Z0-9_]+)/i);
        if (match?.[1]) {
            candidates.add(`CREATE INDEX IF NOT EXISTS idx_${match[1]}_ai ON <table_name>(${match[1]});`);
        }
    }
    return Array.from(candidates);
}

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
            },
            {
                name: 'planDatabaseAssistant',
                description: 'Generate NL query, performance, schema, anomaly, indexing, migration, backup, and health guidance',
                handler: async ({ goal, table, limit }) => {
                    const safeGoal = validateString(goal ?? 'List recent database records', 300);
                    const safeTable = validateString(table ?? 'messages', 120).replace(/[^a-zA-Z0-9_]/g, '');
                    const safeLimit = limit !== undefined ? validateNumber(limit, 1, 500) : 50;
                    const queryAnalysis = deps.database.getQueryAnalysis(25);
                    const slowQueries = deps.database.getSlowQueries(25);
                    const schemaHealth = await deps.database.validateSchema();
                    const queryRecommendations = deps.database.getQueryRecommendations(25);
                    const migrationStatus = await deps.database.getMigrationStatus();
                    const connectionHealth = await deps.database.getConnectionHealth(3000);
                    const replicationLag = await deps.database.getReplicationLagMetrics();
                    const indexCandidates = buildIndexCandidates(slowQueries);
                    const slowQueryRatio = queryAnalysis.length > 0
                        ? queryAnalysis.reduce((sum, entry) => sum + entry.slowCalls, 0) / queryAnalysis.length
                        : 0;

                    return {
                        success: true,
                        data: {
                            naturalLanguageQueryGeneration: {
                                goal: safeGoal,
                                sqlTemplate: buildSqlTemplate(safeGoal, safeTable || 'messages', safeLimit)
                            },
                            queryPerformanceAnalysis: queryAnalysis,
                            schemaOptimizationSuggestions: queryRecommendations.map(item => item.message),
                            dataAnomalyDetection: {
                                anomalyFlags: slowQueryRatio > 1 ? ['slow-query-spike'] : [],
                                slowQueryRatio,
                                sampleSlowQueries: slowQueries.slice(0, 5)
                            },
                            predictiveIndexing: { indexCandidates },
                            dataMigrationAssistant: {
                                migrationStatus,
                                nextStep: 'Run database-admin.runMigrations with dryRun=true before applying production migrations.'
                            },
                            backupStrategyRecommendations: [
                                'Enable encrypted, verified auto-backups with offsite sync.',
                                'Keep at least 7 daily + 4 weekly snapshots.',
                                'Test restore from latest backup weekly.'
                            ],
                            databaseHealthMonitoring: {
                                schemaHealth,
                                connectionHealth,
                                replicationLag
                            }
                        }
                    };
                }
            }
        ], 'database-admin', deps.auditLog)
    };
}
