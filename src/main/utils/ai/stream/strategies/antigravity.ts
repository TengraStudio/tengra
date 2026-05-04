/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { ToolCall } from '@shared/types/ai/chat';
import { safeJsonParse } from '@shared/utils/system/sanitize.util';

import { AntigravityStreamState, InterceptorState,IStreamParserStrategy, StreamChunk, StreamPayload } from '../types';

type UnsafeValue = ReturnType<typeof JSON.parse>;

export class AntigravityParserStrategy implements IStreamParserStrategy {
    *parse(json: StreamPayload, state: AntigravityStreamState, _interceptorState: InterceptorState): Generator<StreamChunk> {
        // Handle specialized error payloads
        if (json.type === 'error' && json.message) {
            throw new Error(json.message);
        }

        // Handle specialized antigravity.* events
        if (json.type?.startsWith('antigravity.')) {
            yield* this.processChunk(json, state);
        }
    }

    /**
     * Handles proprietary Antigravity (Gemini) payload events.
     */
    private *processChunk(json: StreamPayload, state: AntigravityStreamState): Generator<StreamChunk> {
        const type = json.type;
        const data = json.data;

        if (type === 'antigravity.chunk' && data) {
            const geminiValue = typeof data === 'string' ? safeJsonParse<UnsafeValue>(data, null) : data;
            if (!geminiValue) {return;}

            const response = geminiValue.response || geminiValue;
            const candidate = response.candidates?.[0];
            if (!candidate) {return;}

            const parts = candidate.content?.parts || [];
            let fullContent = '';
            let fullReasoning = '';
            const toolCalls: ToolCall[] = [];
            const images: UnsafeValue[] = [];

            // 1. Process Gemini parts
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isThought = part.thought === true || part.thinking === true;

                if (isThought || part.thought || part.thinking) {
                    const text = (typeof part.thought === 'string' ? part.thought : '') || 
                                 (typeof part.thinking === 'string' ? part.thinking : '') || 
                                 (typeof part.text === 'string' ? part.text : '');
                    fullReasoning += text;
                    continue;
                }

                if (part.text) {
                    fullContent += part.text;
                    continue;
                }

                if (part.inlineData) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const base64 = part.inlineData.data;
                    if (base64) {
                        images.push({
                            type: 'image_url',
                            image_url: { url: `data:${mimeType};base64,${base64}` }
                        });
                    }
                    continue;
                }

                if (part.functionCall) {
                    const callId = `gemini-call-${i}`;
                    const name = part.functionCall.name;
                    const args = typeof part.functionCall.args === 'string' 
                        ? part.functionCall.args 
                        : JSON.stringify(part.functionCall.args || {});
                    
                    toolCalls.push({
                        id: callId,
                        type: 'function',
                        function: {
                            name,
                            arguments: args,
                            thought_signature: part.functionCall.thought_signature
                        }
                    });
                }
            }

            // 2. Handle structured Step-based payloads (Planner/Architect)
            if (response.step?.case === 'plannerResponse') {
                const val = response.step.value;
                if (val.thinking && !fullReasoning.includes(val.thinking)) {
                    fullReasoning += val.thinking;
                }
                if (val.modifiedResponse && !fullContent.includes(val.modifiedResponse)) {
                    fullContent += val.modifiedResponse;
                }
                if (Array.isArray(val.toolCalls)) {
                    val.toolCalls.forEach((tc: UnsafeValue, idx: number) => {
                        const args = typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments || {});
                        toolCalls.push({
                            id: `step-call-${idx}`,
                            type: 'function',
                            function: {
                                name: tc.name || 'tool',
                                arguments: args
                            }
                        });
                    });
                }
            }

            // Calculate deltas
            const deltaContent = fullContent.startsWith(state.lastContent)
                ? fullContent.slice(state.lastContent.length)
                : fullContent;
            
            const deltaReasoning = fullReasoning.startsWith(state.lastReasoning)
                ? fullReasoning.slice(state.lastReasoning.length)
                : fullReasoning;

            state.lastContent = fullContent;
            state.lastReasoning = fullReasoning;

            const chunk: StreamChunk = {
                index: 0,
                content: deltaContent || undefined,
                reasoning: deltaReasoning || undefined,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
                images: images.length > 0 ? images : undefined,
                finish_reason: candidate.finishReason || undefined
            };

            if (chunk.content || chunk.reasoning || chunk.tool_calls || chunk.images || chunk.finish_reason) {
                yield chunk;
            }
        }
    }
}
