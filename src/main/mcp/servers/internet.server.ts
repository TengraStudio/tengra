import { buildActions, McpDeps, validateString, withTimeout } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildInternetServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'weather', 
            actions: buildActions([
                {
                    name: 'forecast', 
                    handler: async ({ location }) => {
                        const loc = location
                            ? encodeURIComponent(validateString(location, 100))
                            : '';
                        const url = `https://wttr.in/${loc}?format=j1`;

                        return await withTimeout(
                            () => deps.web.fetchJson(url),
                            10000
                        );
                    }
                }
            ], 'weather', deps.auditLog)
        }
    ];
}
