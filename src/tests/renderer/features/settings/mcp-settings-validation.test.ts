import { sanitizeMcpSettingsView } from '@renderer/features/settings/utils/mcp-settings-validation';
import { describe, expect, it } from 'vitest';

describe('mcp settings validation', () => {
    it('keeps valid tab views', () => {
        expect(sanitizeMcpSettingsView('marketplace')).toBe('marketplace');
        expect(sanitizeMcpSettingsView('servers')).toBe('servers');
    });

    it('falls back to marketplace for invalid values', () => {
        expect(sanitizeMcpSettingsView('')).toBe('marketplace');
        expect(sanitizeMcpSettingsView('foo')).toBe('marketplace');
        expect(sanitizeMcpSettingsView(null)).toBe('marketplace');
    });
});
