import { describe, expect, it } from 'vitest';

import { sanitizeCodeEditorLanguage } from '@/components/ui/code-editor-validation';

describe('code editor validation', () => {
    it('keeps supported languages', () => {
        expect(sanitizeCodeEditorLanguage('typescript')).toBe('typescript');
        expect(sanitizeCodeEditorLanguage('python')).toBe('python');
    });

    it('falls back to javascript for invalid language values', () => {
        expect(sanitizeCodeEditorLanguage('')).toBe('javascript');
        expect(sanitizeCodeEditorLanguage('go')).toBe('javascript');
        expect(sanitizeCodeEditorLanguage(undefined)).toBe('javascript');
    });
});
