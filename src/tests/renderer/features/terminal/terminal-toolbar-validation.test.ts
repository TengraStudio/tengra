import {
    sanitizeBackendId,
    sanitizeShellId,
} from '@renderer/features/terminal/utils/terminal-toolbar-validation';
import { describe, expect, it } from 'vitest';

describe('terminal toolbar validation', () => {
    it('sanitizes shell ids and backend ids', () => {
        expect(sanitizeShellId(' bash ')).toBe('bash');
        expect(sanitizeBackendId(' integrated ')).toBe('integrated');
    });

    it('rejects invalid shell and backend ids', () => {
        expect(sanitizeShellId('')).toBeNull();
        expect(sanitizeShellId(undefined)).toBeNull();
        expect(sanitizeBackendId('')).toBeUndefined();
        expect(sanitizeBackendId(undefined)).toBeUndefined();
    });
});
