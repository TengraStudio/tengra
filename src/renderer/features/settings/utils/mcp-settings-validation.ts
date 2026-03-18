export type McpSettingsView = 'servers';

export function sanitizeMcpSettingsView(raw: RendererDataValue): McpSettingsView {
    if (raw === 'servers') {
        return raw;
    }
    return 'servers';
}
