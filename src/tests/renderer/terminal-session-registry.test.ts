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

import {
    clearTerminalSessionFlags,
    isTerminalSessionInitialized,
    isTerminalSessionInitializing,
    markTerminalSessionInitialized,
    markTerminalSessionInitializing,
} from '@/features/terminal/utils/session-registry';

describe('terminal session registry utils', () => {
    it('tracks initializing and initialized flags', () => {
        const id = 'term-1';
        clearTerminalSessionFlags(id);

        expect(isTerminalSessionInitializing(id)).toBe(false);
        expect(isTerminalSessionInitialized(id)).toBe(false);

        markTerminalSessionInitializing(id);
        expect(isTerminalSessionInitializing(id)).toBe(true);
        expect(isTerminalSessionInitialized(id)).toBe(false);

        markTerminalSessionInitialized(id);
        expect(isTerminalSessionInitializing(id)).toBe(false);
        expect(isTerminalSessionInitialized(id)).toBe(true);

        clearTerminalSessionFlags(id);
        expect(isTerminalSessionInitializing(id)).toBe(false);
        expect(isTerminalSessionInitialized(id)).toBe(false);
    });
});


