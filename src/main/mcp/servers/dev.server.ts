import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildDevServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'npm',
            description: 'NPM registry tools',
            actions: buildActions([
                {
                    name: 'search',
                    description: 'Search NPM packages',
                    handler: async ({ query }) => {
                        const q = encodeURIComponent(String(query));
                        const url = `https://registry.npmjs.org/-/v1/search?text=${q}&size=10`;
                        return await deps.web.fetchJson(url);
                    }
                },
                {
                    name: 'package',
                    description: 'Get package details',
                    handler: async ({ name }) => {
                        const url = `https://registry.npmjs.org/${encodeURIComponent(String(name))}/latest`;
                        return await deps.web.fetchJson(url);
                    }
                }
            ])
        },
        {
            name: 'github',
            description: 'GitHub public API',
            actions: buildActions([
                {
                    name: 'repo',
                    description: 'Get repo details (owner/repo)',
                    handler: async ({ owner, repo }) => {
                        const url = `https://api.github.com/repos/${owner}/${repo}`;
                        return await deps.web.fetchJson(url);
                    }
                },
                {
                    name: 'issues',
                    description: 'List repo issues',
                    handler: async ({ owner, repo }) => {
                        const url = `https://api.github.com/repos/${owner}/${repo}/issues?per_page=10`;
                        return await deps.web.fetchJson(url);
                    }
                }
            ])
        },
        {
            name: 'stackoverflow',
            description: 'StackOverflow search',
            actions: buildActions([
                {
                    name: 'search',
                    description: 'Search StackOverflow questions',
                    handler: async ({ query }) => {
                        const q = encodeURIComponent(String(query));
                        const url = `https://api.stackexchange.com/2.3/search?order=desc&sort=activity&intitle=${q}&site=stackoverflow&pagesize=5`;
                        return await deps.web.fetchJson(url);
                    }
                }
            ])
        }
    ];
}
