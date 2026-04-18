/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    parsePersistedPanelLayout,
    sanitizePersistedPanelLayout,
    serializePersistedPanelLayout,
} from '@renderer/components/layout/panel-layout-persistence';
import { describe, expect, it } from 'vitest';

describe('panel layout persistence helpers', () => {
    it('migrates and sanitizes legacy group payloads', () => {
        const sanitized = sanitizePersistedPanelLayout({
            groups: {
                left: { size: 80, collapsed: true, activePanel: 'explorer' },
                right: { size: 4000, collapsed: false },
            },
        });

        expect(sanitized.version).toBe(1);
        expect(sanitized.groups.left?.size).toBe(120);
        expect(sanitized.groups.right?.size).toBe(1600);
    });

    it('parses invalid JSON as null', () => {
        expect(parsePersistedPanelLayout('not-json')).toBeNull();
    });

    it('serializes normalized payloads', () => {
        const data = {
            version: 1,
            groups: {
                bottom: { size: 260, collapsed: false, activePanel: 'terminal' },
            },
        };
        const json = serializePersistedPanelLayout(data);
        expect(typeof json).toBe('string');
        const parsed = parsePersistedPanelLayout(json);
        expect(parsed?.groups.bottom?.activePanel).toBe('terminal');
    });
});
