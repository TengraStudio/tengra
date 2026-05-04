/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { appLogger } from '@main/logging/logger';
import { JsonToolParser } from '@main/utils/ai/json-tool-parser.util';
import { XmlToolParser } from '@main/utils/ai/xml-tool-parser.util';

import { InterceptorState,StreamChunk } from './types';

/**
 * Intercepts tool calls embedded in content (XML/JSON tags).
 */
export function* interceptEmbeddedToolCalls(chunk: StreamChunk, state: InterceptorState): Generator<StreamChunk> {
    if (!chunk.content) {
        yield chunk;
        return;
    }

    const INTERCEPT_BUFFER_TIMEOUT_MS = 5000;
    const now = Date.now();
    if (state.buffer.length > 0 && (now - state.lastUpdateTime) > INTERCEPT_BUFFER_TIMEOUT_MS) {
        appLogger.warn('StreamParser', `Interceptor buffer timeout, flushing stale buffer (${state.buffer.length} chars)`);
        const staleContent = state.buffer;
        state.buffer = '';
        state.lastUpdateTime = now;
        if (staleContent) {
            yield { ...chunk, content: staleContent };
        }
    }

    state.buffer += chunk.content;
    state.lastUpdateTime = now;

    const { toolCalls: jsonCalls, cleanedText: afterJson } = JsonToolParser.parse(state.buffer, { trim: false });
    if (jsonCalls.length > 0) {
        appLogger.info('StreamParser', `Extracted ${jsonCalls.length} JSON tool calls from content`);
        yield {
            ...chunk,
            content: '',
            type: 'tool_calls',
            tool_calls: jsonCalls,
            finish_reason: 'tool_calls'
        };
        state.buffer = afterJson;
    }

    const { toolCalls: xmlCalls, cleanedText: afterXml } = XmlToolParser.parse(state.buffer, { trim: false });
    if (xmlCalls.length > 0) {
        appLogger.info('StreamParser', `Extracted ${xmlCalls.length} XML tool calls from content`);
        yield {
            ...chunk,
            content: '',
            type: 'tool_calls',
            tool_calls: xmlCalls,
            finish_reason: 'tool_calls'
        };
        state.buffer = afterXml;
    }

    const hasPotentialXml = XmlToolParser.hasPotentialXmlCall(state.buffer);
    const hasPotentialJson = JsonToolParser.hasPotentialJsonCall(state.buffer);

    if (hasPotentialXml || hasPotentialJson) {
        if (hasPotentialXml) {
            const { content, buffered } = XmlToolParser.stripIncompleteTags(state.buffer);
            if (content) {
                yield { ...chunk, content };
            }
            state.buffer = buffered;
        } else {
            const partial = JsonToolParser.tryExtractPartialName(state.buffer);
            if (partial && partial.name !== state.lastEmittedToolName) {
                state.lastEmittedToolName = partial.name;
                yield { 
                    ...chunk,
                    content: '',
                    type: 'tool_calls', 
                    tool_name: partial.name,
                    ...(partial.id ? { tool_id: partial.id } : {})
                };
            }
        }
    } else {
        const content = state.buffer;
        state.buffer = '';
        if (content) {
            yield { ...chunk, content };
        }
    }
}
