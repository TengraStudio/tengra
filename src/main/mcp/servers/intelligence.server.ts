import { buildActions, McpDeps } from '@main/mcp/server-utils';
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
                    handler: ({ content, sourceId, projectId }) =>
                        deps.advancedMemory.extractAndStageFromMessage(String(content), String(sourceId), projectId ? String(projectId) : undefined)
                },
                {
                    name: 'recall',
                    description: 'Recall relevant memories based on context',
                    handler: ({ query, projectId, limit }) =>
                        deps.advancedMemory.recall({
                            query: String(query),
                            projectId: projectId ? String(projectId) : undefined,
                            limit: limit ? Number(limit) : 5
                        })
                },
                {
                    name: 'confirm',
                    description: 'Confirm a pending memory in staging',
                    handler: ({ id }) => deps.advancedMemory.confirmPendingMemory(String(id))
                }
            ])
        },
        {
            name: 'ideas',
            description: 'AI-powered project idea generation',
            actions: buildActions([
                {
                    name: 'createSession',
                    description: 'Start a new idea generation session',
                    handler: ({ model, provider, categories, maxIdeas }) =>
                        deps.ideaGenerator.createSession({
                            model: String(model),
                            provider: String(provider),
                            categories: categories as IdeaCategory[],
                            maxIdeas: Number(maxIdeas)
                        })
                },
                {
                    name: 'generatePreview',
                    description: 'Fast market research preview for categories',
                    handler: ({ categories }) =>
                        deps.ideaGenerator.generateMarketPreview(categories as IdeaCategory[])
                }
            ])
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
            ])
        }
    ];
}
