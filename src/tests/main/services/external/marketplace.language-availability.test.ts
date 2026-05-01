/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MarketplaceService } from '@main/services/external/marketplace.service';
import { MarketplaceRegistry } from '@shared/types/marketplace';
import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => 'C:\\Users\\agnes\\AppData\\Roaming\\Tengra'),
    },
}));

vi.mock('axios', () => {
    const get = vi.fn();
    const head = vi.fn();
    const isAxiosError = (error: unknown) => {
        return Boolean(error && typeof error === 'object' && (error as { isAxiosError?: boolean }).isAxiosError);
    };
    return {
        default: { get, head, isAxiosError },
        get,
        head,
        isAxiosError,
    };
});

interface MarketplaceServiceInternals {
    filterUnavailableLanguagePacks: (registry: MarketplaceRegistry) => Promise<MarketplaceRegistry>;
}

function createRegistry(): MarketplaceRegistry {
    return {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        themes: [],
        mcp: [],
        languages: [
            {
                id: 'lang-ok',
                name: 'Lang OK',
                description: 'desc',
                author: 'test',
                version: '1.0.0',
                downloadUrl: 'https://example.com/languages/ok.locale.json',
                itemType: 'language',
                locale: 'tr',
                nativeName: 'Turkce',
                schemaVersion: '1.0.0',
            },
            {
                id: 'lang-missing',
                name: 'Lang Missing',
                description: 'desc',
                author: 'test',
                version: '1.0.0',
                downloadUrl: 'https://example.com/languages/missing.locale.json',
                itemType: 'language',
                locale: 'de',
                nativeName: 'Deutsch',
                schemaVersion: '1.0.0',
            },
        ],
    };
}

describe('MarketplaceService language availability filtering', () => {
    it('removes language packs when download URL returns 404', async () => {
        const headMock = vi.mocked(axios.head);
        headMock.mockResolvedValueOnce({ status: 200 } as never);
        headMock.mockRejectedValueOnce({
            isAxiosError: true,
            response: { status: 404 },
        } as never);

        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const filtered = await internals.filterUnavailableLanguagePacks(createRegistry());

        expect(filtered.languages?.map(language => language.id)).toEqual(['lang-ok']);
    });

    it('keeps language packs when availability cannot be determined', async () => {
        const headMock = vi.mocked(axios.head);
        headMock.mockRejectedValue(new Error('network timeout'));

        const service = new MarketplaceService({});
        const internals = service as unknown as MarketplaceServiceInternals;

        const filtered = await internals.filterUnavailableLanguagePacks(createRegistry());

        expect(filtered.languages?.map(language => language.id)).toEqual(['lang-ok', 'lang-missing']);
    });
});

