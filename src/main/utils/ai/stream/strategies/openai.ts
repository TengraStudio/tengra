/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { InterceptorState, IStreamParserStrategy, OpenAIStreamDelta, RuntimeValue, StreamChunk, StreamPayload } from '@main/utils/ai/stream/types';
import { interceptEmbeddedToolCalls } from '@main/utils/ai/stream/utils';
import { ToolCall } from '@shared/types/ai/chat';

export class OpenAIParserStrategy implements IStreamParserStrategy {
    *parse(json: StreamPayload, _state: RuntimeValue, interceptorState: InterceptorState): Generator<StreamChunk> {
        // Handle specialized error payloads
        if (json.type === 'error' && json.message) {
            throw new Error(json.message);
        }

        const choices = json.choices ?? [];
        if (json.usage && choices.length === 0) {
            yield { index: 0, content: '', usage: json.usage };
            return;
        }

        for (const choice of choices) {
            const delta = choice.delta;
            const finishReason = choice.finish_reason;
            
            // Handle finish_reason even without delta (important for tool_calls signal)
            if (finishReason && !delta) {
                yield { 
                    index: choice.index ?? 0, 
                    content: '', 
                    finish_reason: finishReason,
                    type: finishReason === 'tool_calls' ? 'tool_calls' : undefined
                };
                continue;
            }
            
            if (!delta) { continue; }

            const chunk = this.extractChunk(choice.index ?? 0, delta, json.usage, finishReason);
            if (chunk) {
                yield* interceptEmbeddedToolCalls(chunk, interceptorState);
            }
        }
    }

    private extractChunk(
        choiceIdx: number, 
        delta: OpenAIStreamDelta, 
        usage: StreamPayload['usage'],
        finishReason?: string | null
    ): StreamChunk | null {
        const content = delta.content ?? '';
        const reasoning = delta.reasoning_content ?? delta.reasoning ?? delta.thinking ?? delta.thought ?? '';

        if (content || reasoning || (delta.images && delta.images.length > 0) || this.hasToolCalls(delta) || usage || finishReason) {
            return this.createChunk({
                idx: choiceIdx,
                content,
                reasoning,
                delta,
                usage,
                finishReason,
            });
        }

        return null;
    }

    private hasToolCalls(delta: OpenAIStreamDelta): boolean {
        return Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0;
    }

    private createChunk(options: {
        idx: number;
        content: string;
        reasoning: string;
        delta: OpenAIStreamDelta;
        usage: StreamPayload['usage'];
        finishReason?: string | null;
    }): StreamChunk {
        const {
            idx,
            content,
            reasoning,
            delta,
            usage,
            finishReason,
        } = options;
        const toolCalls = this.normalizeToolCalls(delta.tool_calls);
        
        let chunkType: string | undefined;
        if (toolCalls && toolCalls.length > 0) {
            chunkType = 'tool_calls';
        } else if (finishReason === 'tool_calls') {
            chunkType = 'tool_calls';
        }
        
        return {
            index: idx,
            content,
            reasoning,
            images: Array.isArray(delta.images) ? delta.images : [],
            type: chunkType,
            tool_calls: toolCalls,
            finish_reason: finishReason,
            usage
        };
    }

    private normalizeToolCalls(toolCalls?: Partial<ToolCall>[]): ToolCall[] | undefined {
        if (!Array.isArray(toolCalls)) {
            return undefined;
        }

        const normalized = toolCalls
            .map((toolCall, index) => this.normalizeToolCall(toolCall, index))
            .filter((toolCall): toolCall is ToolCall => toolCall !== null);

        return normalized.length > 0 ? normalized : undefined;
    }

    private normalizeToolCall(toolCall: Partial<ToolCall>, fallbackIndex: number): ToolCall | null {
        const functionValue = toolCall.function;
        const functionObject = functionValue && typeof functionValue === 'object'
            ? functionValue as Partial<ToolCall['function']>
            : {};
        const name = typeof functionObject.name === 'string' ? functionObject.name : '';
        const args = typeof functionObject.arguments === 'string' ? functionObject.arguments : '';
        const id = typeof toolCall.id === 'string' ? toolCall.id : '';
        const index = typeof toolCall.index === 'number' ? toolCall.index : fallbackIndex;

        if (id.trim().length === 0 && name.trim().length === 0 && args.trim().length === 0) {
            return null;
        }
        if (name.trim().length === 0 && args.trim().length === 0) {
            return null;
        }

        return {
            ...toolCall,
            id,
            index,
            type: 'function',
            function: {
                name,
                arguments: args,
                thought_signature: (functionObject as { thought_signature?: string }).thought_signature
            },
        };
    }
}

