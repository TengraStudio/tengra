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
    isTerminalModuleVersionCompatible,
    serializeTerminalModuleVersion,
    TERMINAL_MODULE_VERSION,
} from '@/features/terminal/utils/module-version';

describe('terminal module version utils', () => {
    it('serializes the current module version as semver', () => {
        expect(serializeTerminalModuleVersion()).toBe(
            `${TERMINAL_MODULE_VERSION.major}.${TERMINAL_MODULE_VERSION.minor}.${TERMINAL_MODULE_VERSION.patch}`
        );
    });

    it('accepts versions with the same major number', () => {
        expect(isTerminalModuleVersionCompatible('2.0.0')).toBe(true);
        expect(isTerminalModuleVersionCompatible('2.9.9')).toBe(true);
    });

    it('rejects non-semver or incompatible major versions', () => {
        expect(isTerminalModuleVersionCompatible('1.9.9')).toBe(false);
        expect(isTerminalModuleVersionCompatible('3.0.0')).toBe(false);
        expect(isTerminalModuleVersionCompatible('invalid')).toBe(false);
    });
});

