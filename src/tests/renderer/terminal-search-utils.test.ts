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

import { collectTerminalSearchMatches } from '@/features/terminal/utils/terminal-search';

describe('terminal search utils', () => {
    it('collects plain-text matches across rows', () => {
        const result = collectTerminalSearchMatches(
            ['npm run build', 'build failed', 'rebuild all'],
            'build',
            { useRegex: false }
        );

        expect(result.invalidRegex).toBe(false);
        expect(result.matches).toEqual([
            { row: 0, col: 8, length: 5 },
            { row: 1, col: 0, length: 5 },
            { row: 2, col: 2, length: 5 },
        ]);
    });

    it('respects case sensitivity in plain-text mode', () => {
        const insensitive = collectTerminalSearchMatches(['Build build'], 'build', {
            useRegex: false,
            caseSensitive: false,
        });
        const sensitive = collectTerminalSearchMatches(['Build build'], 'build', {
            useRegex: false,
            caseSensitive: true,
        });

        expect(insensitive.matches).toHaveLength(2);
        expect(sensitive.matches).toHaveLength(1);
        expect(sensitive.matches[0]).toEqual({ row: 0, col: 6, length: 5 });
    });

    it('collects regex matches and reports invalid regex payloads', () => {
        const result = collectTerminalSearchMatches(['ERR_1 ERR_2 ok'], 'ERR_\\d', {
            useRegex: true,
        });
        expect(result.invalidRegex).toBe(false);
        expect(result.matches).toHaveLength(2);

        const invalid = collectTerminalSearchMatches(['ERR_1'], '[ERR', { useRegex: true });
        expect(invalid.invalidRegex).toBe(true);
        expect(invalid.matches).toHaveLength(0);
    });

    it('caps total matches with maxMatches', () => {
        const result = collectTerminalSearchMatches(['a a a a a'], 'a', {
            useRegex: false,
            maxMatches: 3,
        });
        expect(result.matches).toHaveLength(3);
    });
});

