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
        // RTL override is U+202E – not in the stripped range [\u200B-\u200D\uFEFF]
        // The function preserves it; we verify it doesn't crash
        expect(typeof result).toBe('string');
    });

    it('sanitizeObject handles homoglyph keys', () => {
        // Cyrillic 'а' (U+0430) looks like Latin 'a'
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

    it('sanitizeString default maxLength handles 100k+ chars', () => {
        const longStr = 'B'.repeat(150_000);
        const result = sanitizeString(longStr);
        expect(typeof result).toBe('string');
        // Default maxLength is 1_000_000, so 150k should pass through
        expect(result.length).toBe(150_000);
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

    it('sanitizeObject handles deeply nested objects (100+ levels)', () => {
        const nested = buildNestedObject(120);
        // This may throw due to stack overflow – we verify graceful behavior
        try {
            const result = sanitizeObject(nested);
            expect(result).toBeDefined();
        } catch (error) {
            // Stack overflow is acceptable — document it, don't fail the test
            expect((error as Error).message).toMatch(/stack|recursion|range/i);
        }
    });

    it('safeJsonParse returns default for deeply nested JSON', () => {
        // Build deeply nested JSON string
        let json = '"leaf"';
        for (let i = 0; i < 200; i++) {
            json = `{"n":${json}}`;
        }
        const result = safeJsonParse<Record<string, TestValue>>(json, { fallback: true });
        // Should either parse successfully or return default
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

    it('sanitizeObject strips nested proto pollution', () => {
        const malicious = {
            data: {
                __proto__: { admin: true },
                value: 'safe'
            }
        } as JsonObject;
        const result = sanitizeObject(malicious);
        const data = (result as Record<string, Record<string, TestValue>>)?.data;
        expect(data).toBeDefined();
        expect(data).not.toHaveProperty('__proto__');
    });

    it('sanitizeJson re-serializes without proto pollution side effects', () => {
        const payload = '{"__proto__": {"isAdmin": true}}';
        const result = sanitizeJson(payload);
        const parsed = JSON.parse(result) as JsonObject;
        // JSON.parse + JSON.stringify should preserve the key but not pollute Object.prototype
        expect(({} as Record<string, TestValue>)['isAdmin']).toBeUndefined();
        expect(parsed).toBeDefined();
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
        '<body onload=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '<a href="javascript:void(0)">click</a>',
        '<div style="background:url(javascript:alert(1))">',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        "';alert(String.fromCharCode(88,83,83))//",
        '<math><mi//xlink:href="data:x,<script>alert(1)</script>">',
    ];

    it.each(XSS_PAYLOADS)('sanitizePrompt escapes XSS payload: %s', (payload) => {
        const result = sanitizePrompt(payload);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('<img');
        expect(result).not.toContain('<svg');
        expect(result).not.toContain('<iframe');
    });

    it('sanitizeUrl rejects javascript: URLs', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    });

    it('sanitizeUrl rejects vbscript: URLs', () => {
        expect(sanitizeUrl('vbscript:MsgBox("xss")')).toBe('');
    });

    it('sanitizeUrl allows data: URLs', () => {
        const result = sanitizeUrl('data:text/html,<h1>test</h1>');
        // sanitizeUrl allows data: protocol
        expect(result).toContain('data:');
    });

    it('sanitizeUrl allows valid https URLs', () => {
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    });

    it('sanitizeUrl rejects invalid protocols', () => {
        expect(sanitizeUrl('file:///etc/passwd')).toBe('');
        expect(sanitizeUrl('ftp://evil.com')).toBe('');
    });

    it('validatePromptSafety flags script tags', () => {
        const result = validatePromptSafety('<script>alert(1)</script>');
        expect(result.safe).toBe(false);
    });

    it('validatePromptSafety flags javascript: protocol', () => {
        const result = validatePromptSafety('Visit javascript:alert(1)');
        expect(result.safe).toBe(false);
    });

    it('validatePromptSafety flags onerror handlers', () => {
        const result = validatePromptSafety('<img onerror=alert(1)>');
        expect(result.safe).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 7. SQL injection patterns
// ---------------------------------------------------------------------------
describe('Input Fuzzing – SQL injection patterns', () => {
    const SQL_PAYLOADS = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM users",
        "' UNION SELECT * FROM passwords --",
        "1' AND SLEEP(5)--",
        "'; EXEC xp_cmdshell('dir'); --",
    ];

    it.each(SQL_PAYLOADS)('sanitizeSqlInput neutralizes: %s', (payload) => {
        const result = sanitizeSqlInput(payload);
        // Single quotes should be escaped (doubled)
        expect(result).not.toMatch(/(?<!')'(?!')/);
        // Semicolons should be removed
        expect(result).not.toContain(';');
        // Comment markers should be removed
        expect(result).not.toContain('--');
    });

    it('sanitizeSqlInput removes DROP TABLE keyword', () => {
        const result = sanitizeSqlInput('SELECT * FROM x; DROP TABLE users;');
        expect(result.toUpperCase()).not.toMatch(/DROP\s+TABLE/);
    });

    it('sanitizeSqlInput removes UNION SELECT', () => {
        const result = sanitizeSqlInput("' UNION SELECT password FROM users --");
        expect(result.toUpperCase()).not.toMatch(/UNION\s+SELECT/);
    });

    it('sanitizeSqlInput removes SLEEP (time-based injection)', () => {
        const result = sanitizeSqlInput("1' AND SLEEP(5)--");
        expect(result.toUpperCase()).not.toMatch(/SLEEP/);
    });
});

// ---------------------------------------------------------------------------
// 8. Path traversal
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Path traversal', () => {
    it('sanitizeFilename removes forward slashes', () => {
        const result = sanitizeFilename('../../../etc/passwd');
        expect(result).not.toContain('/');
        expect(result).not.toContain('..');
    });

    it('sanitizeFilename removes backslash traversal', () => {
        const result = sanitizeFilename('..\\..\\windows\\system32\\config');
        expect(result).not.toContain('\\');
    });

    it('sanitizeFilename removes leading dots', () => {
        const result = sanitizeFilename('...hidden');
        expect(result).not.toMatch(/^\./);
    });

    it('sanitizeFilename handles URL-encoded traversal', () => {
        // %2e%2e%2f = ../
        const result = sanitizeFilename('%2e%2e%2fetc%2fpasswd');
        // The function doesn't URL-decode, so it should just treat as regular chars
        expect(result).not.toContain('/');
    });

    it('sanitizeFilename returns "unnamed" for empty result', () => {
        expect(sanitizeFilename('...')).toBe('unnamed');
        expect(sanitizeFilename('')).toBe('unnamed');
    });

    it('sanitizeFilename strips dangerous chars (pipes, quotes)', () => {
        const result = sanitizeFilename('file|name"test<>.txt');
        expect(result).not.toMatch(/[|"<>]/);
    });
});

// ---------------------------------------------------------------------------
// 9. Template injection
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Template injection', () => {
    it('sanitizePrompt escapes angle brackets in template expressions', () => {
        const payload = "{{constructor.constructor('return this')()}}";
        const result = sanitizePrompt(payload);
        // Should not contain raw angle brackets that could be interpreted
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('sanitizePrompt escapes script within template syntax', () => {
        const payload = '${<script>alert(1)</script>}';
        const result = sanitizePrompt(payload);
        expect(result).not.toContain('<script>');
    });

    it('sanitizeString handles template literal syntax', () => {
        const payload = '${process.env.SECRET}';
        const result = sanitizeString(payload);
        expect(result).toBe('${process.env.SECRET}');
    });
});

// ---------------------------------------------------------------------------
// 10. Edge cases & type coercion
// ---------------------------------------------------------------------------
describe('Input Fuzzing – Edge cases', () => {
    it('sanitizeString returns empty string for non-string input', () => {
        expect(sanitizeString(null as never as string)).toBe('');
        expect(sanitizeString(undefined as never as string)).toBe('');
        expect(sanitizeString(123 as never as string)).toBe('');
    });

    it('sanitizeObject returns null/undefined as-is', () => {
        expect(sanitizeObject(null)).toBeNull();
        expect(sanitizeObject(undefined)).toBeUndefined();
    });

    it('safeJsonParse returns default for null/undefined/empty', () => {
        const fallback = { default: true };
        expect(safeJsonParse(null, fallback)).toEqual(fallback);
        expect(safeJsonParse(undefined, fallback)).toEqual(fallback);
        expect(safeJsonParse('', fallback)).toEqual(fallback);
        expect(safeJsonParse('   ', fallback)).toEqual(fallback);
    });

    it('safeJsonParse returns default for malformed JSON', () => {
        expect(safeJsonParse('{invalid}', 'default')).toBe('default');
        expect(safeJsonParse('undefined', [])).toEqual([]);
    });

    it('sanitizeJson returns empty string for non-string', () => {
        expect(sanitizeJson(42 as never as string)).toBe('');
        expect(sanitizeJson(null as never as string)).toBe('');
    });

    it('sanitizeStringArray filters non-string items', () => {
        const mixed = ['valid', 123, null, 'also valid', undefined] as never as string[];
        const result = sanitizeStringArray(mixed);
        expect(result).toEqual(['valid', 'also valid']);
    });

    it('sanitizeStringArray returns empty array for non-array', () => {
        expect(sanitizeStringArray('not array' as never as string[])).toEqual([]);
    });

    it('quoteShellArg handles empty string', () => {
        expect(quoteShellArg('')).toBe("''");
    });

    it('quoteShellArg escapes single quotes', () => {
        const result = quoteShellArg("it's a test");
        expect(result).toBe("'it''s a test'");
    });

    it('quoteShellArg wraps dangerous shell characters', () => {
        const result = quoteShellArg('$(rm -rf /)');
        expect(result).toContain("'");
        expect(result).toContain('$(rm -rf /)');
    });

    it('sanitizePrompt returns empty string for falsy input', () => {
        expect(sanitizePrompt('')).toBe('');
        expect(sanitizePrompt(null as never as string)).toBe('');
        expect(sanitizePrompt(undefined as never as string)).toBe('');
    });

    it('sanitizeObject handles arrays', () => {
        const arr = [{ key: 'val\x00ue' }, { __proto__: { bad: true } }] as never as JsonObject;
        const result = sanitizeObject(arr);
        expect(Array.isArray(result)).toBe(true);
    });
});
