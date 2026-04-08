import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildDataServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'ollama',
            actions: buildActions([
                { name: 'listModels', handler: () => deps.ollama.getModels() },
                { name: 'ps', handler: () => deps.ollama.ps() }
            ], 'ollama', deps.auditLog)
        }
    ];
}
