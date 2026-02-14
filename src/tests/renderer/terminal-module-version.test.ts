import {
    isTerminalModuleVersionCompatible,
    serializeTerminalModuleVersion,
    TERMINAL_MODULE_VERSION,
} from '@renderer/features/terminal/utils/module-version';
import { describe, expect, it } from 'vitest';

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
