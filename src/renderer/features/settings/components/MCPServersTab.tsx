import { McpPermissionProfile } from '@shared/types/settings';
import { CheckCircle2, Edit2, Power, Server, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

interface MCPServer {
    id?: string;
    name: string;
    description?: string;
    command?: string;
    args?: string[];
    enabled?: boolean;
    category?: string;
    version?: string;
    isOfficial?: boolean;
    publisher?: string;
    tools?: string[];
    status?: string;
    type?: string;
    permissionProfile?: McpPermissionProfile;
}

interface ServerItemProps {
    server: MCPServer;
    t: (key: string, options?: Record<string, string | number>) => string;
    onToggle: (serverId: string, enabled: boolean, isInternal: boolean) => void;
    onDelete: (serverId: string, isInternal: boolean) => void;
    onEdit: (server: MCPServer) => void;
}

function ServerItem({ server, t, onToggle, onDelete, onEdit }: ServerItemProps) {
    const isInternal = server.category === 'Internal';

    return (
        <div
            className={cn(
                'group flex items-center justify-between rounded-xl border p-4 transition-all',
                server.enabled
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border/50 bg-muted/30 hover:border-border/80'
            )}
        >
            <div className="flex flex-1 items-center gap-4">
                <div
                    className={cn(
                        'rounded-lg p-2.5',
                        server.enabled
                            ? 'bg-success/10 text-success'
                            : 'bg-muted/10 text-muted-foreground'
                    )}
                >
                    <Server className="h-5 w-5" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium">{server.name}</h3>
                        {server.isOfficial ? <Shield className="h-3.5 w-3.5 text-primary" /> : null}
                        {server.category ? (
                            <span
                                className={cn(
                                    'rounded border px-1.5 py-0.5 text-xxs uppercase',
                                    isInternal
                                        ? 'border-primary/30 bg-primary/10 text-primary'
                                        : 'bg-muted text-muted-foreground'
                                )}
                            >
                                {server.category}
                            </span>
                        ) : null}
                        {server.version ? (
                            <span className="text-xxs text-muted-foreground">v{server.version}</span>
                        ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {server.description ?? `${server.command ?? ''} ${(server.args ?? []).join(' ')}`.trim()}
                    </p>
                    {server.publisher ? (
                        <p className="mt-1 text-xxs text-muted-foreground/60">
                            {t('mcp.byAuthor', { author: server.publisher, version: server.version ?? '1.0.0' })}
                        </p>
                    ) : null}
                    {server.permissionProfile ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <Shield className="h-3 w-3 text-muted-foreground/60" />
                            <span className="text-xxs font-medium text-muted-foreground/80">
                                {t(`settings.mcp.profiles.${server.permissionProfile}`)}
                            </span>
                        </div>
                    ) : null}
                    {server.tools && server.tools.length > 0 ? (
                        <p className="mt-1 text-xxs text-muted-foreground/60">
                            {server.tools.length} {server.tools.length === 1 ? t('mcp.tool') : t('mcp.tools')}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={() => onToggle(server.id ?? server.name, server.enabled ?? false, isInternal)}
                    disabled={isInternal}
                    className={cn(
                        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        isInternal
                            ? 'cursor-default border-primary/30 bg-primary/5 text-primary'
                            : server.enabled
                                ? 'border-success/30 bg-success/10 text-success hover:bg-success/20'
                                : 'border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                    title={isInternal ? t('settings.mcp.servers.internalAlwaysEnabled') : ''}
                >
                    <Power className={cn('h-3.5 w-3.5', server.enabled && 'fill-current')} />
                    {server.enabled ? t('settings.mcp.status.enabled') : t('settings.mcp.status.disabled')}
                </button>

                <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background px-3 py-1">
                    {server.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                        <div className="h-2 w-2 rounded-full bg-muted" />
                    )}
                    <span className="text-xs capitalize">
                        {server.enabled ? t('settings.mcp.status.active') : t('settings.mcp.status.inactive')}
                    </span>
                </div>

                {!isInternal ? (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                            onClick={() => onEdit(server)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title={t('common.edit')}
                        >
                            <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => onDelete(server.id ?? server.name, isInternal)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title={t('common.delete')}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ) : null}
            </div>
        </div >
    );
}

export function MCPServersTab(): JSX.Element {
    const { t } = useTranslation();
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
    const [draftCommand, setDraftCommand] = useState('');
    const [draftProfile, setDraftProfile] = useState<McpPermissionProfile>('read-only');

    const loadServers = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const nextServers = await window.electron.mcp.list();
            setServers(
                Array.isArray(nextServers)
                    ? nextServers.map((server, index) => {
                        const candidate = server as Partial<MCPServer>;
                        return {
                            id: candidate.id ?? candidate.name ?? `mcp-server-${index}`,
                            name: candidate.name ?? `mcp-server-${index}`,
                            description: candidate.description,
                            command: candidate.command,
                            args: candidate.args ?? [],
                            enabled:
                                typeof candidate.enabled === 'boolean'
                                    ? candidate.enabled
                                    : candidate.status === 'enabled' || candidate.status === 'active',
                            category: candidate.category,
                            version: candidate.version,
                            isOfficial: candidate.isOfficial,
                            publisher: candidate.publisher,
                            tools: candidate.tools,
                            status: candidate.status,
                            type: candidate.type,
                            permissionProfile: candidate.permissionProfile as McpPermissionProfile,
                        };
                    })
                    : []
            );
        } catch (error) {
            appLogger.error('MCPServersTab', 'Failed to load MCP servers', error as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadServers();
    }, [loadServers]);

    const enabledCount = useMemo(
        () => servers.filter(server => server.enabled).length,
        [servers]
    );

    const handleToggle = useCallback(async (serverId: string, currentEnabled: boolean, isInternal: boolean): Promise<void> => {
        if (isInternal) {
            return;
        }
        try {
            await window.electron.mcp.toggle(serverId, !currentEnabled);
            await loadServers();
        } catch (error) {
            appLogger.error('MCPServersTab', 'Failed to toggle MCP server', error as Error);
        }
    }, [loadServers]);

    const handleDelete = useCallback(async (serverId: string, isInternal: boolean): Promise<void> => {
        if (isInternal) {
            return;
        }
        try {
            const settings = await window.electron.getSettings();
            const nextServers = (settings.mcpUserServers ?? []).filter((server: MCPServer) =>
                server.id !== serverId && server.name !== serverId
            );
            await window.electron.saveSettings({
                ...settings,
                mcpUserServers: nextServers,
            });
            await loadServers();
        } catch (error) {
            appLogger.error('MCPServersTab', 'Failed to delete MCP server', error as Error);
        }
    }, [loadServers]);

    const handleEdit = useCallback((server: MCPServer): void => {
        setEditingServer(server);
        setDraftCommand([server.command ?? '', ...(server.args ?? [])].join(' ').trim());
        setDraftProfile(server.permissionProfile ?? 'read-only');
    }, []);

    const handleSaveEdit = useCallback(async (): Promise<void> => {
        if (!editingServer) {
            return;
        }

        const trimmedCommand = draftCommand.trim();
        if (trimmedCommand.length === 0) {
            return;
        }

        try {
            const settings = await window.electron.getSettings();
            const nextServers = (settings.mcpUserServers ?? []).map((server: MCPServer) =>
                server.id === editingServer.id || server.name === editingServer.name
                    ? {
                        ...server,
                        command: trimmedCommand,
                        args: [],
                        permissionProfile: draftProfile
                    }
                    : server
            );
            await window.electron.saveSettings({
                ...settings,
                mcpUserServers: nextServers,
            });
            setEditingServer(null);
            await loadServers();
        } catch (error) {
            appLogger.error('MCPServersTab', 'Failed to update MCP server', error as Error);
        }
    }, [draftCommand, draftProfile, editingServer, loadServers]);

    return (
        <div className="flex h-full flex-col space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <Server className="h-5 w-5" />
                        {t('settings.mcp.servers.title')}
                    </h2>
                    <p className="text-sm text-muted-foreground">{t('settings.mcp.servers.subtitle')}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                    {enabledCount} / {servers.length} {t('settings.mcp.servers.enabled')}
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
                            onToggle={(serverId, enabled, isInternal) => { void handleToggle(serverId, enabled, isInternal); }}
                            onDelete={(serverId, isInternal) => { void handleDelete(serverId, isInternal); }}
                            onEdit={handleEdit}
                        />
                    ))}

                    {servers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-12 text-muted-foreground/50">
                            <Server className="mb-3 h-10 w-10 opacity-20" />
                            <p className="mb-1">{t('settings.mcp.servers.empty')}</p>
                            <p className="text-xs">{t('settings.mcp.servers.subtitle')}</p>
                        </div>
                    ) : null}
                </div>
            )}

            {editingServer ? (
                <div className="rounded-xl border border-border/40 bg-card/80 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{editingServer.name}</h3>
                        <button
                            onClick={() => setEditingServer(null)}
                            className="rounded-md bg-muted/40 px-3 py-1.5 text-sm hover:bg-muted/60"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('mcp.command')}</span>
                        <input
                            value={draftCommand}
                            onChange={event => setDraftCommand(event.target.value)}
                            className="w-full rounded-md border border-border/30 bg-muted/30 px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="mt-3 block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('settings.mcp.permissions.profile')}</span>
                        <select
                            value={draftProfile}
                            onChange={event => setDraftProfile(event.target.value as McpPermissionProfile)}
                            className="w-full rounded-md border border-border/30 bg-muted/30 px-3 py-2 text-sm"
                        >
                            <option value="read-only">{t('settings.mcp.profiles.read-only')}</option>
                            <option value="workspace-only">{t('settings.mcp.profiles.workspace-only')}</option>
                            <option value="network-enabled">{t('settings.mcp.profiles.network-enabled')}</option>
                            <option value="destructive">{t('settings.mcp.profiles.destructive')}</option>
                            <option value="full-access">{t('settings.mcp.profiles.full-access')}</option>
                        </select>
                    </label>
                    <div className="mt-3 flex justify-end">
                        <button
                            onClick={() => { void handleSaveEdit(); }}
                            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
