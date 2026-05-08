/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { MarketplaceMcp } from '@shared/types/marketplace';
import { AppSettings, McpPermission, McpPermissionProfile } from '@shared/types/settings';
import { IconCheck, IconEdit, IconFilePencil, IconFileText, IconGlobe, IconRefresh, IconServer, IconShieldCheck, IconTerminal, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useMarketplaceStore } from '@/store/marketplace.store';
import { pushNotification } from '@/store/notification-center.store';
import { appLogger } from '@/utils/renderer-logger';

const C_MCPSERVERSTAB_1 = "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 py-16 text-muted-foreground/40 sm:flex-row";
type McpActionPolicy = 'allow' | 'deny' | 'ask';

interface MCPAction {
    name: string;
    description?: string;
}

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
    source?: 'core' | 'native' | 'user' | 'remote' | 'external';
    permissionProfile?: McpPermissionProfile;
    permissions?: McpPermission[];
    actions?: MCPAction[];
    actionPermissions?: Record<string, McpActionPolicy>;
    updateAvailable?: boolean;
    isEnabled?: boolean;
    isAlive?: boolean;
}

interface ServerItemProps {
    server: MCPServer;
    t: (key: string, options?: Record<string, string | number>) => string;
    onToggle: (serverId: string, enabled: boolean, isInternal: boolean) => Promise<void>;
    onDelete: (serverId: string, isInternal: boolean) => Promise<void>;
    onEdit: (server: MCPServer) => void;
    isEditing: boolean;
    onCancelEdit: () => void;
    onSaveEdit: (draftPermissions: McpPermission[], draftActionPermissions: Record<string, McpActionPolicy>) => Promise<void>;
}

const ALL_PERMISSIONS: { id: McpPermission; icon: typeof IconFileText; label: string; color: string }[] = [
    { id: 'read', icon: IconFileText, label: 'Read Access', color: 'text-primary' },
    { id: 'write', icon: IconFilePencil, label: 'Write Access', color: 'text-primary' },
    { id: 'delete', icon: IconTrash, label: 'Delete / Destructive', color: 'text-destructive' },
    { id: 'network', icon: IconGlobe, label: 'Network Access', color: 'text-primary' },
    { id: 'execute', icon: IconTerminal, label: 'Execute / System', color: 'text-primary' },
];

