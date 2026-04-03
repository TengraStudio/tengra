import { buildSystemPrompt } from '@shared/instructions';
import { describe, expect, it } from 'vitest';

describe('buildSystemPrompt', () => {
    it('uses Turkish rules and reminder when language is Turkish', () => {
        const prompt = buildSystemPrompt({
            language: 'tr',
            provider: 'codex',
        });

        expect(prompt).toContain('DIL KURALLARI (TURKCE)');
        expect(prompt).toContain('Turkce yanit ver');
        expect(prompt).toContain('After a successful list_directory result');
        expect(prompt).toContain('Do not expose raw hidden chain-of-thought');
    });

    it('uses known locale rules for supported non-English locales', () => {
        const prompt = buildSystemPrompt({
            language: 'de-DE',
            provider: 'ollama',
        });

        expect(prompt).toContain('LANGUAGE RULES (GERMAN)');
        expect(prompt).toContain('Respond in German');
    });

    it('uses locale-aware instructions for marketplace-installed locales', () => {
        const prompt = buildSystemPrompt({
            language: 'pt-BR',
            localeMetadata: {
                locale: 'pt-BR',
                displayName: 'Portuguese (Brazil)',
                nativeName: 'Portugues (Brasil)',
            },
            provider: 'ollama',
        });

        expect(prompt).toContain('LANGUAGE RULES (LOCALE-AWARE)');
        expect(prompt).toContain('Portugues (Brasil)');
        expect(prompt).toContain('Respond in the user\'s selected locale (Portugues (Brasil))');
    });
});
