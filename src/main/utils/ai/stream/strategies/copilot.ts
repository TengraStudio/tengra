/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { CopilotStreamState, InterceptorState,IStreamParserStrategy, StreamChunk, StreamPayload } from '@main/utils/ai/stream/types';
import { ToolCall } from '@shared/types/ai/chat';

type UnsafeValue = ReturnType<typeof JSON.parse>;

export class CopilotParserStrategy implements IStreamParserStrategy {
    *parse(json: StreamPayload, state: CopilotStreamState, _interceptorState: InterceptorState): Generator<StreamChunk> {
        // Handle specialized error payloads
        if (json.type === 'error' && json.message) {
            throw new Error(json.message);
        }

        // Handle specialized assistant.* events
        if (json.type?.startsWith('assistant.')) {
            yield* this.handleAssistantEvent(json, state);
        }
    }

    /**
     * Handles proprietary Copilot payload events.
     */
    private *handleAssistantEvent(json: StreamPayload, state: CopilotStreamState): Generator<StreamChunk> {
        const type = json.type;
        const data = json.data as Record<string, UnsafeValue> | undefined;

        if (!type || !data) { return; }

        switch (type) {
            case 'assistant.message_delta': {
                const content = data.deltaContent || data.content;
                if (content) {
                    state.lastContent += content;
                    yield { content };
                }
                break;
            }
            case 'assistant.reasoning_delta': {
                const reasoning = data.deltaContent || data.content;
                if (reasoning) {
                    state.lastReasoning += reasoning;
                    yield { reasoning, type: 'reasoning' };
                }
                break;
            }
            case 'assistant.reasoning': {
                const reasoning = data.content || data.reasoningText;
                if (reasoning) {
                    state.lastReasoning = reasoning;
                    yield { reasoning, type: 'reasoning' };
                }
                break;
            }
            case 'assistant.tool_call_delta': {
                const callId = data.id || data.tool_call_id;
                if (!callId) {break;}

                let current = state.toolCalls.get(callId);
                if (!current) {
                    current = { id: callId, name: data.name || '', arguments: '' };
                    state.toolCalls.set(callId, current);
                    
                    if (current.name) {
                        yield {
                            type: 'tool_calls',
                            tool_name: current.name,
                            tool_id: current.id
                        };
                    }
                }

                if (data.name && !current.name) {
                    current.name = data.name;
                    yield {
                        type: 'tool_calls',
                        tool_name: current.name,
                        tool_id: current.id
                    };
                }

                const delta = data.deltaContent || data.arguments;
                if (delta) {
                    current.arguments += delta;
                }
                break;
            }
            case 'assistant.tool_calls': {
                if (Array.isArray(data.toolCalls)) {
                    const toolCalls: ToolCall[] = data.toolCalls.map((tc: UnsafeValue) => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name || tc.function?.name,
                            arguments: tc.arguments || tc.function?.arguments
                        }
                    }));
                    yield { type: 'tool_calls', tool_calls: toolCalls };
                }
                break;
            }
            case 'assistant.message': {
                const content = data.content;
                if (content && content !== state.lastContent) {
                    state.lastContent = content;
                    yield { content };
                }
                break;
            }
            case 'assistant.usage': {
                if (data.usage) {
                    yield {
                        usage: {
                            prompt_tokens: data.usage.prompt_tokens || 0,
                            completion_tokens: data.usage.completion_tokens || 0,
                            total_tokens: data.usage.total_tokens || 0
                        }
                    };
                }
                break;
            }
        }
    }
}

