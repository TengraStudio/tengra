import {
    clearTerminalSessionFlags,
    isTerminalSessionInitialized,
    isTerminalSessionInitializing,
    markTerminalSessionInitialized,
    markTerminalSessionInitializing,
} from '@renderer/features/terminal/utils/session-registry';
import { describe, expect, it } from 'vitest';

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

