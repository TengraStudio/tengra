import { buildActions, McpDeps, validateNumber, validateString } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { JsonValue } from '@shared/types/common';

export function buildDataServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'embedding',
            description: 'Embedding operations',
            actions: buildActions([
                {
                    name: 'embed',
                    description: 'Generate embedding (max 10KB text)',
                    handler: ({ text }) => {
                        // Limit text size to prevent excessive resource usage
                        const validatedText = validateString(text, 10240); // 10KB max
                        return deps.embedding.generateEmbedding(validatedText);
                    }
                }
            ], 'embedding', deps.auditLog)
        },
        {
            name: 'ollama',
            description: 'Ollama local LLM utilities',
            actions: buildActions([
                { name: 'listModels', description: 'List local ollama models', handler: () => deps.ollama.getModels() },
                { name: 'ps', description: 'List running ollama models', handler: () => deps.ollama.ps() }
            ], 'ollama', deps.auditLog)
        },
        {
            name: 'database',
            description: 'App database access',
            actions: buildActions([
                { name: 'stats', description: 'Get DB stats', handler: () => deps.database.getStats() },
                {
                    name: 'chats',
                    description: 'List chats with pagination (limit 1-100, default 50)',
                    handler: ({ limit, offset }) => {
                        const validLimit = limit !== undefined
                            ? validateNumber(limit, 1, 100)
                            : 50;
                        const validOffset = offset !== undefined
                            ? validateNumber(offset, 0, Number.MAX_SAFE_INTEGER)
                            : 0;

                        return deps.database.getAllChats()
                            .then(chats => ({
                                success: true,
                                data: {
                                    items: chats.slice(validOffset, validOffset + validLimit),
                                    total: chats.length,
                                    limit: validLimit,
                                    offset: validOffset,
                                    hasMore: validOffset + validLimit < chats.length
                                }
                            }));
                    }
                }
            ], 'database', deps.auditLog)
        },
        {
            name: 'content',
            description: 'Content helpers (markdown/code)',
            actions: buildActions([
                {
                    name: 'base64Encode',
                    description: 'Base64 encode (max 1MB input)',
                    handler: ({ text }) => {
                        // Limit input size to prevent excessive memory usage
                        const validatedText = validateString(text, 1048576); // 1MB max
                        return deps.content.base64Encode(validatedText);
                    }
                },
                {
                    name: 'formatJson',
                    description: 'Pretty print JSON',
                    handler: ({ json }) => deps.content.formatJson(json as JsonValue)
                }
            ], 'content', deps.auditLog)
        }
    ];
}
