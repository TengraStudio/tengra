/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { Button } from '@renderer/components/ui/button';
import { Label } from '@renderer/components/ui/label';
import { useTranslation } from '@renderer/i18n';
import { cn } from '@renderer/lib/utils';
import { useMarketplaceStore } from '@renderer/store/marketplace.store';
import { pushNotification } from '@renderer/store/notification-center.store';
import { appLogger } from '@renderer/utils/renderer-logger';
import { MarketplaceMcp } from '@shared/types/marketplace';
import { AppSettings, McpPermission, McpPermissionProfile } from '@shared/types/settings';
import {
    Check,
    Edit2,
    FileEdit,
    FileText,
    Globe,
    Power,
    RefreshCw,
    Server,
    ShieldCheck,
    Terminal,
    Trash,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const C_MCPSERVERSTAB_1 = "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-12 text-muted-foreground/50 sm:flex-row";
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

const ALL_PERMISSIONS: { id: McpPermission; icon: typeof FileText; label: string; color: string }[] = [
    { id: 'read', icon: FileText, label: 'Read Access', color: 'text-blue-400' },
    { id: 'write', icon: FileEdit, label: 'Write Access', color: 'text-emerald-400' },
    { id: 'delete', icon: Trash, label: 'Delete / Destructive', color: 'text-rose-400' },
    { id: 'network', icon: Globe, label: 'Network Access', color: 'text-sky-400' },
    { id: 'execute', icon: Terminal, label: 'Execute / System', color: 'text-amber-400' },
];

const ACTION_POLICIES: { id: McpActionPolicy; label: string; className: string }[] = [
    { id: 'allow', label: 'Allow', className: 'border-success/40 bg-success/10 text-success hover:bg-success/20' },
    { id: 'ask', label: 'Ask', className: 'border-amber-400/40 bg-amber-400/10 text-amber-500 hover:bg-amber-400/20' },
    { id: 'deny', label: 'Deny', className: 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20' },
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
                'group relative flex flex-col rounded-2xl border transition-all duration-300',
                isActuallyActive
                    ? 'border-primary/40 bg-card/10 shadow-glow-primary-ring ring-1 ring-primary/20'
                    : 'border-border/30 bg-muted/20 hover:border-border/60',
                isEditing && 'ring-2 ring-primary border-primary bg-card/40 shadow-glow-primary-rgb-soft'
            )}
        >
            <div className="flex items-center justify-between p-5">
                <div className="flex flex-1 items-center gap-5">
                    <div
                        className={cn(
                            'rounded-xl p-3 transition-all duration-300 shadow-inner',
                            isActuallyActive
                                ? 'bg-primary/20 text-primary ring-1 ring-inset ring-primary/30 group-hover:scale-110'
                                : 'bg-muted/40 text-muted-foreground/40 opacity-50'
                        )}
                    >
                        <Server className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h3 className="font-black tracking-tight text-foreground leading-none">{server.name}</h3>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-muted-foreground/70 line-clamp-1">
                            {server.description ??
                                `${server.command ?? ''} ${(server.args ?? []).join(' ')}`.trim()}
                        </p>
                        <div className="mt-2.5 flex items-center gap-3">
                            {!isInternal && (
                                <span className="text-xxxs font-black uppercase tracking-widest text-muted-foreground/40">V{server.version || '1.0.0'}</span>
                            )}
                            <div className="flex items-center gap-1.5 ml-2">
                                {ALL_PERMISSIONS.map(p => (
                                    <div
                                        key={p.id}
                                        className={cn(
                                            "p-0.5 rounded-sm transition-opacity",
                                            (draftPermissions.includes(p.id) || isInternal) ? "opacity-100" : "opacity-10 opacity-0 group-hover:opacity-10"
                                        )}
                                        title={t(`settings.mcp.permissions.${p.id}`)}
                                    >
                                        <p.icon className={cn("h-3 w-3", (draftPermissions.includes(p.id) || isInternal) ? p.color : "")} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            void onToggle(server.id ?? server.name, isEnabled, isInternal);
                        }}
                        className={cn(
                            'flex items-center gap-2 rounded-full h-8 px-3 transition-all',
                            isEnabled
                                ? 'border-success/30 bg-success/10 text-success hover:bg-success/20 shadow-glow-success-soft'
                                : 'border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                    >
                        <Power className={cn('h-3.5 w-3.5', isEnabled && 'fill-current')} />
                        {isEnabled
                            ? t('settings.mcp.status.enabled')
                            : t('settings.mcp.status.disabled')}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => (isEditing ? onCancelEdit() : onEdit(server))}
                        className={cn(
                            "rounded-lg h-8 w-8 transition-colors",
                            isEditing ? "bg-primary/20 text-primary shadow-glow-primary-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={t('common.edit')}
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    {!isInternal && (
                        <div className="flex items-center gap-1 opacity-100 transition-opacity ml-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { void onDelete(server.id ?? server.name, isInternal); }}
                                className="rounded-lg h-8 w-8 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                title={t('common.delete')}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Inline Edit Panel */}
            {isEditing && (
                <div className="border-t border-border/20 bg-muted/10 p-5 animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-5">
                        <div className="grid gap-3">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3" />
                                {t('settings.mcp.permissions.title').toUpperCase()}
                            </Label>

                            {isInternal ? (
                                <div className="grid gap-2">
                                    {(server.actions ?? []).map(action => (
                                        <div
                                            key={action.name}
                                            className="flex flex-col gap-3 rounded-lg border border-border/40 bg-background/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-xs font-bold text-foreground">{action.name}</div>
                                                {action.description && (
                                                    <div className="mt-0.5 line-clamp-1 text-10 font-medium text-muted-foreground/60">
                                                        {action.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 gap-1.5">
                                                {ACTION_POLICIES.map(policy => (
                                                    <Button
                                                        key={policy.id}
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setActionPolicy(action.name, policy.id)}
                                                        className={cn(
                                                            "h-7 rounded-md px-2 text-10 font-black uppercase tracking-wide",
                                                            draftActionPermissions[action.name] === policy.id
                                                                ? policy.className
                                                                : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted"
                                                        )}
                                                    >
                                                        {policy.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {(server.actions ?? []).length === 0 && (
                                        <div className="rounded-lg border border-dashed border-border/40 p-4 text-xs font-medium text-muted-foreground/60">
                                            No actions registered.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                                                "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.98]",
                                                draftPermissions.includes(perm.id)
                                                    ? "bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/20 shadow-glow-primary-soft"
                                                    : "bg-background/20 border-border/40 text-muted-foreground opacity-70 hover:opacity-100 hover:border-border/60"
                                            )}
                                        >
                                            <div className={cn(
                                                "rounded-md p-1.5",
                                                draftPermissions.includes(perm.id) ? "bg-primary/20" : "bg-muted/40"
                                            )}>
                                                <perm.icon className={cn("h-4 w-4", draftPermissions.includes(perm.id) ? perm.color : "")} />
                                            </div>
                                            <div className="flex-1 flex flex-col items-start text-left">
                                                <span className="text-xs font-bold tracking-tight">{t(`settings.mcp.permissions.${perm.id}`)}</span>
                                                <span className="text-10 opacity-60 line-clamp-1">{t(`settings.mcp.permissions.${perm.id}_desc`)}</span>
                                            </div>
                                            <div className={cn(
                                                "h-4 w-4 rounded-full border flex items-center justify-center transition-colors",
                                                draftPermissions.includes(perm.id) ? "bg-primary border-primary" : "border-muted-foreground/30"
                                            )}>
                                                {draftPermissions.includes(perm.id) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border/10">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onCancelEdit()}
                                className="h-9 gap-2 px-4"
                            >
                                <X className="h-4 w-4" />
                                {t('common.cancel')}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => { void onSaveEdit(draftPermissions, draftActionPermissions); }}
                                className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow-primary-soft px-5 font-bold"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
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
        void loadServers();
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
        <div className="flex flex-col space-y-4 p-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
                        <Server className="h-6 w-6 text-primary" />
                        {t('settings.mcp.servers.title')}
                    </h2>
                    <p className="text-xs font-medium text-muted-foreground/60">
                        {t('settings.mcp.servers.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-full bg-success/10 px-4 py-1.5 text-xs font-black text-success ring-1 ring-success/20 shadow-glow-success-soft">
                        {activeCount} / {servers.length} {t('settings.mcp.status.active').toUpperCase()}
                    </div>
                </div>
            </div>

            {loading && servers.length === 0 ? (
                <div className="flex h-32 items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary/40" />
                </div>
            ) : (
                <div className="grid gap-3 pt-4">
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
                            <Server className="mb-3 h-10 w-10 opacity-20" />
                            <p className="mb-1">{t('settings.mcp.servers.empty')}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
