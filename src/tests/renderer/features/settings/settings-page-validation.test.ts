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
    normalizeSettingsSearchQuery,
    validateSettingsPayload,
    validateSettingsSearchQuery,
} from '@/features/settings/utils/settings-page-validation';
import { AppSettings } from '@/types/settings';

const settingsFixture: AppSettings = {
    ollama: { url: 'http://localhost:11434' },
    embeddings: { provider: 'none' },
    general: {
        language: 'en',
        theme: 'dark',
        resolution: '1920x1080',
        fontSize: 14,

    },
    proxy: { enabled: true, url: 'http://127.0.0.1:8317', key: '' },
};

describe('settings-page-validation', () => {
    it('accepts valid settings payload', () => {
        expect(validateSettingsPayload(settingsFixture)).toBe(true);
    });

    it('rejects invalid settings payload without embeddings', () => {
        const { embeddings: _embeddings, ...invalid } = settingsFixture;
        expect(validateSettingsPayload(invalid as AppSettings)).toBe(false);
    });

    it('normalizes long search query to empty', () => {
        const query = 'a'.repeat(300);
        expect(validateSettingsSearchQuery(query)).toBe(false);
        expect(normalizeSettingsSearchQuery(query)).toBe('');
    });
});

