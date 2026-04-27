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

import { resolveBreakpoint } from '@/lib/responsive';

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
