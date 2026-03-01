import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@shared/utils/sanitize.util', () => ({
    safeJsonParse: <T,>(str: string, fallback: T): T => {
        try {
            return JSON.parse(str) as T;
        } catch {
            return fallback;
        }
    },
}));

vi.mock('@/lib/mcp-marketplace-client', () => ({
    mcpMarketplaceClient: {
        list: vi.fn().mockResolvedValue({ success: true, servers: [] }),
        installed: vi.fn().mockResolvedValue({ success: true, servers: [] }),
        install: vi.fn().mockResolvedValue({ success: true }),
        uninstall: vi.fn().mockResolvedValue({ success: true }),
    },
    McpServerLike: {},
}));

vi.mock('@/lib/utils', () => ({
    cn: (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(' '),
}));

// Mock window.electron
const mockElectron = {
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
};
Object.defineProperty(window, 'electron', { value: mockElectron, writable: true });

import { MCPStore } from '@/features/mcp/MCPStore';

describe('MCPStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders without crashing', async () => {
        const { container } = render(<MCPStore />);
        await waitFor(() => {
            expect(container.firstChild).toBeTruthy();
        });
    });

    it('displays store title', async () => {
        render(<MCPStore />);
        await waitFor(() => {
            expect(screen.getByText('mcp.storeTitle')).toBeInTheDocument();
        });
    });

    it('renders search input', async () => {
        render(<MCPStore />);
        await waitFor(() => {
            expect(screen.getByPlaceholderText('mcp.searchTools')).toBeInTheDocument();
        });
    });

    it('renders category buttons', async () => {
        render(<MCPStore />);
        await waitFor(() => {
            expect(screen.getByText('mcp.categories.all')).toBeInTheDocument();
            expect(screen.getByText('mcp.categories.web')).toBeInTheDocument();
        });
    });

    it('shows loading state initially', () => {
        render(<MCPStore />);
        expect(screen.getByText('common.loading')).toBeInTheDocument();
    });

    it('updates search query on input', async () => {
        render(<MCPStore />);
        await waitFor(() => {
            expect(screen.getByPlaceholderText('mcp.searchTools')).toBeInTheDocument();
        });
        const input = screen.getByPlaceholderText('mcp.searchTools');
        fireEvent.change(input, { target: { value: 'test query' } });
        expect(input).toHaveValue('test query');
    });

    it('accepts onInstall, onUninstall, onConfigure props', async () => {
        const onInstall = vi.fn();
        const onUninstall = vi.fn();
        const onConfigure = vi.fn();
        const { container } = render(
            <MCPStore
                onInstall={onInstall}
                onUninstall={onUninstall}
                onConfigure={onConfigure}
            />
        );
        await waitFor(() => {
            expect(container.firstChild).toBeTruthy();
        });
    });
});
