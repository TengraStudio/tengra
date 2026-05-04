/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { InterceptorState,IStreamParserStrategy, OpenCodeStreamState, StreamChunk, StreamPayload } from '../types';

type UnsafeValue = ReturnType<typeof JSON.parse>;

export class OpenCodeParserStrategy implements IStreamParserStrategy {
    *parse(json: StreamPayload, state: OpenCodeStreamState, _interceptorState: InterceptorState): Generator<StreamChunk> {
        // Handle specialized error payloads
        if (json.type === 'error' && json.message) {
            throw new Error(json.message);
        }

        if (json.type?.startsWith('response.')) {
            yield* this.handleOpenCode(json, state);
        }
    }

    /**
     * Handles proprietary OpenCode payload events.
     */
    private *handleOpenCode(json: StreamPayload, state: OpenCodeStreamState): Generator<StreamChunk> {
        const type = json.type;

        if (this.isDoneEvent(json)) {
            const itemId = json.item?.id;
            if (itemId && state.processedMessageIds.has(itemId)) {
                return;
            }
            const contentItems = json.item?.content;
            if (contentItems) {
                if (itemId) {
                    state.processedMessageIds.add(itemId);
                }
                const text = contentItems
                    .filter((c) => c.type === 'output_text' || c.type === 'summary_text')
                    .map((c) => c.text ?? '')
                    .join('');
                const reasoning = contentItems
                    .filter((c) => c.type === 'reasoning')
                    .map((c) => c.text ?? '')
                    .join('');
                if (text && text !== state.lastContent) {
                    state.lastContent = text;
                    yield { content: text };
                }
                if (reasoning) {
                    yield { reasoning };
                }
            }
            return;
        }

        if (!type) { return; }
        
        yield* this.dispatchDelta(json, state);
    }

    private isDoneEvent(json: StreamPayload): boolean {
        return json.type === 'response.output_item.done' && !!json.item?.content;
    }

    private *dispatchDelta(json: StreamPayload, state: OpenCodeStreamState): Generator<StreamChunk> {
        if (json.type === 'response.output_text.delta' && json.delta) {
            yield* this.handleText(json.delta, state);
        } else if (json.type === 'response.reasoning_text.delta') {
            if (json.delta) {
                yield* this.handleReasoning(json.delta);
            }
        } else if (json.type === 'response.reasoning_summary_text.delta') {
            if (json.delta) {
                yield* this.handleReasoningSummary(json.delta);
            }
        } else if (json.type === 'response.summary_text.delta') {
            if (json.delta) {
                yield* this.handleText(json.delta, state);
            }
        } else if (json.type === 'response.output_text.done' || json.type === 'response.summary_text.done') {
            const itemId = json.item_id || json.item?.id;
            if (itemId && state.processedMessageIds.has(itemId)) {
                return;
            }
            if (json.text && json.text !== state.lastContent) {
                if (itemId) {
                    state.processedMessageIds.add(itemId);
                }
                state.lastContent = json.text;
                yield { content: json.text };
            }
        } else if (json.type === 'response.reasoning_text.done') {
            if (json.text) {
                yield { reasoning: json.text };
            }
        } else if (json.type === 'response.reasoning_summary_text.done') {
            if (json.text) {
                yield { reasoning_summary: json.text };
            }
        } else if (
            json.type === 'response.function_call_arguments.delta'
            || json.type === 'response.mcp_call_arguments.delta'
            || json.type === 'response.web_search.delta'
            || json.type === 'response.output_item.added'
            || json.type === 'response.output_item.done'
        ) {
            if (json.type === 'response.output_item.done') {
                const images = this.extractImages(json);
                if (images.length > 0) {
                    yield { images };
                }
            }

            this.updateToolCallState(json, state);

            if (
                json.type === 'response.output_item.added' 
                || json.type === 'response.function_call_arguments.delta' 
                || json.type === 'response.mcp_call_arguments.delta'
                || json.type === 'response.web_search.delta'
            ) {
                const toolCallId = this.resolveToolCallId(json);
                if (toolCallId) {
                    const current = state.toolCalls.get(toolCallId);
                    if (current?.name) {
                        yield {
                            type: 'tool_calls',
                            tool_name: current.name,
                            tool_id: current.id
                        };
                    }
                }
            }
            if (json.type === 'response.output_item.done' && this.isFunctionCallItem(json)) {
                const toolCall = this.finalizeToolCall(json, state, false);
                if (toolCall) {
                    yield toolCall;
                }
            }
        } else if (
            json.type === 'response.function_call_arguments.done'
            || json.type === 'response.mcp_call_arguments.done'
            || json.type === 'response.web_search.done'
        ) {
            const toolCall = this.finalizeToolCall(json, state, true);
            if (toolCall) {
                yield toolCall;
            }
        } else if (json.type === 'response.completed') {
            // Flush all pending tool calls
            for (const [id] of state.toolCalls) {
                const toolCall = this.finalizeToolCall({ call_id: id } as StreamPayload, state, false);
                if (toolCall) {
                    yield toolCall;
                }
            }
            yield { finish_reason: 'stop', content: '' };
        }
    }

