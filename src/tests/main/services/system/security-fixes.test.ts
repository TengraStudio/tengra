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
