import {
    extractConversationReasoningEffort,
    sanitizeConversationRequestParams,
    sanitizeConversationStreamInputs,
} from '@main/ipc/session-conversation-validation.util';
import { Message } from '@shared/types/chat';
import { describe, expect, it } from 'vitest';

function createUserMessage(content: string): Message {
    return {
        id: 'user-1',
        role: 'user',
        content,
        timestamp: new Date(),
    };
}

describe('session-conversation-validation.util', () => {
    it('sanitizes chat inputs and preserves workspace/tool metadata', () => {
        const result = sanitizeConversationRequestParams({
            messages: [createUserMessage('masaustumu listele')],
            model: 'glm-5:cloud',
            provider: 'ollama',
            tools: [{
                type: 'function',
                function: {
                    name: 'list_directory',
                    description: 'List files',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string' },
                        },
                    },
                },
            }],
            workspaceId: 'workspace-1',
            systemMode: 'agent',
            chatId: 'chat-1',
        });

        expect(result.model).toBe('glm-5:cloud');
        expect(result.provider).toBe('ollama');
        expect(result.workspaceId).toBe('workspace-1');
        expect(result.systemMode).toBe('agent');
        expect(result.chatId).toBe('chat-1');
        expect(result.tools?.[0]?.function.name).toBe('list_directory');
    });

    it('requires a stream chat id when sanitizing stream inputs', () => {
        expect(() => sanitizeConversationStreamInputs({
            messages: [createUserMessage('hello')],
            model: 'glm-5:cloud',
            provider: 'ollama',
            chatId: '',
        })).toThrow('error.chat.invalid_id');
    });

    it('extracts reasoning effort safely from options', () => {
        expect(extractConversationReasoningEffort({
            reasoningEffort: 'medium',
        })).toBe('medium');
        expect(extractConversationReasoningEffort({
            reasoningEffort: 3,
        })).toBeUndefined();
    });
});
