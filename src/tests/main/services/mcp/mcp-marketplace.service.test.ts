import { McpMarketplaceService } from '@main/services/mcp/mcp-marketplace.service';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        isAxiosError: vi.fn((error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError))
    }
}));

describe('McpMarketplaceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads marketplace servers from Tengra marketplace API', async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                themes: [
                    {
                        id: 'theme-midnight',
                        name: 'Midnight',
                        description: 'Dark theme',
                        publisher: 'Tengra',
                        extensionType: 'theme'
                    }
                ],
                extensions: [
                    {
                        id: 'git-flow-tools',
                        name: 'Git Flow Tools',
                        description: 'Workflow helpers',
                        publisher: 'Tengra',
                        extensionType: 'integration'
                    }
                ]
            }
        });

        const service = new McpMarketplaceService();
        const result = await service.listServers();

        expect(axios.get).toHaveBeenCalledWith(
            'https://api.tengra.studio/marketplace',
            expect.objectContaining({
                timeout: 10000
            })
        );
        expect(result.map(item => item.id)).toEqual(expect.arrayContaining(['theme-midnight', 'git-flow-tools']));
        expect(result.find(item => item.id === 'theme-midnight')?.extensionType).toBe('theme');
    });

    it('falls back to GitHub source when Tengra API request fails', async () => {
        vi.mocked(axios.get)
            .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
            .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
            .mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
            .mockResolvedValueOnce({ data: [] });

        const service = new McpMarketplaceService();
        await service.listServers();

        expect(axios.get).toHaveBeenCalledWith(
            'https://api.github.com/repos/modelcontextprotocol/servers/contents/src',
            expect.objectContaining({
                timeout: 10000
            })
        );
    });
});