    private *handleText(delta: string | { text?: string }, state: OpenCodeStreamState) {
        const content = typeof delta === 'string' ? delta : delta.text;
        if (content) {
            state.lastContent += content;
            yield { content };
        }
    }

    private *handleReasoning(delta: string | { text?: string }) {
        const reasoning = typeof delta === 'string' ? delta : delta.text;
        if (reasoning) { yield { reasoning, type: 'reasoning' }; }
    }

    private *handleReasoningSummary(delta: string | { text?: string }) {
        const summary = typeof delta === 'string' ? delta : delta.text;
        if (summary) { yield { reasoning_summary: summary, type: 'reasoning_summary' }; }
    }

    private updateToolCallState(json: StreamPayload, state: OpenCodeStreamState): void {
        const toolCallId = this.resolveToolCallId(json);
        if (!toolCallId) { return; }

        const current = state.toolCalls.get(toolCallId) ?? {
            id: toolCallId,
            name: '',
            arguments: '',
        };
        const name = this.resolveToolCallName(json);
        if (name) {
            current.name = name;
        }

        const delta = this.resolveToolCallArguments(json);
        if (delta) {
            if (
                json.type === 'response.function_call_arguments.delta'
                || json.type === 'response.mcp_call_arguments.delta'
                || json.type === 'response.web_search.delta'
            ) {
                current.arguments += delta;
            } else if (delta.length >= current.arguments.length) {
                current.arguments = delta;
            }
        }

        state.toolCalls.set(toolCallId, current);
    }

    private finalizeToolCall(
        json: StreamPayload,
        state: OpenCodeStreamState,
        shouldUpdateState: boolean
    ): StreamChunk | null {
        if (shouldUpdateState) {
            this.updateToolCallState(json, state);
        }
        const toolCallId = this.resolveToolCallId(json);
        if (!toolCallId) { return null; }

        const current = state.toolCalls.get(toolCallId);
        if (!current || current.arguments.trim() === '' || current.name.trim() === '') {
            return null;
        }

        state.toolCalls.delete(toolCallId);
        return {
            type: 'tool_calls',
            tool_calls: [{
                id: current.id,
                type: 'function',
                function: {
                    name: current.name,
                    arguments: current.arguments
                }
            }]
        };
    }

    private resolveToolCallId(json: StreamPayload): string | null {
        const candidate = json.call_id ?? json.item_id ?? json.item?.call_id ?? json.item?.id;
        if (typeof candidate === 'string' && candidate.trim() !== '') {
            return candidate.trim();
        }
        return null;
    }

    private resolveToolCallName(json: StreamPayload): string {
        const directCandidate = json.name ?? json.item?.name;
        if (typeof directCandidate === 'string' && directCandidate.trim().length > 0) {
            return directCandidate.trim();
        }
        
        if (json.type?.includes('web_search')) { return 'web_search'; }

        const functionCandidate = json.item?.function;
        if (functionCandidate && typeof functionCandidate === 'object' && !Array.isArray(functionCandidate) && typeof functionCandidate['name'] === 'string') {
            return functionCandidate['name'].trim();
        }
        return '';
    }

    private resolveToolCallArguments(json: StreamPayload): string {
        if (typeof json.delta === 'string') { return json.delta; }
        if (typeof json.delta?.text === 'string') { return json.delta.text; }
        if (typeof json.arguments === 'string') { return json.arguments; }
        if (typeof json.item?.arguments === 'string') { return json.item.arguments; }
        
        const func = json.item?.function;
        if (func && typeof func === 'object' && !Array.isArray(func) && typeof func.arguments === 'string') {
            return func.arguments;
        }
        if (json.item?.arguments && typeof json.item.arguments === 'object') {
            return JSON.stringify(json.item.arguments);
        }
        return '';
    }

    private isFunctionCallItem(json: StreamPayload): boolean {
        return json.item?.type === 'function_call';
    }

    private extractImages(json: StreamPayload): Array<string | { image_url: { url: string } }> {
        const item = json.item;
        if (!item) { return []; }

        const itemType = typeof item.type === 'string' ? item.type : '';
        if (itemType !== 'image_generation_call' && itemType !== 'output_image' && !itemType.endsWith('image_generation_call')) {
            return [];
        }

        const result = typeof item.result === 'string' ? item.result.trim() : '';
        if (result) {
            return [{ image_url: { url: `data:image/png;base64,${result}` } }];
        }

        const directUrl = this.extractImageUrl(item.image_url) ?? this.extractImageUrl(item.url);
        if (directUrl) {
            return [{ image_url: { url: directUrl } }];
        }

        return [];
    }

    private extractImageUrl(value: UnsafeValue): string | null {
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof (value as UnsafeValue).url === 'string') {
            return (value as UnsafeValue).url.trim();
        }
        return null;
    }
}
