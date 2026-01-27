import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { JsonValue } from '@shared/types/common';

export function buildDataServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'embedding',
            description: 'Embedding operations',
            actions: buildActions([
                { name: 'embed', description: 'Generate embedding', handler: ({ text }) => deps.embedding.generateEmbedding(text as string) }
            ])
        },
        {
            name: 'ollama',
            description: 'Ollama local LLM utilities',
            actions: buildActions([
                { name: 'listModels', description: 'List local ollama models', handler: () => deps.ollama.getModels() },
                { name: 'ps', description: 'List running ollama models', handler: () => deps.ollama.ps() }
            ])
        },
        {
            name: 'database',
            description: 'App database access',
            actions: buildActions([
                { name: 'stats', description: 'Get DB stats', handler: () => deps.database.getStats() },
                { name: 'chats', description: 'List chats', handler: () => deps.database.getAllChats() }
            ])
        },
        {
            name: 'content',
            description: 'Content helpers (markdown/code)',
            actions: buildActions([
                { name: 'base64Encode', description: 'Base64 encode', handler: ({ text }) => deps.content.base64Encode(text as string) },
                { name: 'formatJson', description: 'Pretty print JSON', handler: ({ json }) => deps.content.formatJson(json as JsonValue) }
            ])
        }
    ];
}
