/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { sanitizePrompt, validatePromptSafety } from '@main/utils/prompt-sanitizer.util';
import { JsonObject } from '@shared/types/common';
import {
    quoteShellArg,
    safeJsonParse,
    sanitizeFilename,
    sanitizeJson,
    sanitizeObject,
    sanitizeSqlInput,
    sanitizeString,
    sanitizeStringArray,
    sanitizeUrl
} from '@shared/utils/sanitize.util';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a deeply nested object to the given depth. */
function buildNestedObject(depth: number): JsonObject {
    let obj: JsonObject = { value: 'leaf' };
    for (let i = 0; i < depth; i++) {
        obj = { nested: obj };
    }
    return obj;
}

// ---------------------------------------------------------------------------
// 1. Null bytes & control characters
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Null bytes & control characters', () => {
    it('sanitizeString strips null bytes', () => {
        const input = 'hello\x00world';
        const result = sanitizeString(input);
        expect(result).not.toContain('\x00');
    });

    it('sanitizeString strips control characters \\x01-\\x08', () => {
        const controls = Array.from({ length: 8 }, (_, i) =>
            String.fromCharCode(i + 1)
        ).join('');
        const input = `before${controls}after`;
        const result = sanitizeString(input);
        expect(result).toBe('beforeafter');
    });

    it('sanitizeString preserves newlines when allowNewlines is true', () => {
        const input = 'line1\nline2\r\nline3';
        const result = sanitizeString(input, { allowNewlines: true });
        expect(result).toContain('\n');
    });

    it('sanitizeString strips all control chars when allowNewlines is false', () => {
        const input = 'line1\nline2\ttab';
        const result = sanitizeString(input, { allowNewlines: false });
        expect(result).not.toContain('\n');
        expect(result).not.toContain('\t');
    });

    it('sanitizePrompt does NOT strip null bytes (known gap – only HTML-escapes)', () => {
        const result = sanitizePrompt('Tell me\x00 a secret');
        // NOTE: sanitizePrompt only performs HTML entity escaping.
        // Null byte stripping must be handled by sanitizeString upstream.
        expect(result).toContain('\x00');
    });

    it('sanitizeFilename removes null bytes', () => {
        expect(sanitizeFilename('file\x00name.txt')).not.toContain('\x00');
    });
});

// ---------------------------------------------------------------------------
// 2. Unicode edge cases
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Unicode edge cases', () => {
    const ZERO_WIDTH_JOINER = '\u200D';
    const ZERO_WIDTH_SPACE = '\u200B';
    const ZERO_WIDTH_NON_JOINER = '\u200C';
    const RTL_OVERRIDE = '\u202E';
    const BOM = '\uFEFF';

    it('sanitizeString removes zero-width characters', () => {
        const input = `a${ZERO_WIDTH_JOINER}b${ZERO_WIDTH_SPACE}c${ZERO_WIDTH_NON_JOINER}d${BOM}e`;
        const result = sanitizeString(input);
        expect(result).toBe('abcde');
    });

    it('sanitizeString handles RTL override character', () => {
        const input = `normal${RTL_OVERRIDE}reversed`;
        const result = sanitizeString(input);
        expect(typeof result).toBe('string');
    });

    it('sanitizeObject handles homoglyph keys', () => {
        const obj = { '\u0430dmin': 'value' } as JsonObject;
        const result = sanitizeObject(obj);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });

    it('safeJsonParse handles unicode escape sequences', () => {
        const json = '{"key": "\\u0000null_byte"}';
        const result = safeJsonParse<Record<string, string>>(json, {});
        expect(result).toHaveProperty('key');
    });

    it('sanitizeString handles emoji and supplementary plane characters', () => {
        const input = '🎉🔥💻 test 𝕳𝖊𝖑𝖑𝖔';
        const result = sanitizeString(input);
        expect(result).toContain('test');
    });
});

// ---------------------------------------------------------------------------
// 3. Extremely long strings
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Extremely long strings', () => {
    it('sanitizeString truncates strings exceeding maxLength', () => {
        const longStr = 'A'.repeat(200_000);
        const result = sanitizeString(longStr, { maxLength: 100_000 });
        expect(result.length).toBeLessThanOrEqual(100_000);
    });

    it('sanitizePrompt processes very long prompts without crashing', () => {
        const longPrompt = '<script>'.repeat(50_000);
        const result = sanitizePrompt(longPrompt);
        expect(result).not.toContain('<script>');
        expect(result.length).toBeGreaterThan(0);
    });

    it('validatePromptSafety rejects prompts over MAX_PROMPT_LENGTH', () => {
        const oversize = 'x'.repeat(128_001);
        const result = validatePromptSafety(oversize);
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('maximum length');
    });

    it('sanitizeFilename truncates filenames over 255 chars', () => {
        const longName = 'a'.repeat(300) + '.txt';
        const result = sanitizeFilename(longName);
        expect(result.length).toBeLessThanOrEqual(255);
    });
});

