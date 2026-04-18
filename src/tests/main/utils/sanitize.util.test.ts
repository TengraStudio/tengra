/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    safeJsonParse,
    sanitizeFilename,
    sanitizeString,
    sanitizeUrl} from '@shared/utils/sanitize.util';
import { describe, expect, it } from 'vitest';

describe('sanitize.util', () => {
    it('sanitizes control characters from strings', () => {
        const out = sanitizeString('hello\u0000world');
        expect(out).toBe('helloworld');
    });

    it('sanitizes dangerous filename characters', () => {
        const out = sanitizeFilename('../a:b*c?.txt');
        expect(out).toBe('abc.txt');
    });

    it('allows http(s)/data urls only', () => {
        expect(sanitizeUrl('https://example.com')).toContain('https://example.com');
        expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('returns fallback on invalid JSON', () => {
        const out = safeJsonParse('{invalid', { ok: false });
        expect(out).toEqual({ ok: false });
    });
});

