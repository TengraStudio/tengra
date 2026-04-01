import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildDataServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'ollama',
            description: 'Ollama local LLM utilities',
            actions: buildActions([
                { name: 'listModels', description: 'List local ollama models', handler: () => deps.ollama.getModels() },
                { name: 'ps', description: 'List running ollama models', handler: () => deps.ollama.ps() }
            ], 'ollama', deps.auditLog)
        }
    ];
}
