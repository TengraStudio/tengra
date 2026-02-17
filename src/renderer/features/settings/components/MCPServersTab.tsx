import { CheckCircle2, Edit2, Power, Server, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { mcpMarketplaceClient } from '@/lib/mcp-marketplace-client';
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

interface ServerItemProps {
    server: MCPServer
    t: (key: string, options?: Record<string, string | number>) => string
    handleToggle: (serverId: string, currentEnabled: boolean, isInternal: boolean) => void
    handleDelete: (serverId: string, isInternal: boolean) => void
    handleEdit: (server: MCPServer) => void
}

const ServerItem: React.FC<ServerItemProps> = ({ server, t, handleToggle, handleDelete, handleEdit }) => {
    const isInternal = server.category === 'Internal';

    return (
        <div
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
                        {server.description ?? `${server.command} ${server.args.join(' ')}`}
                    </p>
                    {server.publisher && (
                        <p className="text-xxs text-muted-foreground/60 mt-1">
                            {t('mcp.byAuthor', { author: server.publisher, version: server.version ?? '1.0.0' })}
                        </p>
                    )}
                    {server.tools && server.tools.length > 0 && (
                        <p className="text-xxs text-muted-foreground/60 mt-1">
                            {server.tools.length} {server.tools.length === 1 ? t('mcp.tool') : t('mcp.tools')}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => { handleToggle(server.id, server.enabled ?? false, isInternal); }}
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

                {!isInternal && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => handleEdit(server)}
                            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                            title={t('common.edit')}
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => { handleDelete(server.id, isInternal); }}
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
};

export const MCPServersTab = () => {
    const { t } = useTranslation();
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [permissionRequests, setPermissionRequests] = useState<Array<{
        id: string;
        service: string;
        action: string;
        createdAt: number;
        argsPreview?: string;
        status: 'pending' | 'approved' | 'denied';
    }>>([]);
    const [debugMetrics, setDebugMetrics] = useState<Array<{
        key: string;
        count: number;
        errors: number;
        avgDurationMs: number;
        lastDurationMs: number;
        lastError?: string;
    }>>([]);
    const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
    const [draftCommand, setDraftCommand] = useState('');
    const [draftVersion, setDraftVersion] = useState('');
    const [versionHistory, setVersionHistory] = useState<string[]>([]);

    const loadServers = useCallback(async () => {
        try {
            setLoading(true);
            const result = await mcpMarketplaceClient.installed();
            if (result.success && result.servers) {
                const servers = result.servers as unknown as MCPServer[];
                setServers(servers);
            }
        } catch (error) {
            window.electron.log.error('Failed to load servers:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadDiagnostics = useCallback(async () => {
        try {
            const [requests, metrics] = await Promise.all([
                window.electron.mcp.listPermissionRequests(),
                window.electron.mcp.getDebugMetrics()
            ]);
            setPermissionRequests(
                (requests as Array<{
                    id: string;
                    service: string;
                    action: string;
                    createdAt: number;
                    argsPreview?: string;
                    status: 'pending' | 'approved' | 'denied';
                }>) ?? []
            );
            setDebugMetrics(
                (metrics as Array<{
                    key: string;
                    count: number;
                    errors: number;
                    avgDurationMs: number;
                    lastDurationMs: number;
                    lastError?: string;
                }>) ?? []
            );
        } catch (error) {
            window.electron.log.error('Failed to load MCP diagnostics:', error);
        }
    }, []);

    useEffect(() => {
        void loadServers();
        void loadDiagnostics();
    }, [loadServers, loadDiagnostics]);

    const handleToggle = useCallback(
        async (serverId: string, currentEnabled: boolean, isInternal: boolean) => {
            if (isInternal) { return; }
            try {
                const result = await mcpMarketplaceClient.toggle(serverId, !currentEnabled);
                if (result.success) { await loadServers(); }
            } catch (error) {
                window.electron.log.error('Failed to toggle server:', error);
            }
        },
        [loadServers]
    );

    const handleDelete = useCallback(
        async (serverId: string, isInternal: boolean) => {
            if (isInternal) { return; }
            try {
                const result = await mcpMarketplaceClient.uninstall(serverId);
                if (result.success) { await loadServers(); }
            } catch (error) {
                window.electron.log.error('Failed to delete server:', error);
            }
        },
        [loadServers]
    );

    const handleEdit = useCallback(async (server: MCPServer) => {
        setEditingServer(server);
        setDraftCommand([server.command, ...(server.args ?? [])].join(' ').trim());
        setDraftVersion(server.version ?? '');
        try {
            const result = await mcpMarketplaceClient.versionHistory(server.id);
            if (result.success && result.history) {
                setVersionHistory(result.history);
            } else {
                setVersionHistory([]);
            }
        } catch {
            setVersionHistory([]);
        }
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!editingServer) {
            return;
        }
        const trimmed = draftCommand.trim();
        if (!trimmed) {
            return;
        }
        try {
            const result = await mcpMarketplaceClient.updateConfig(editingServer.id, {
                command: trimmed,
                version: draftVersion.trim() || editingServer.version
            });
            if (result.success) {
                setEditingServer(null);
                await loadServers();
            }
        } catch (error) {
            window.electron.log.error('Failed to update MCP server config:', error);
        }
    }, [draftCommand, draftVersion, editingServer, loadServers]);

    const handleRollback = useCallback(async (targetVersion: string) => {
        if (!editingServer) {
            return;
        }
        try {
            const result = await mcpMarketplaceClient.rollbackVersion(editingServer.id, targetVersion);
            if (result.success) {
                setEditingServer(null);
                await loadServers();
            }
        } catch (error) {
            window.electron.log.error('Failed to rollback MCP server version:', error);
        }
    }, [editingServer, loadServers]);

    const handleResolvePermission = useCallback(async (requestId: string, decision: 'approved' | 'denied') => {
        try {
            await window.electron.mcp.resolvePermissionRequest(requestId, decision);
            await loadDiagnostics();
        } catch (error) {
            window.electron.log.error('Failed to resolve MCP permission request:', error);
        }
    }, [loadDiagnostics]);

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
                    {servers.map(server => (
                        <ServerItem
                            key={server.id}
                            server={server}
                            t={t}
                            handleToggle={(serverId, currentEnabled, isInternal) => { void handleToggle(serverId, currentEnabled, isInternal); }}
                            handleDelete={(serverId, isInternal) => { void handleDelete(serverId, isInternal); }}
                            handleEdit={(server) => { void handleEdit(server); }}
                        />
                    ))}

                    {servers.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50 border border-dashed border-border/50 rounded-xl">
                            <Server className="w-10 h-10 mb-3 opacity-20" />
                            <p className="mb-1">{t('settings.mcp.servers.empty')}</p>
                            <p className="text-xs">{t('settings.mcp.servers.emptyHint')}</p>
                        </div>
                    )}
                </div>
            )}

            {servers.length > 0 && (
                <div className="p-4 bg-muted/30 border border-border/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                        <strong>{t('mcp.note')}:</strong> {t('mcp.noteText')}
                    </p>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="p-4 border border-border/30 rounded-lg bg-card/40">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Permission Requests</h3>
                        <button
                            onClick={() => { void loadDiagnostics(); }}
                            className="text-xs px-2 py-1 rounded bg-muted/40 hover:bg-muted/60"
                        >
                            Refresh
                        </button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {permissionRequests.length === 0 && (
                            <p className="text-xs text-muted-foreground">No permission requests.</p>
                        )}
                        {permissionRequests.map(req => (
                            <div key={req.id} className="border border-border/30 rounded p-2 text-xs">
                                <div className="font-medium">{req.service}:{req.action}</div>
                                <div className="text-muted-foreground">
                                    {new Date(req.createdAt).toLocaleString()}
                                </div>
                                {req.argsPreview && (
                                    <pre className="mt-1 p-1 rounded bg-muted/30 text-[11px] whitespace-pre-wrap break-all">{req.argsPreview}</pre>
                                )}
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-muted/40">{req.status}</span>
                                    {req.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => { void handleResolvePermission(req.id, 'approved'); }}
                                                className="px-2 py-0.5 rounded bg-success/15 text-success hover:bg-success/25"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => { void handleResolvePermission(req.id, 'denied'); }}
                                                className="px-2 py-0.5 rounded bg-destructive/15 text-destructive hover:bg-destructive/25"
                                            >
                                                Deny
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border border-border/30 rounded-lg bg-card/40">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">MCP Debug Metrics</h3>
                        <button
                            onClick={() => { void loadDiagnostics(); }}
                            className="text-xs px-2 py-1 rounded bg-muted/40 hover:bg-muted/60"
                        >
                            Refresh
                        </button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {debugMetrics.length === 0 && (
                            <p className="text-xs text-muted-foreground">No metrics yet.</p>
                        )}
                        {debugMetrics
                            .slice()
                            .sort((a, b) => b.count - a.count)
                            .map(metric => (
                                <div key={metric.key} className="border border-border/30 rounded p-2 text-xs">
                                    <div className="font-medium">{metric.key}</div>
                                    <div className="text-muted-foreground">
                                        calls: {metric.count} | errors: {metric.errors}
                                    </div>
                                    <div className="text-muted-foreground">
                                        avg: {metric.avgDurationMs.toFixed(1)}ms | last: {metric.lastDurationMs.toFixed(1)}ms
                                    </div>
                                    {metric.lastError && (
                                        <div className="text-destructive mt-1">{metric.lastError}</div>
                                    )}
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {editingServer && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-card border border-border/40 rounded-xl p-4 space-y-4">
                        <div>
                            <h3 className="text-base font-semibold">{editingServer.name}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t('mcp.configure')}
                            </p>
                        </div>

                        <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">Command</span>
                            <input
                                value={draftCommand}
                                onChange={e => setDraftCommand(e.target.value)}
                                className="w-full bg-muted/30 border border-border/30 rounded-md px-3 py-2 text-sm"
                            />
                        </label>

                        <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">Version</span>
                            <input
                                value={draftVersion}
                                onChange={e => setDraftVersion(e.target.value)}
                                className="w-full bg-muted/30 border border-border/30 rounded-md px-3 py-2 text-sm"
                            />
                        </label>

                        {versionHistory.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Version History</p>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {versionHistory.slice().reverse().map((version, index) => (
                                        <div key={`${version}-${index}`} className="flex items-center justify-between text-xs bg-muted/20 rounded px-2 py-1">
                                            <span>{version}</span>
                                            <button
                                                onClick={() => { void handleRollback(version); }}
                                                className="text-primary hover:underline"
                                            >
                                                Rollback
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setEditingServer(null)}
                                className="px-3 py-1.5 text-sm rounded-md bg-muted/40 hover:bg-muted/60"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => { void handleSaveEdit(); }}
                                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


