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
                handler: ({ query, count }) => {
                    // SEC-008-4: Validate parameters
                    if (typeof query !== 'string' || query.length === 0) {
                        return { success: false, error: 'Invalid query: must be non-empty string' };
                    }
                    if (typeof query === 'string' && query.length > 500) {
                        return { success: false, error: 'Query too long (max 500 characters)' };
                    }
                    const validCount = typeof count === 'number' && count > 0 && count <= 20 ? count : 5;
                    return deps.web.searchWeb(query, validCount);
                }
            },
            {
                name: 'read_page',
                description: 'Read web page content',
                handler: ({ url }) => {
                    // SEC-008-4: Validate URL
                    if (typeof url !== 'string' || url.length === 0) {
                        return { success: false, error: 'Invalid URL: must be non-empty string' };
                    }
                    try {
                        const parsed = new URL(url);
                        if (!['http:', 'https:'].includes(parsed.protocol)) {
                            return { success: false, error: 'Invalid URL: only HTTP/HTTPS protocols allowed' };
                        }
                    } catch {
                        return { success: false, error: 'Invalid URL format' };
                    }
                    return deps.web.fetchWebPage(url);
                }
            },
            {
                name: 'fetch_json',
                description: 'Fetch JSON from URL',
                handler: ({ url }) => {
                    // SEC-008-4: Validate URL
                    if (typeof url !== 'string' || url.length === 0) {
                        return { success: false, error: 'Invalid URL: must be non-empty string' };
                    }
                    try {
                        const parsed = new URL(url);
                        if (!['http:', 'https:'].includes(parsed.protocol)) {
                            return { success: false, error: 'Invalid URL: only HTTP/HTTPS protocols allowed' };
                        }
                    } catch {
                        return { success: false, error: 'Invalid URL format' };
                    }
                    return deps.web.fetchJson(url);
                }
            }
        ])
    };
}
