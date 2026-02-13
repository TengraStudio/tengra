import { resolveBreakpoint } from '@renderer/lib/responsive';
import { describe, expect, it } from 'vitest';

describe('responsive helpers', () => {
    it('resolves breakpoints using expected width thresholds', () => {
        expect(resolveBreakpoint(0)).toBe('mobile');
        expect(resolveBreakpoint(639)).toBe('mobile');
        expect(resolveBreakpoint(640)).toBe('tablet');
        expect(resolveBreakpoint(1023)).toBe('tablet');
        expect(resolveBreakpoint(1024)).toBe('desktop');
        expect(resolveBreakpoint(1439)).toBe('desktop');
        expect(resolveBreakpoint(1440)).toBe('wide');
    });
});
