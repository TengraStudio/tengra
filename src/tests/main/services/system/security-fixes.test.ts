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

import { quoteShellArg } from '@/../shared/utils/sanitize.util';

describe('Security Fixes Verification (SEC-001)', () => {

    describe('quoteShellArg', () => {
        it('should wrap simple strings in single quotes', () => {
            expect(quoteShellArg('foo')).toBe("'foo'");
        });

        it('should escape single quotes', () => {
            // "foo'bar" -> "'foo''bar'" (PowerShell style)
            expect(quoteShellArg("foo'bar")).toBe("'foo''bar'");
        });

        it('should handle spaces correctly', () => {
            expect(quoteShellArg('foo bar')).toBe("'foo bar'");
        });

        it('should handle empty strings', () => {
            expect(quoteShellArg('')).toBe("''");
        });
    });
});

