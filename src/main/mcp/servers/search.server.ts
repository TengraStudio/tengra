import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildSearchServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'search',
            description: 'Advanced search capabilities across multiple sources',
            actions: buildActions([
                {
                    name: 'webSearch',
                    description: 'Search the web using configured provider',
                    handler: ({ query, numResults }) => deps.web.searchWeb(
                        query as string,
                        numResults as number | undefined
                    )
                }
            ], 'search', deps.auditLog)
        },
        {
            name: 'knowledge',
            description: 'Knowledge base and memory search',
            actions: buildActions([
                {
                    name: 'searchMemory',
                    description: 'Search through stored memories',
                    handler: ({ query, projectId, limit }) => deps.advancedMemory.recall({
                        query: query as string,
                        projectId: projectId as string | undefined,
                        limit: limit as number | undefined
                    })
                }
            ], 'knowledge', deps.auditLog)
        }
    ];
}
