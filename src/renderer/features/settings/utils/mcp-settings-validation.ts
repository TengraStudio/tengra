export type McpSettingsView = 'servers';

export function sanitizeMcpSettingsView(raw: unknown): McpSettingsView {
    if (raw === 'servers') {
        return raw;
    }
    return 'servers';
}
