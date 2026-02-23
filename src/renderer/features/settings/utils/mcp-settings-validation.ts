export type McpSettingsView = 'servers' | 'marketplace';

export function sanitizeMcpSettingsView(raw: unknown): McpSettingsView {
    if (raw === 'servers' || raw === 'marketplace') {
        return raw;
    }
    return 'marketplace';
}
