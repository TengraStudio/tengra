/**
 * Tengra - AI Runtime Event Protocol
 * Inspired by the "t3code" event-driven inference model.
 * 
 * This unifies all LLM providers into a single streaming event pipeline.
 */

import { ToolCall } from './chat';
import { JsonValue } from '../common';

export type AiRuntimeEventKind = 
    | 'session.started'
    | 'content.delta'
    | 'reasoning.delta'
    | 'tool.call.started'
    | 'tool.call.delta'
    | 'tool.call.completed'
    | 'session.finished'
    | 'error';

export interface AiRuntimeEvent {
    kind: AiRuntimeEventKind;
    timestamp: number;
    sessionId?: string;
    payload: JsonValue;
}

export interface SessionStartedPayload {
    model: string;
    provider: string;
    systemMode: string;
}

export interface ContentDeltaPayload {
    delta: string;
    index?: number;
}

export interface ReasoningDeltaPayload {
    delta: string;
    index?: number;
}

export interface ToolCallStartedPayload {
    id: string;
    name: string;
}

export interface ToolCallDeltaPayload {
    id: string;
    argumentsDelta: string;
}

export interface ToolCallCompletedPayload {
    toolCall: ToolCall;
}

export interface SessionFinishedPayload {
    finishReason: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface ErrorPayload {
    message: string;
    code?: string;
    recoverable: boolean;
}
