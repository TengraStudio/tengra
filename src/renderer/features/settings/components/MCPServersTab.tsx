import { Badge } from '@/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { useTranslation } from '@renderer/i18n';
import { cn } from '@renderer/lib/utils';
import { marketplaceStore, useMarketplaceStore } from '@renderer/store/marketplace.store';
import { pushNotification } from '@renderer/store/notification-center.store';
import { appLogger } from '@renderer/utils/renderer-logger';
import { MarketplaceMcp, MarketplaceRegistry } from '@shared/types/marketplace';
import { McpPermissionProfile } from '@shared/types/settings';
import {
    CheckCircle2,
    Edit2,
    Power,
    RefreshCw,
    Server,
    Shield,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
    updateAvailable?: boolean;
}

interface ServerItemProps {
    server: MCPServer;
    t: (key: string, options?: Record<string, string | number>) => string;
    onToggle: (serverId: string, enabled: boolean, isInternal: boolean) => void;
    onDelete: (serverId: string, isInternal: boolean) => void;
    onEdit: (server: MCPServer) => void;
}

function ServerItem({
    server,
    t,
    onToggle,
    onDelete,
    onEdit,
    registry,
}: ServerItemProps & { registry: MarketplaceRegistry }) {
    const isInternal = server.category === 'Internal';

    return (
        <div
            className={cn(
                'group flex items-center justify-between rounded-2xl border p-5 transition-all duration-300',
                server.enabled
                    ? 'border-primary/40 bg-card/10 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)] ring-1 ring-primary/20'
                    : 'border-border/30 bg-muted/20 hover:border-border/60'
            )}
        >
            <div className="flex flex-1 items-center gap-5">
                <div
                    className={cn(
                        'rounded-xl p-3 transition-all duration-300 shadow-inner',
                        server.enabled
                            ? 'bg-primary/20 text-primary ring-1 ring-inset ring-primary/30 group-hover:scale-110'
                            : 'bg-muted/40 text-muted-foreground/40 opacity-50'
                    )}
                >
                    <Server className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h3 className="font-black tracking-tight text-foreground leading-none">{server.name}</h3>
                        {server.isOfficial ? <Shield className="h-4 w-4 text-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]" /> : null}
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            {server.category ? (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'text-[9px] h-4 font-black uppercase tracking-widest px-1.5',
                                        isInternal
                                            ? 'border-primary/30 bg-primary/10 text-primary'
                                            : 'bg-muted/20 text-muted-foreground/60'
                                    )}
                                >
                                    {server.category}
                                </Badge>
                            ) : null}
                        </div>
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-muted-foreground/70 line-clamp-1">
                        {server.description ??
                            `${server.command ?? ''} ${(server.args ?? []).join(' ')}`.trim()}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                         {server.publisher && (
                             <>
                                <span className="text-[10px] font-bold text-muted-foreground/30 italic uppercase tracking-wider">
                                    {server.publisher}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-border/40" />
                             </>
                         )}
                         <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">V{server.version || '1.0.0'}</span>
                         {server.permissionProfile && (
                            <>
                                <span className="h-1 w-1 rounded-full bg-border/40" />
                                <div className="flex items-center gap-1.5 text-primary/60">
                                    <Shield className="h-3 w-3" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {t(`settings.mcp.profiles.${server.permissionProfile}`)}
                                    </span>
                                </div>
                            </>
                         )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        onToggle(server.id ?? server.name, server.enabled ?? false, isInternal)
                    }
                    disabled={isInternal}
                    className={cn(
                        'flex items-center gap-2 rounded-full h-8 px-3 transition-all',
                        isInternal
                            ? 'cursor-default border-primary/30 bg-primary/5 text-primary'
                            : server.enabled
                              ? 'border-success/30 bg-success/10 text-success hover:bg-success/20'
                              : 'border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                    title={isInternal ? t('settings.mcp.servers.internalAlwaysEnabled') : ''}
                >
                    <Power className={cn('h-3.5 w-3.5', server.enabled && 'fill-current')} />
                    {server.enabled
                        ? t('settings.mcp.status.enabled')
                        : t('settings.mcp.status.disabled')}
                </Button>

                <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background px-3 py-1 h-8">
                    {server.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                        <div className="h-2 w-2 rounded-full bg-muted" />
                    )}
                    <span className="typo-caption capitalize">
                        {server.enabled
                            ? t('settings.mcp.status.active')
                            : t('settings.mcp.status.inactive')}
                    </span>
                </div>

                {server.updateAvailable && (
                    <Button
                        size="xs"
                        variant="destructive"
                        className="h-8 gap-1.5 rounded-full px-3"
                        onClick={() => {
                            const mItem = (registry?.mcp || []).find((m: MarketplaceMcp) => m.id === server.id || m.id === server.name);
                            if (!mItem) {
                                pushNotification({ type: 'error', message: 'Registry item not found' });
                                return;
                            }
                            void window.electron.marketplace.install({
                                type: 'mcp',
                                id: mItem.id,
                                downloadUrl: mItem.downloadUrl,
                                name: mItem.name,
                                description: mItem.description,
                                author: mItem.author,
                                version: mItem.version,
                            }).then(res => {
                                if (res.success) {
                                    pushNotification({ type: 'success', message: t('settings.extensions.plugins.updateSuccess') });
                                    void marketplaceStore.checkLiveUpdates();
                                }
                            });
                        }}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">{t('common.update')}</span>
                    </Button>
                )}

                {!isInternal ? (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(server)}
                            className="rounded-lg h-8 w-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title={t('common.edit')}
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(server.id ?? server.name, isInternal)}
                            className="rounded-lg h-8 w-8 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title={t('common.delete')}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
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
                                      : candidate.status === 'enabled' ||
                                        candidate.status === 'active',
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

    const registry = useMarketplaceStore(s => s.registry);

    const serversWithUpdates = useMemo(() => {
        return servers.map(server => {
            const mItem = (registry?.mcp || []).find((m: MarketplaceMcp) => m.id === server.id || m.id === server.name);
            return {
                ...server,
                updateAvailable: mItem?.updateAvailable ?? false
            };
        });
    }, [servers, registry]);

    useEffect(() => {
        void loadServers();
    }, [loadServers]);

    const enabledCount = useMemo(() => servers.filter(server => server.enabled).length, [servers]);

    const handleToggle = useCallback(
        async (
            serverId: string,
            currentEnabled: boolean,
            isInternal: boolean
        ): Promise<void> => {
            if (isInternal) {
                return;
            }
            try {
                await window.electron.mcp.toggle(serverId, !currentEnabled);
                await loadServers();
            } catch (error) {
                appLogger.error('MCPServersTab', 'Failed to toggle MCP server', error as Error);
            }
        },
        [loadServers]
    );

    const handleDelete = useCallback(
        async (serverId: string, isInternal: boolean): Promise<void> => {
            if (isInternal) {
                return;
            }
            try {
                const settings = await window.electron.getSettings();
                const nextServers = (settings.mcpUserServers ?? []).filter(
                    (server: MCPServer) => server.id !== serverId && server.name !== serverId
                );
                await window.electron.saveSettings({
                    ...settings,
                    mcpUserServers: nextServers,
                });
                await loadServers();
            } catch (error) {
                appLogger.error('MCPServersTab', 'Failed to delete MCP server', error as Error);
            }
        },
        [loadServers]
    );

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
                          permissionProfile: draftProfile,
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
                    <p className="text-sm text-muted-foreground">
                        {t('settings.mcp.servers.subtitle')}
                    </p>
                </div>
                <div className="typo-caption text-muted-foreground">
                    {enabledCount} / {servers.length} {t('settings.mcp.servers.enabled')}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {serversWithUpdates.map(server => (
                        <ServerItem
                            key={server.id}
                            server={server}
                            t={t}
                            onToggle={(serverId, enabled, isInternal) => {
                                void handleToggle(serverId, enabled, isInternal);
                            }}
                            onDelete={(serverId, isInternal) => {
                                void handleDelete(serverId, isInternal);
                            }}
                            onEdit={handleEdit}
                            registry={registry as MarketplaceRegistry}
                        />
                    ))}

                    {servers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-12 text-muted-foreground/50">
                            <Server className="mb-3 h-10 w-10 opacity-20" />
                            <p className="mb-1">{t('settings.mcp.servers.empty')}</p>
                            <p className="typo-caption">{t('settings.mcp.servers.subtitle')}</p>
                        </div>
                    ) : null}
                </div>
            )}

            {editingServer ? (
                <div className="rounded-xl border border-border/40 bg-card/80 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{editingServer.name}</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingServer(null)}
                            className="rounded-md bg-muted/40 px-3 py-1.5 typo-caption hover:bg-muted/60 transition-colors h-8"
                        >
                            {t('common.cancel')}
                        </Button>
                    </div>
                    <div className="space-y-4">
                        <div className="grid gap-1.5">
                            <Label className="typo-caption text-muted-foreground">
                                {t('mcp.command')}
                            </Label>
                            <Input
                                value={draftCommand}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setDraftCommand(e.target.value)
                                }
                                className="h-9"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label className="typo-caption text-muted-foreground">
                                {t('settings.mcp.permissions.profile')}
                            </Label>
                            <Select
                                value={draftProfile}
                                onValueChange={(val: McpPermissionProfile) =>
                                    setDraftProfile(val)
                                }
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="read-only">
                                        {t('settings.mcp.profiles.read-only')}
                                    </SelectItem>
                                    <SelectItem value="workspace-only">
                                        {t('settings.mcp.profiles.workspace-only')}
                                    </SelectItem>
                                    <SelectItem value="network-enabled">
                                        {t('settings.mcp.profiles.network-enabled')}
                                    </SelectItem>
                                    <SelectItem value="destructive">
                                        {t('settings.mcp.profiles.destructive')}
                                    </SelectItem>
                                    <SelectItem value="full-access">
                                        {t('settings.mcp.profiles.full-access')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button
                            size="sm"
                            onClick={() => {
                                void handleSaveEdit();
                            }}
                            className="rounded-md bg-primary px-3 py-1.5 typo-caption font-medium text-primary-foreground hover:bg-primary/90 transition-colors h-8"
                        >
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

