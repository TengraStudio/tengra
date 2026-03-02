import { registerMcpMarketplaceHandlers } from '@main/ipc/mcp-marketplace';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type IpcHandler = (...args: unknown[]) => unknown | Promise<unknown>;
const ipcMainHandlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: IpcHandler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));


describe('MCP-Marketplace IPC Handlers', () => {
    interface MockSettingsState {
        mcpTrustedPublishers: string[];
        mcpUserServers: Array<Record<string, unknown>>;
        mcpExtensionReviews: Record<string, unknown>;
        [key: string]: unknown;
    }

    let marketplaceService: {
        listServers: ReturnType<typeof vi.fn>;
        searchServers: ReturnType<typeof vi.fn>;
        filterByCategory: ReturnType<typeof vi.fn>;
        getCategories: ReturnType<typeof vi.fn>;
        refreshCache: ReturnType<typeof vi.fn>;
        getExtensionTemplates: ReturnType<typeof vi.fn>;
        createExtensionDraft: ReturnType<typeof vi.fn>;
    };
    let settingsState: MockSettingsState;
    let settingsService: {
        getSettings: ReturnType<typeof vi.fn>;
        saveSettings: ReturnType<typeof vi.fn>;
    };
    let mcpPluginService: {
        getDispatchMetrics: ReturnType<typeof vi.fn>;
        listPlugins: ReturnType<typeof vi.fn>;
    };

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
            createExtensionDraft: vi.fn((payload: { id: string; publisher: string }) => ({ id: payload.id, publisher: payload.publisher }))
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
            getDispatchMetrics: vi.fn(() => ({ dispatched: 0 })),
            listPlugins: vi.fn(async () => [])
        };

        registerMcpMarketplaceHandlers(marketplaceService as never, settingsService as never, mcpPluginService as never);
    });

    const getRequiredHandler = (channel: string): IpcHandler => {
        const handler = ipcMainHandlers.get(channel);
        if (!handler) {
            throw new Error(`Missing IPC handler: ${channel}`);
        }
        return handler;
    };

    it('returns extension templates', async () => {
        const handler = getRequiredHandler('mcp:marketplace:extension-templates');
        const result = await handler({}) as { success: boolean; templates?: Array<unknown> };
        expect(result.success).toBe(true);
        expect(result.templates).toHaveLength(1);
    });

    it('rejects draft extension for untrusted publisher', async () => {
        const handler = getRequiredHandler('mcp:marketplace:draft-extension');
        const result = await handler({}, {
            id: 'ext-1',
            name: 'Example',
            type: 'theme',
            publisher: 'unknown-publisher'
        }) as { success: boolean; error?: string; errorCode?: string; uiState?: string };
        expect(result.success).toBe(false);
        expect(result.error).toContain('not trusted');
        expect(result.errorCode).toBeDefined();
        expect(result.uiState).toBe('failure');
    });

    it('accepts draft extension for trusted publisher', async () => {
        const handler = getRequiredHandler('mcp:marketplace:draft-extension');
        const result = await handler({}, {
            id: 'ext-2',
            name: 'Example',
            type: 'theme',
            publisher: 'trusted-inc'
        }) as { success: boolean; draft?: { id: string } };
        expect(result.success).toBe(true);
        expect(result.draft?.id).toBe('ext-2');
    });

    it('runs security scan for installed server', async () => {
        const handler = getRequiredHandler('mcp:marketplace:security-scan');
        const result = await handler({}, 'srv-1') as { success: boolean; scan?: { score: number } };
        expect(result.success).toBe(true);
        expect(result.scan?.score).toBeGreaterThanOrEqual(0);
        expect(settingsService.saveSettings).toHaveBeenCalled();
    });

    it('keeps installed state unchanged when install fails validation', async () => {
        marketplaceService.listServers.mockResolvedValue([
            {
                id: 'srv-fail',
                name: 'Failing Server',
                description: 'Requires missing dependency',
                publisher: 'trusted-inc',
                command: 'npx -y srv-fail',
                dependencies: ['missing-dep'],
                categories: ['utility'],
                extensionType: 'mcp_server',
                isOfficial: true
            }
        ]);
        const beforeServers = [...settingsState.mcpUserServers];
        const installHandler = getRequiredHandler('mcp:marketplace:install');
        const result = await installHandler({}, 'srv-fail') as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toContain('Missing dependencies');
        expect(settingsState.mcpUserServers).toEqual(beforeServers);
        expect(settingsService.saveSettings).not.toHaveBeenCalledWith(
            expect.objectContaining({
                mcpUserServers: expect.arrayContaining([expect.objectContaining({ id: 'srv-fail' })])
            })
        );
    });

    it('exposes marketplace health diagnostics endpoint', async () => {
        const handler = getRequiredHandler('mcp:marketplace:health');
        const result = await handler({}) as {
            success: boolean;
            data?: {
                status: string;
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: { totalCalls: number; totalFailures: number; totalRetries: number };
            };
        };
        expect(result).toMatchObject({
            success: true,
            data: {
                status: expect.any(String),
                budgets: {
                    fastMs: 40,
                    standardMs: 130,
                    heavyMs: 280
                },
                metrics: {
                    totalCalls: expect.any(Number),
                    totalFailures: expect.any(Number),
                    totalRetries: expect.any(Number)
                }
            }
        });
    });

    it('supports review submit/list lifecycle', async () => {
        const submitHandler = getRequiredHandler('mcp:marketplace:reviews:submit');
        const listHandler = getRequiredHandler('mcp:marketplace:reviews:list');

        const submitted = await submitHandler({}, 'srv-1', {
            rating: 5,
            comment: 'Stable and useful extension for daily workflow.',
            verified: true
        }) as { success: boolean; review?: { rating: number } };
        expect(submitted.success).toBe(true);
        expect(submitted.review?.rating).toBe(5);

        const listed = await listHandler({}, 'srv-1') as { success: boolean; reviews?: unknown[] };
        expect(listed.success).toBe(true);
        expect(listed.reviews).toHaveLength(1);
    });
});
