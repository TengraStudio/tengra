/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

