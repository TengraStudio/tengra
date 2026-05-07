/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { buildSystemPrompt } from '@shared/instructions';
import { describe, expect, it } from 'vitest';

describe('buildSystemPrompt', () => {
    it('uses multilingual language rules and reminder', () => {
        const prompt = buildSystemPrompt({
            language: 'tr',
            provider: 'codex',
        });

        expect(prompt).toContain('LANGUAGE RULES');
        expect(prompt).toContain("Respond in the user's language with natural fluency and clarity.");
        expect(prompt).toContain('After a successful list_directory result');
        expect(prompt).toContain('Do not expose raw hidden chain-of-thought');
    });

    it('handles non-English locale tags with multilingual directive', () => {
        const prompt = buildSystemPrompt({
            language: 'de-DE',
            provider: 'ollama',
        });

        expect(prompt).toContain('LANGUAGE RULES');
        expect(prompt).toContain("Respond in the user's language with natural fluency and clarity.");
    });

    it('handles locale metadata with multilingual directive', () => {
        const prompt = buildSystemPrompt({
            language: 'pt-BR',
            localeMetadata: {
                locale: 'pt-BR',
                displayName: 'Portuguese (Brazil)',
                nativeName: 'Portugues (Brasil)',
            },
            provider: 'ollama',
        });

        expect(prompt).toContain('LANGUAGE RULES');
        expect(prompt).toContain("Respond in the user's language with natural fluency and clarity.");
    });
});

