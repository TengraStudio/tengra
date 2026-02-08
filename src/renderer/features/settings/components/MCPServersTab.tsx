import { CheckCircle2, Edit2, Power, Server, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface MCPServer {
    id: string
    name: string
    command: string
    args: string[]
    description?: string
    env?: Record<string, string>
    enabled?: boolean
    tools?: { name: string; description: string }[]
    category?: string
    publisher?: string
    version?: string
    isOfficial?: boolean
}

export const MCPServersTab = () => {
    const { t } = useTranslation();
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [loading, setLoading] = useState(true);

    const loadServers = useCallback(async () => {
        try {
            setLoading(true);
            const result = await window.electron.mcpMarketplace.installed();
            console.log('MCP Servers loaded:', result);
            if (result.success && result.servers) {
                // Properly cast from IpcValue[] to MCPServer[]
                const servers = result.servers as unknown as MCPServer[];
                console.log('Parsed servers:', servers);
                console.log('Total servers:', servers.length);
                console.log('Internal servers:', servers.filter(s => s.category === 'Internal').length);
                console.log('User servers:', servers.filter(s => s.category !== 'Internal').length);
                setServers(servers);
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadServers();
    }, [loadServers]);

    const handleToggle = useCallback(
        async (serverId: string, currentEnabled: boolean, isInternal: boolean) => {
            // Internal tools cannot be toggled
            if (isInternal) {
                return;
            }

            try {
                const result = await window.electron.mcpMarketplace.toggle(serverId, !currentEnabled);
                if (result.success) {
                    await loadServers();
                }
            } catch (error) {
                console.error('Failed to toggle server:', error);
            }
        },
        [loadServers]
    );

    const handleDelete = useCallback(
        async (serverId: string, isInternal: boolean) => {
            // Internal tools cannot be deleted
            if (isInternal) {
                return;
            }

            try {
                const result = await window.electron.mcpMarketplace.uninstall(serverId);
                if (result.success) {
                    await loadServers();
                }
            } catch (error) {
                console.error('Failed to delete server:', error);
            }
        },
        [loadServers]
    );

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="w-5 h-5" />
                        {t('settings.mcp.servers.title')}
                    </h2>
                    <p className="text-sm text-muted-foreground">{t('settings.mcp.servers.subtitle')}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                    {servers.filter(s => s.enabled).length} / {servers.length} {t('settings.mcp.servers.enabled')}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {servers.map(server => {
                        const isInternal = server.category === 'Internal';
                        return (
                            <div
                                key={server.id}
                                className={cn(
                                    'group flex items-center justify-between p-4 border rounded-xl transition-all',
                                    server.enabled
                                        ? 'bg-primary/5 border-primary/30'
                                        : 'bg-muted/30 border-border/50 hover:border-border/80'
                                )}
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div
                                        className={cn(
                                            'p-2.5 rounded-lg',
                                            server.enabled
                                                ? 'bg-success/10 text-success'
                                                : 'bg-muted/10 text-muted-foreground'
                                        )}
                                    >
                                        <Server className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium">{server.name}</h3>
                                            {server.isOfficial && (
                                                <Shield className="w-3.5 h-3.5 text-primary" />
                                            )}
                                            {server.category && (
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded text-xxs uppercase border",
                                                    isInternal
                                                        ? "bg-primary/10 text-primary border-primary/30"
                                                        : "bg-muted text-muted-foreground"
                                                )}>
                                                    {server.category}
                                                </span>
                                            )}
                                            {server.version && (
                                                <span className="text-xxs text-muted-foreground">
                                                    v{server.version}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {server.description || `${server.command} ${server.args.join(' ')}`}
                                        </p>
                                        {server.publisher && (
                                            <p className="text-xxs text-muted-foreground/60 mt-1">
                                                {t('mcp.byAuthor', { author: server.publisher, version: '' })}
                                            </p>
                                        )}
                                        {server.tools && server.tools.length > 0 && (
                                            <p className="text-xxs text-muted-foreground/60 mt-1">
                                                {server.tools.length} {server.tools.length === 1 ? 'tool' : 'tools'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Enable/Disable Toggle */}
                                    <button
                                        onClick={() => handleToggle(server.id, server.enabled || false, isInternal)}
                                        disabled={isInternal}
                                        className={cn(
                                            'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                                            isInternal
                                                ? 'bg-primary/5 border-primary/30 text-primary cursor-default'
                                                : server.enabled
                                                    ? 'bg-success/10 border-success/30 text-success hover:bg-success/20'
                                                    : 'bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted'
                                        )}
                                        title={isInternal ? t('settings.mcp.servers.internalAlwaysEnabled') : ''}
                                    >
                                        <Power className={cn('w-3.5 h-3.5', server.enabled && 'fill-current')} />
                                        {server.enabled ? t('settings.mcp.status.enabled') : t('settings.mcp.status.disabled')}
                                    </button>

                                    {/* Status Indicator */}
                                    <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-full border border-border/50">
                                        {server.enabled ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-muted" />
                                        )}
                                        <span className="text-xs capitalize">
                                            {server.enabled ? t('settings.mcp.status.active') : t('settings.mcp.status.inactive')}
                                        </span>
                                    </div>

                                    {/* Action Buttons (hidden for internal tools) */}
                                    {!isInternal && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                                                title={t('common.edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(server.id, isInternal)}
                                                className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {servers.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50 border border-dashed border-border/50 rounded-xl">
                            <Server className="w-10 h-10 mb-3 opacity-20" />
                            <p className="mb-1">{t('settings.mcp.servers.empty')}</p>
                            <p className="text-xs">{t('settings.mcp.servers.emptyHint')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Info Box */}
            {servers.length > 0 && (
                <div className="p-4 bg-muted/30 border border-border/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                        <strong>{t('settings.mcp.servers.note')}:</strong> {t('settings.mcp.servers.noteText')}
                    </p>
                </div>
            )}
        </div>
    );
};
