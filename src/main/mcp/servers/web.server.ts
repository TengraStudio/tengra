import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildWebServer(deps: McpDeps): McpService {
    return {
        name: 'web',
        description: 'Web search and content retrieval',
        actions: buildActions([
            {
                name: 'search',
                description: 'Search the web',
                handler: ({ query, count }) => deps.web.searchWeb(query as string, (count as number) || 5)
            },
            {
                name: 'read_page',
                description: 'Read web page content',
                handler: ({ url }) => deps.web.fetchWebPage(url as string)
            },
            {
                name: 'fetch_json',
                description: 'Fetch JSON from URL',
                handler: ({ url }) => deps.web.fetchJson(url as string)
            }
        ])
    };
}
