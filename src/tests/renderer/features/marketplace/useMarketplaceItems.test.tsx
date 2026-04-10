import type { MarketplaceRegistry } from '@shared/types/marketplace';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { McpPlugin } from '@/features/marketplace/components/McpMarketplace';
import { useMarketplaceItems } from '@/features/marketplace/hooks/useMarketplaceItems';
import type { MarketplaceQueryState } from '@/features/marketplace/marketplace-query.types';

function createMcpQuery(overrides: Partial<MarketplaceQueryState> = {}): MarketplaceQueryState {
    return {
        search: '',
        filter: 'all',
        sort: 'name_asc',
        mcpView: 'all',
        page: 1,
        modelTab: 'ollama',
        modelFit: 'all',
        modelTarget: 'all',
        ...overrides,
    };
}

function createBaseRegistry(): MarketplaceRegistry {
    return {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        themes: [],
        mcp: [],
        personas: [],
        models: [],
        prompts: [],
        languages: [],
        skills: [],
        extensions: [],
    };
}

describe('useMarketplaceItems MCP filtering', () => {
    it('uses local MCP install state for installed view and avoids duplicates', () => {
        const registry: MarketplaceRegistry = {
            ...createBaseRegistry(),
            mcp: [
                {
                    id: 'tengra.local-installed',
                    name: 'Local Installed',
                    description: 'Installed via settings',
                    author: 'Tengra',
                    version: '1.0.0',
                    downloadUrl: 'https://example.com/installed.json',
                    itemType: 'mcp',
                    category: 'Tools',
                    command: 'node',
                    args: [],
                    installed: false,
                },
                {
                    id: 'tengra.not-installed',
                    name: 'Not Installed',
                    description: 'Not installed',
                    author: 'Tengra',
                    version: '1.0.0',
                    downloadUrl: 'https://example.com/not-installed.json',
                    itemType: 'mcp',
                    category: 'Tools',
                    command: 'node',
                    args: [],
                    installed: false,
                },
            ],
        };
        const localPlugins: McpPlugin[] = [{
            id: 'tengra.local-installed',
            name: 'Local Installed',
            description: 'Installed via settings',
            isEnabled: true,
            isAlive: true,
            source: 'user',
            actions: [],
        }];

        const { result } = renderHook(() => useMarketplaceItems({
            mode: 'mcp',
            registry,
            localPlugins,
            query: createMcpQuery({ mcpView: 'installed' }),
        }));

        expect(result.current.combinedItems).toHaveLength(1);
        expect(result.current.combinedItems[0]?.type).toBe('store');
        if (result.current.combinedItems[0]?.type === 'store') {
            expect(result.current.combinedItems[0].item.id).toBe('tengra.local-installed');
            expect(result.current.combinedItems[0].item.installed).toBe(true);
        }
    });

    it('keeps external view limited to non-internal MCP entries', () => {
        const registry: MarketplaceRegistry = {
            ...createBaseRegistry(),
            mcp: [
                {
                    id: 'tengra.internal-core',
                    name: 'Core',
                    description: 'Internal MCP',
                    author: 'Tengra',
                    version: '1.0.0',
                    downloadUrl: 'https://example.com/core.json',
                    itemType: 'mcp',
                    category: 'Internal',
                    command: 'node',
                    args: [],
                    installed: true,
                },
                {
                    id: 'tengra.external-store',
                    name: 'External Store',
                    description: 'External MCP',
                    author: 'Tengra',
                    version: '1.0.0',
                    downloadUrl: 'https://example.com/external.json',
                    itemType: 'mcp',
                    category: 'Productivity',
                    command: 'node',
                    args: [],
                    installed: false,
                },
            ],
        };
        const localPlugins: McpPlugin[] = [
            {
                id: 'tengra.internal-core',
                name: 'Core',
                description: 'Internal MCP',
                isEnabled: true,
                isAlive: true,
                source: 'core',
                actions: [],
            },
            {
                id: 'tengra.external-local',
                name: 'External Local',
                description: 'Installed but not in registry',
                isEnabled: true,
                isAlive: true,
                source: 'user',
                actions: [],
            },
        ];

        const { result } = renderHook(() => useMarketplaceItems({
            mode: 'mcp',
            registry,
            localPlugins,
            query: createMcpQuery({ mcpView: 'external' }),
        }));

        const ids = result.current.combinedItems.map(entry =>
            entry.type === 'local' ? entry.plugin.id : entry.item.id
        );
        expect(ids).toContain('tengra.external-store');
        expect(ids).toContain('tengra.external-local');
        expect(ids).not.toContain('tengra.internal-core');
    });
});

