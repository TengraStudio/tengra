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
    sanitizeBackendId,
    sanitizeShellId,
} from '@/features/terminal/utils/terminal-toolbar-validation';

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

