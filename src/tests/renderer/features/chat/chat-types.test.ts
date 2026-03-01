import { describe, expect, it } from 'vitest';

import type { ChatTemplate } from '@/features/chat/types';

describe('ChatTemplate type', () => {
    it('accepts valid template with all fields', () => {
        const template: ChatTemplate = {
            id: 'code',
            icon: 'code-icon',
            iconColor: 'text-blue-500',
            title: 'Write Code',
            description: 'Generate code snippets',
            prompt: 'Write a function that...',
            systemPrompt: 'You are a coding assistant',
        };
        expect(template.id).toBe('code');
        expect(template.prompt).toBe('Write a function that...');
        expect(template.systemPrompt).toBe('You are a coding assistant');
    });

    it('accepts template without optional fields', () => {
        const template: ChatTemplate = {
            id: 'search',
            icon: 'search-icon',
            iconColor: 'text-green-500',
            title: 'Search',
            description: 'Search the web',
        };
        expect(template.prompt).toBeUndefined();
        expect(template.systemPrompt).toBeUndefined();
    });
});