const ACTION_POLICIES: { id: McpActionPolicy; label: string; className: string }[] = [
    { id: 'allow', label: 'Allow', className: 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/10' },
    { id: 'ask', label: 'Ask', className: 'border-border bg-muted/40 text-muted-foreground hover:bg-muted' },
    { id: 'deny', label: 'Deny', className: 'border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10' },
];

function getActionPermission(
    permissions: Record<string, McpActionPolicy> | undefined,
    serverName: string,
    actionName: string
): McpActionPolicy {
    return permissions?.[`${serverName}:${actionName}`]
        ?? permissions?.[`${serverName}.${actionName}`]
        ?? permissions?.[`mcp__${serverName}__${actionName}`]
        ?? 'allow';
}

function ServerItem({
    server,
    t,
    onToggle,
    onDelete,
    onEdit,
    isEditing,
    onCancelEdit,
    onSaveEdit,
}: ServerItemProps) {
    const isInternal = server.source === 'core' || server.source === 'native' || server.category === 'Internal';

    // Initial data for draft state
    const initialPermissions = useMemo(() => {
        if (isInternal) {
            return ['read', 'write', 'delete', 'network', 'execute'] as McpPermission[];
        }
        if (Array.isArray(server.permissions)) {
            return server.permissions;
        }

        switch (server.permissionProfile) {
            case 'read-only': return ['read'] as McpPermission[];
            case 'workspace-only': return ['read', 'write'] as McpPermission[];
            case 'network-enabled': return ['read', 'network'] as McpPermission[];
            case 'destructive': return ['read', 'write', 'delete'] as McpPermission[];
            case 'full-access': return ['read', 'write', 'delete', 'network', 'execute'] as McpPermission[];
            default: return ['read'] as McpPermission[];
        }
    }, [server.permissions, server.permissionProfile, isInternal]);

    // Component re-mounts on 'key' change (id or isEditing), so these reset naturally.
    const [draftPermissions, setDraftPermissions] = useState<McpPermission[]>(initialPermissions);
    const initialActionPermissions = useMemo(() => {
        const next: Record<string, McpActionPolicy> = {};
        for (const action of server.actions ?? []) {
            next[action.name] = getActionPermission(server.actionPermissions, server.name, action.name);
        }
        return next;
    }, [server.actionPermissions, server.actions, server.name]);
    const [draftActionPermissions, setDraftActionPermissions] = useState<Record<string, McpActionPolicy>>(initialActionPermissions);

    const isEnabled = server.enabled ?? server.isEnabled ?? false;
    const isActuallyActive = isEnabled && (server.isAlive ?? (server.status === 'active' || server.status === 'running'));

    const togglePermission = (perm: McpPermission) => {
        setDraftPermissions(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    const setActionPolicy = (actionName: string, policy: McpActionPolicy) => {
        setDraftActionPermissions(prev => ({
            ...prev,
            [actionName]: policy
        }));
    };

    return (
        <div
            className={cn(
                'group relative flex flex-col rounded-2xl border transition-all duration-200',
                isActuallyActive
                    ? 'border-primary/20 bg-primary/02'
                    : 'border-border/40 bg-transparent hover:border-border/60',
                isEditing && 'border-primary/40 bg-primary/05 ring-1 ring-primary/10'
            )}
        >
            <div className="flex items-center justify-between p-4 sm:p-5">
                <div className="flex flex-1 items-center gap-4 sm:gap-5">
                    <div
                        className={cn(
                            'rounded-xl p-2.5 transition-colors',
                            isActuallyActive
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted/40 text-muted-foreground/30'
                        )}
                    >
                        <IconServer className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground leading-tight">{server.name}</h3>
                            {server.isOfficial && (
                                <IconShieldCheck className="h-3.5 w-3.5 text-primary/60" title="Official MCP Server" />
                            )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground/60 line-clamp-1">
                            {server.description ??
                                `${server.command ?? ''} ${(server.args ?? []).join(' ')}`.trim()}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                            {!isInternal && (
                                <span className="text-sm font-bold  uppercase text-muted-foreground/30">{server.version || '1.0.0'}</span>
                            )}
                            <div className="flex items-center gap-1">
                                {ALL_PERMISSIONS.map(p => (
                                    <div
                                        key={p.id}
                                        className={cn(
                                            "p-0.5 transition-opacity",
                                            (draftPermissions.includes(p.id) || isInternal) ? "opacity-100" : "opacity-0 group-hover:opacity-20"
                                        )}
                                        title={t(`settings.mcp.permissions.${p.id}`)}
                                    >
                                        <p.icon className={cn("h-3 w-3", (draftPermissions.includes(p.id) || isInternal) ? p.color : "text-muted-foreground")} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            void onToggle(server.id ?? server.name, isEnabled, isInternal);
                        }}
                        className={cn(
                            'flex items-center gap-2 rounded-full h-8 px-4 text-sm font-semibold transition-all',
                            isEnabled
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                    >
                        <div className={cn('h-1.5 w-1.5 rounded-full', isEnabled ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40')} />
                        {isEnabled
                            ? t('frontend.settings.mcp.status.enabled')
                            : t('frontend.settings.mcp.status.disabled')}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => (isEditing ? onCancelEdit() : onEdit(server))}
                        className={cn(
                            "rounded-lg h-8 w-8 transition-colors",
                            isEditing ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={t('common.edit')}
                    >
                        <IconEdit className="h-4 w-4" />
                    </Button>
                    {!isInternal && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { void onDelete(server.id ?? server.name, isInternal); }}
                            className="rounded-lg h-8 w-8 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title={t('common.delete')}
                        >
                            <IconTrash className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Inline Edit Panel */}
            {isEditing && (
                <div className="border-t border-border/20 bg-muted/5 p-4 sm:p-5">
                    <div className="space-y-6">
                        <div className="grid gap-3">
                            <Label className="text-sm font-bold  uppercase text-muted-foreground/40 flex items-center gap-2">
                                <IconShieldCheck className="h-3 w-3" />
                                {t('frontend.settings.mcp.permissions.title')}
                            </Label>

                            {isInternal ? (
                                <div className="grid gap-2">
                                    {(server.actions ?? []).map(action => (
                                        <div
                                            key={action.name}
                                            className="flex flex-col gap-3 rounded-xl border border-border/40 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-foreground">{action.name}</div>
                                                {action.description && (
                                                    <div className="mt-0.5 text-sm text-muted-foreground/50 line-clamp-1">
                                                        {action.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                {ACTION_POLICIES.map(policy => (
                                                    <Button
                                                        key={policy.id}
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setActionPolicy(action.name, policy.id)}
                                                        className={cn(
                                                            "h-7 rounded-lg px-3 text-sm font-bold uppercase ",
                                                            draftActionPermissions[action.name] === policy.id
                                                                ? policy.className
                                                                : "bg-transparent text-muted-foreground/40 hover:bg-muted/50 hover:text-muted-foreground"
                                                        )}
                                                    >
                                                        {policy.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {(server.actions ?? []).length === 0 && (
                                        <div className="rounded-xl border border-dashed border-border/40 p-5 text-center text-sm text-muted-foreground/40">
                                            No actions registered for this server.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {ALL_PERMISSIONS.map((perm) => (
                                        <div
                                            key={perm.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => togglePermission(perm.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    togglePermission(perm.id);
                                                }
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 p-2.5 rounded-xl transition-all border",
                                                draftPermissions.includes(perm.id)
                                                    ? "bg-primary/05 border-primary/20 text-foreground"
                                                    : "bg-transparent border-border/40 text-muted-foreground/60 hover:border-border/60"
                                            )}
                                        >
                                            <div className={cn(
                                                "rounded-lg p-1.5",
                                                draftPermissions.includes(perm.id) ? "bg-primary/10" : "bg-muted/40"
                                            )}>
                                                <perm.icon className={cn("h-4 w-4", draftPermissions.includes(perm.id) ? "text-primary" : "text-muted-foreground/40")} />
                                            </div>
                                            <div className="flex-1 flex flex-col items-start text-left min-w-0">
                                                <span className="text-sm font-semibold">{t(`settings.mcp.permissions.${perm.id}`)}</span>
                                                <span className="text-sm text-muted-foreground/40 line-clamp-1">{t(`settings.mcp.permissions.${perm.id}_desc`)}</span>
                                            </div>
                                            <div className={cn(
                                                "h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-all",
                                                draftPermissions.includes(perm.id) ? "bg-primary border-primary" : "border-border/60"
                                            )}>
                                                {draftPermissions.includes(perm.id) && <IconCheck className="h-2 w-2 text-primary-foreground" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-border/10">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onCancelEdit()}
                                className="h-8 px-4 text-sm font-medium"
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { void onSaveEdit(draftPermissions, draftActionPermissions); }}
                                className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 px-5 text-sm font-semibold shadow-sm"
                            >
                                <IconRefresh className="mr-2 h-3.5 w-3.5" />
                                {t('common.save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function MCPServersTab(): JSX.Element {
    const { t } = useTranslation();
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingServerId, setEditingServerId] = useState<string | null>(null);

    const loadServers = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const settings = await window.electron.getSettings();
            const nextServers = await window.electron.mcp.list();

            if (Array.isArray(nextServers)) {
                setServers(
                    nextServers.map((server: unknown, index: number) => {
                        const candidate = server as MCPServer;
                        const id = candidate.id ?? candidate.name ?? `mcp-server-${index}`;
                        const isNative = candidate.source === 'native';

                        return {
                            ...candidate,
                            id,
                            name: candidate.name || id,
                            enabled: isNative ? true : !!(candidate.isEnabled ?? candidate.enabled),
                            isAlive: !!(candidate.isAlive ?? (candidate.status === 'active')),
                            args: candidate.args || [],
                            permissions: candidate.permissions,
                            actionPermissions: settings.mcpActionPermissions ?? {}
                        };
                    })
                );
            } else {
                setServers([]);
            }
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
        const timer = window.setTimeout(() => {
            void loadServers();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadServers]);

    const activeCount = useMemo(() => servers.filter(server => (server.enabled || server.isEnabled) && server.isAlive).length, [servers]);

    const handleToggle = useCallback(
        async (
            serverId: string,
            currentEnabled: boolean,
            _isInternal: boolean
        ): Promise<void> => {
            try {
                setServers(prev => prev.map(s => (s.id === serverId || s.name === serverId)
                    ? { ...s, enabled: !currentEnabled, isEnabled: !currentEnabled }
                    : s
                ));

                await window.electron.mcp.toggle(serverId, !currentEnabled);
                setTimeout(() => { void loadServers(); }, 300);
            } catch (error) {
                appLogger.error('MCPServersTab', 'Failed to toggle MCP server', error as Error);
                void loadServers();
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
                } as AppSettings);
                await loadServers();
                pushNotification({ type: 'success', message: t('common.deleted') });
            } catch (error) {
                appLogger.error('MCPServersTab', 'Failed to delete MCP server', error as Error);
            }
        },
        [loadServers, t]
    );

    const handleSaveEdit = useCallback(async (
        serverId: string,
        permissions: McpPermission[],
        actionPermissions: Record<string, McpActionPolicy>
    ): Promise<void> => {
        try {
            const targetServer = servers.find(server => server.id === serverId || server.name === serverId);
            const isInternal = targetServer?.source === 'core' || targetServer?.source === 'native' || targetServer?.category === 'Internal';

            if (isInternal && targetServer) {
                await Promise.all((targetServer.actions ?? []).map(action =>
                    window.electron.mcp.setActionPermission(
                        targetServer.name,
                        action.name,
                        actionPermissions[action.name] ?? 'allow'
                    )
                ));
                setEditingServerId(null);
                await loadServers();
                pushNotification({ type: 'success', message: t('common.saved') });
                return;
            }

            const settings = await window.electron.getSettings();
            const nextServers = (settings.mcpUserServers ?? []).map((server: MCPServer) =>
                server.id === serverId || server.name === serverId
                    ? { ...server, permissions }
                    : server
            );
            await window.electron.saveSettings({
                ...settings,
                mcpUserServers: nextServers,
            } as AppSettings);
            setEditingServerId(null);
            await loadServers();
            pushNotification({ type: 'success', message: t('common.saved') });
        } catch (error) {
            appLogger.error('MCPServersTab', 'Failed to update MCP server', error as Error);
        }
    }, [loadServers, servers, t]);

    return (
        <div className="flex flex-col space-y-6 p-5 pb-20">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold  text-foreground flex items-center gap-2.5">
                        <IconServer className="h-5 w-5 text-primary" />
                        {t('frontend.settings.mcp.servers.title')}
                    </h2>
                    <p className="text-sm text-muted-foreground/50">
                        {t('frontend.settings.mcp.servers.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted/40 border border-border/40 px-3 py-1 text-sm font-bold  text-muted-foreground/60 uppercase">
                        {activeCount} / {servers.length} {t('frontend.settings.mcp.status.active')}
                    </div>
                </div>
            </div>

            {loading && servers.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                    <IconRefresh className="h-5 w-5 animate-spin text-muted-foreground/20" />
                </div>
            ) : (
                <div className="grid gap-2.5">
                    {serversWithUpdates.map(server => (
                        <ServerItem
                            key={(server.id || server.name) + (editingServerId === (server.id || server.name) ? '-edit' : '')}
                            server={server}
                            t={t}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            onEdit={(s) => { setEditingServerId(s.id ?? s.name); }}
                            isEditing={editingServerId === (server.id ?? server.name)}
                            onCancelEdit={() => { setEditingServerId(null); }}
                            onSaveEdit={(perms, actionPerms) => handleSaveEdit(server.id ?? server.name, perms, actionPerms)}
                        />
                    ))}

                    {servers.length === 0 && !loading && (
                        <div className={C_MCPSERVERSTAB_1}>
                            <IconServer className="mb-4 h-12 w-12 opacity-10" />
                            <p className="text-sm font-medium">{t('frontend.settings.mcp.servers.empty')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


