import { buildActions, McpDeps, validateNumber, withTimeout } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { CollaborationRequest } from '@main/services/llm/model-collaboration.service';
import { IdeaCategory } from '@shared/types/ideas';

export function buildIntelligenceServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'memory',
            description: 'Advanced semantic memory management',
            actions: buildActions([
                {
                    name: 'stageFragment',
                    description: 'Extract and stage facts from content',
                    handler: ({ content, sourceId, workspaceId }) =>
                        deps.advancedMemory.extractAndStageFromMessage(String(content), String(sourceId), workspaceId ? String(workspaceId) : undefined)
                },
                {
                    name: 'recall',
                    description: 'Recall relevant memories based on context (limit 1-100, default 5)',
                    handler: ({ query, workspaceId, limit }) => {
                        const validLimit = limit !== undefined
                            ? validateNumber(limit, 1, 100)
                            : 5;

                        return deps.advancedMemory.recall({
                            query: String(query),
                            workspaceId: workspaceId ? String(workspaceId) : undefined,
                            limit: validLimit
                        });
                    }
                },
                {
                    name: 'confirm',
                    description: 'Confirm a pending memory in staging',
                    handler: ({ id }) => deps.advancedMemory.confirmPendingMemory(String(id))
                }
            ], 'memory', deps.auditLog)
        },
        {
            name: 'ideas',
            description: 'AI-powered workspace idea generation',
            actions: buildActions([
                {
                    name: 'createSession',
                    description: 'Start a new idea generation session (with timeout protection)',
                    handler: ({ model, provider, categories, maxIdeas }) =>
                        withTimeout(
                            () => deps.ideaGenerator.createSession({
                                model: String(model),
                                provider: String(provider),
                                categories: categories as IdeaCategory[],
                                maxIdeas: Number(maxIdeas)
                            }),
                            120000 // 2 minute timeout for session creation
                        )
                },
                {
                    name: 'generatePreview',
                    description: 'Fast market research preview for categories (with timeout protection)',
                    handler: ({ categories }) =>
                        withTimeout(
                            () => deps.ideaGenerator.generateMarketPreview(categories as IdeaCategory[]),
                            60000 // 1 minute timeout for preview
                        )
                }
            ], 'ideas', deps.auditLog)
        },
        {
            name: 'collaboration',
            description: 'Multi-model LLM collaboration',
            actions: buildActions([
                {
                    name: 'collaborate',
                    description: 'Run multiple models on a task with a strategy',
                    handler: (args) => deps.modelCollaboration.collaborate(args as unknown as CollaborationRequest)
                }
            ], 'collaboration', deps.auditLog)
        }
    ];
}
