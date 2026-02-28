import { randomUUID } from 'crypto';

import { Message, ToolCall } from '@shared/types/chat';

import {
    CopilotChatResponse,
    DiagnosticOutputItem,
    DiagnosticResponse
} from './copilot.types';

/**
 * Parses Copilot API responses into standard Message format.
 */
export class CopilotResponseParser {
    /** Parses a /responses endpoint diagnostic response into a Message */
    parseDiagnosticResponse(data: DiagnosticResponse): Message {
        const responseData = data.response ?? data;
        const outputItems = Array.isArray(responseData.output) ? responseData.output : [];

        const toolCalls = this.extractToolCalls(outputItems);
        const contentText = this.extractContentText(responseData, outputItems);

        const message: Message = {
            id: randomUUID(),
            role: 'assistant',
            content: contentText ?? `[Unknown format] ${JSON.stringify(responseData).substring(0, 100)}`,
            timestamp: new Date()
        };
        if (toolCalls.length > 0) {
            message.toolCalls = toolCalls;
        }
        return message;
    }

    /** Parses a standard chat completion response into a Message */
    parseChatResponse(json: CopilotChatResponse): Message {
        const firstChoice = json.choices.length > 0 ? json.choices[0] : null;
        if (firstChoice) {
            return firstChoice.message;
        }

        if (json.type === 'message' && Array.isArray(json.content)) {
            const textContent = json.content.map(item => (typeof item === 'string' ? item : item.text ?? '')).join('');
            return { id: randomUUID(), role: 'assistant', content: textContent, timestamp: new Date() };
        }

        if (json.output_text) {
            return { id: randomUUID(), role: 'assistant', content: json.output_text, timestamp: new Date() };
        }
        if (typeof json.content === 'string') {
            return { id: randomUUID(), role: 'assistant', content: json.content, timestamp: new Date() };
        }

        return { id: randomUUID(), role: 'assistant', content: JSON.stringify(json), timestamp: new Date() };
    }

    private extractToolCalls(outputItems: (string | DiagnosticOutputItem)[]): ToolCall[] {
        return outputItems
            .filter((item): item is DiagnosticOutputItem & { type: 'function_call'; name: string; arguments: string } =>
                typeof item === 'object' && item.type === 'function_call' && typeof item.name === 'string' && typeof item.arguments === 'string'
            )
            .map(item => ({
                id: item.id ?? randomUUID(),
                type: 'function',
                function: { name: item.name, arguments: item.arguments }
            }));
    }

    private extractContentText(
        responseData: { output_text?: string; text?: string },
        outputItems: (string | DiagnosticOutputItem)[]
    ): string | null {
        if (typeof responseData.output_text === 'string') {
            return responseData.output_text;
        }
        if (typeof responseData.text === 'string') {
            return responseData.text;
        }
        if (outputItems.length > 0) {
            return outputItems
                .filter(item => typeof item === 'string' || (typeof item === 'object' && item.type !== 'function_call'))
                .map(item => {
                    if (typeof item === 'string') { return item; }
                    if (typeof item === 'object') { return item.text ?? item.content ?? JSON.stringify(item); }
                    return '';
                })
                .join('');
        }
        return null;
    }
}
