import { mcpMarketplaceClient } from '@renderer/lib/mcp-marketplace-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('mcpMarketplaceClient', () => {
    beforeEach(() => {
        (window as any).electron = {
            ipcRenderer: {
                invoke: vi.fn().mockImplementation((channel) => {
                    if (channel === 'ipc:contract:get') {
                        return Promise.resolve({
                            version: 1,
                            minRendererVersion: 1,
                            minMainVersion: 1
                        });
                    }
                    return Promise.resolve({ success: true, servers: [] });
                })
            }
        };
    });


    it('validates and invokes list channel', async () => {
        const result = await mcpMarketplaceClient.list();
        expect(result.success).toBe(true);
        const invoke = (window as unknown as {
            electron: { ipcRenderer: { invoke: ReturnType<typeof vi.fn> } }
        }).electron.ipcRenderer.invoke;
        expect(invoke).toHaveBeenCalledWith('mcp:marketplace:list');
    });

    it('invokes update-config with payload', async () => {
        const invoke = vi.fn().mockResolvedValue({ success: true });
        (window as unknown as { electron: unknown }).electron = {
            ipcRenderer: { invoke }
        };

        const result = await mcpMarketplaceClient.updateConfig('server-1', { command: 'npx -y test' });
        expect(result.success).toBe(true);
        expect(invoke).toHaveBeenCalledWith('mcp:marketplace:update-config', 'server-1', { command: 'npx -y test' });
    });
});

