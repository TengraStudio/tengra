import { registerMcpMarketplaceHandlers } from '@main/ipc/mcp-marketplace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcMainHandlers = new Map<string, (...args: any[]) => any>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createValidatedIpcHandler: (
        _name: string,
        handler: (...args: any[]) => any,
        options?: { argsSchema?: { parse: (args: unknown[]) => unknown[] }; onError?: (error: Error) => unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            const parsedArgs = options?.argsSchema ? options.argsSchema.parse(args) : args;
            return await handler(event, ...(parsedArgs as unknown[]));
        } catch (error: any) {
            if (options?.onError) {
                return options.onError(error);
            }
            return { success: false, error: error.message ?? 'Validation failed' };
        }
    }
}));

describe('MCP-Marketplace IPC Handlers', () => {
    let marketplaceService: any;
    let settingsState: any;
    let settingsService: any;
    let mcpPluginService: any;

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();

        marketplaceService = {
            listServers: vi.fn(async () => []),
            searchServers: vi.fn(async () => []),
            filterByCategory: vi.fn(async () => []),
            getCategories: vi.fn(async () => ['utility']),
            refreshCache: vi.fn(async () => undefined),
            getExtensionTemplates: vi.fn(() => [{ type: 'theme', displayName: 'Theme Extension' }]),
            createExtensionDraft: vi.fn((payload: any) => ({ id: payload.id, publisher: payload.publisher }))
        };

        settingsState = {
            mcpTrustedPublishers: ['trusted-inc'],
            mcpUserServers: [{ id: 'srv-1', name: 'S', command: 'node app.js', args: [], enabled: true }],
            mcpExtensionReviews: {}
        };
        settingsService = {
            getSettings: vi.fn(() => settingsState),
            saveSettings: vi.fn(async (patch: Record<string, unknown>) => {
                settingsState = { ...settingsState, ...patch };
            })
        };
        mcpPluginService = {
            getDispatchMetrics: vi.fn(() => ({ dispatched: 0 }))
        };

        registerMcpMarketplaceHandlers(marketplaceService, settingsService, mcpPluginService);
    });

    it('returns extension templates', async () => {
        const handler = ipcMainHandlers.get('mcp:marketplace:extension-templates');
        const result = await handler?.({});
        expect(result.success).toBe(true);
        expect(result.templates).toHaveLength(1);
    });

    it('rejects draft extension for untrusted publisher', async () => {
        const handler = ipcMainHandlers.get('mcp:marketplace:draft-extension');
        const result = await handler?.({}, {
            id: 'ext-1',
            name: 'Example',
            type: 'theme',
            publisher: 'unknown-publisher'
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('not trusted');
    });

    it('accepts draft extension for trusted publisher', async () => {
        const handler = ipcMainHandlers.get('mcp:marketplace:draft-extension');
        const result = await handler?.({}, {
            id: 'ext-2',
            name: 'Example',
            type: 'theme',
            publisher: 'trusted-inc'
        });
        expect(result.success).toBe(true);
        expect(result.draft.id).toBe('ext-2');
    });

    it('runs security scan for installed server', async () => {
        const handler = ipcMainHandlers.get('mcp:marketplace:security-scan');
        const result = await handler?.({}, 'srv-1');
        expect(result.success).toBe(true);
        expect(result.scan.score).toBeGreaterThanOrEqual(0);
        expect(settingsService.saveSettings).toHaveBeenCalled();
    });

    it('supports review submit/list lifecycle', async () => {
        const submitHandler = ipcMainHandlers.get('mcp:marketplace:reviews:submit');
        const listHandler = ipcMainHandlers.get('mcp:marketplace:reviews:list');

        const submitted = await submitHandler?.({}, 'srv-1', {
            rating: 5,
            comment: 'Stable and useful extension for daily workflow.',
            verified: true
        });
        expect(submitted.success).toBe(true);
        expect(submitted.review.rating).toBe(5);

        const listed = await listHandler?.({}, 'srv-1');
        expect(listed.success).toBe(true);
        expect(listed.reviews.length).toBe(1);
    });
});
