import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { describe, expect, it } from 'vitest';

import { MCPSettingsTab } from '@/features/settings/components/MCPSettingsTab';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/features/settings/components/MCPServersTab', () => ({
    MCPServersTab: () => <div data-testid="mcp-servers-tab">servers</div>,
}));

vi.mock('@/features/mcp/MCPMarketplaceStudio', () => ({
    MCPMarketplaceStudio: () => <div data-testid="mcp-marketplace-tab">marketplace</div>,
}));

describe('MCPSettingsTab integration', () => {
    it('switches between marketplace and servers views', async () => {
        const user = userEvent.setup();
        render(<MCPSettingsTab />);

        expect(screen.getByText('settings.tabs.mcpMarketplace')).toBeInTheDocument();
        await user.click(screen.getByText('settings.tabs.mcpServers'));
        expect(screen.getByText('settings.tabs.mcpServers')).toBeInTheDocument();
    });
});
