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
                    parameters: {
                        content: { type: 'string', description: 'User message or content to analyze', required: true },
                        sourceId: { type: 'string', description: 'Unique ID for the source (e.g. message ID)', required: true },
                        projectId: { type: 'string', description: 'Optional project ID context' }
                    },
                    handler: ({ content, sourceId, projectId }) =>
                        deps.advancedMemory.extractAndStageFromMessage(String(content), String(sourceId), projectId ? String(projectId) : undefined)
                },
                {
                    name: 'recall',
                    description: 'Recall relevant memories based on context',
                    parameters: {
                        query: { type: 'string', description: 'Search query', required: true },
                        projectId: { type: 'string', description: 'Project ID filter' },
                        limit: { type: 'number', description: 'Maximum fragments to recall (default: 5)' }
                    },
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
                    parameters: {
                        id: { type: 'string', description: 'Pending memory ID', required: true }
                    },
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
                    parameters: {
                        model: { type: 'string', description: 'LLM model ID', required: true },
                        provider: { type: 'string', description: 'Provider ID (e.g. anthropic, openai)', required: true },
                        categories: { type: 'array', items: { type: 'string' }, description: 'Target categories', required: true },
                        maxIdeas: { type: 'number', description: 'Maximum ideas to generate', required: true }
                    },
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
                    parameters: {
                        categories: { type: 'array', items: { type: 'string' }, description: 'Categories to research', required: true }
                    },
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
                    parameters: {
                        messages: { type: 'array', items: { type: 'object' }, description: 'Chat history', required: true },
                        models: {
                            type: 'array',
                            items: { type: 'object' },
                            description: 'Models list: { provider, model }[]',
                            required: true
                        },
                        strategy: {
                            type: 'string',
                            enum: ['consensus', 'vote', 'best-of-n', 'chain-of-thought'],
                            description: 'Collaboration strategy',
                            required: true
                        }
                    },
                    handler: (args) => deps.modelCollaboration.collaborate(args as unknown as CollaborationRequest)
                }
            ])
        }
    ];
}