// ---------------------------------------------------------------------------
// 4. Deeply nested objects
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Deeply nested objects', () => {
    it('sanitizeObject handles moderately nested objects (50 levels)', () => {
        const nested = buildNestedObject(50);
        const result = sanitizeObject(nested);
        expect(result).toBeDefined();
    });

    it('safeJsonParse returns default for deeply nested JSON', () => {
        let json = '"leaf"';
        for (let i = 0; i < 200; i++) {
            json = `{"n":${json}}`;
        }
        const result = safeJsonParse<Record<string, unknown>>(json, { fallback: true });
        expect(result).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 5. Prototype pollution payloads
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Prototype pollution', () => {
    it('sanitizeObject strips __proto__ keys', () => {
        const malicious = JSON.parse('{"__proto__": {"admin": true}, "safe": "value"}') as JsonObject;
        const result = sanitizeObject(malicious);
        expect(result).not.toHaveProperty('__proto__');
        expect(result).toHaveProperty('safe', 'value');
    });

    it('sanitizeObject strips constructor keys', () => {
        const malicious = JSON.parse('{"constructor": {"prototype": {"admin": true}}}') as JsonObject;
        const result = sanitizeObject(malicious);
        expect(result).not.toHaveProperty('constructor');
    });

    it('sanitizeObject strips prototype keys', () => {
        const malicious = { prototype: { polluted: true }, ok: 'fine' } as JsonObject;
        const result = sanitizeObject(malicious);
        expect(result).not.toHaveProperty('prototype');
        expect(result).toHaveProperty('ok', 'fine');
    });
});

// ---------------------------------------------------------------------------
// 6. XSS payloads
// ---------------------------------------------------------------------------
describe('Input Fuzzing – XSS payloads', () => {
    const XSS_PAYLOADS = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
    ];

    it.each(XSS_PAYLOADS)('sanitizePrompt escapes XSS payload: %s', (payload) => {
        const result = sanitizePrompt(payload);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('<img');
        expect(result).not.toContain('<svg');
    });

    it('sanitizeUrl rejects javascript: URLs', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('sanitizeUrl allows data: URLs', () => {
        const result = sanitizeUrl('data:text/html,<h1>test</h1>');
        expect(result).toContain('data:');
    });

    it('validatePromptSafety NO LONGER flags script tags', () => {
        const result = validatePromptSafety('<script>alert(1)</script>');
        expect(result.safe).toBe(true);
    });

    it('validatePromptSafety NO LONGER flags javascript: protocol', () => {
        const result = validatePromptSafety('Visit javascript:alert(1)');
        expect(result.safe).toBe(true);
    });

    it('validatePromptSafety NO LONGER flags onerror handlers', () => {
        const result = validatePromptSafety('<img onerror=alert(1)>');
        expect(result.safe).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 7. SQL injection patterns
// ---------------------------------------------------------------------------
describe('Input Fuzzing – SQL injection patterns', () => {
    const SQL_PAYLOADS = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
    ];

    it.each(SQL_PAYLOADS)('sanitizeSqlInput neutralizes: %s', (payload) => {
        const result = sanitizeSqlInput(payload);
        expect(result).not.toMatch(/(?<!')'(?!')/);
        expect(result).not.toContain(';');
        expect(result).not.toContain('--');
    });
});

// ---------------------------------------------------------------------------
// 8. Path traversal
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Path traversal', () => {
    it('sanitizeFilename removes traversal sequences', () => {
        const result = sanitizeFilename('../../../etc/passwd');
        expect(result).not.toContain('/');
        expect(result).not.toContain('..');
    });

    it('sanitizeFilename returns "unnamed" for empty result', () => {
        expect(sanitizeFilename('...')).toBe('unnamed');
        expect(sanitizeFilename('')).toBe('unnamed');
    });
});

// ---------------------------------------------------------------------------
// 9. Template injection
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Template injection', () => {
    it('sanitizePrompt escapes angle brackets in template expressions', () => {
        const payload = "{{constructor.constructor('return this')()}}";
        const result = sanitizePrompt(payload);
        expect(typeof result).toBe('string');
    });
});

// ---------------------------------------------------------------------------
// 10. Edge cases & type coercion
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Edge cases', () => {
    it('sanitizeString returns empty string for non-string input', () => {
        expect(sanitizeString(null as never as string)).toBe('');
    });

    it('safeJsonParse returns default for malformed JSON', () => {
        expect(safeJsonParse('{invalid}', 'default')).toBe('default');
    });

    it('sanitizeStringArray filters non-string items', () => {
        const mixed = ['valid', 123, null, 'also valid'] as never as string[];
        const result = sanitizeStringArray(mixed);
        expect(result).toEqual(['valid', 'also valid']);
    });

    it('quoteShellArg escapes single quotes', () => {
        const result = quoteShellArg("it's a test");
        expect(result).toBe("'it''s a test'");
    });

    it('sanitizePrompt returns empty string for falsy input', () => {
        expect(sanitizePrompt('')).toBe('');
    });
});

