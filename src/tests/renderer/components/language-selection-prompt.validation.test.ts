import {
    sanitizePromptLanguage,
    SUPPORTED_PROMPT_LANGUAGES,
} from '@renderer/components/shared/language-selection-prompt.validation';
import { describe, expect, it } from 'vitest';

describe('language-selection prompt validation', () => {
    it('accepts supported language codes', () => {
        for (const code of SUPPORTED_PROMPT_LANGUAGES) {
            expect(sanitizePromptLanguage(code)).toBe(code);
        }
    });

    it('rejects invalid language values', () => {
        expect(sanitizePromptLanguage('')).toBeNull();
        expect(sanitizePromptLanguage('xx')).toBeNull();
        expect(sanitizePromptLanguage(undefined)).toBeNull();
    });
});
