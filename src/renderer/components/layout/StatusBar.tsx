/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Status Bar Component
 * VSCode-like status bar with left/right sections and interactive items.
 */

import { IconActivity, IconAlertCircle, IconBell, IconBolt, IconBrain, IconGitBranch, IconLoader2, IconWifi, IconWifiOff } from '@tabler/icons-react';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAnalyzing, useWorkspaceDiagnosticCounts } from '@/store/diagnostics.store';

export interface StatusBarItem {
    id: string;
    content: React.ReactNode;
    tooltip?: string;
    onClick?: () => void;
    priority?: number; // Higher = more left (for left items) or more right (for right items)
    backgroundColor?: string;
    visible?: boolean;
}

interface StatusBarContextType {
    leftItems: StatusBarItem[];
    rightItems: StatusBarItem[];
    addItem: (item: StatusBarItem, position: 'left' | 'right') => void;
    removeItem: (id: string) => void;
    updateItem: (id: string, updates: Partial<StatusBarItem>) => void;
}

const StatusBarContext = createContext<StatusBarContextType | null>(null);

export const useStatusBar = () => {
    const { t } = useTranslation();
    const context = useContext(StatusBarContext);
    if (!context) {
        throw new Error(t('frontend.errors.context.useStatusBarProvider'));
    }
    return context;
};

// Status Bar Provider
export const StatusBarProvider: React.FC<{
    children: React.ReactNode;
    defaultLeftItems?: StatusBarItem[];
    defaultRightItems?: StatusBarItem[];
}> = ({ children, defaultLeftItems = [], defaultRightItems = [] }) => {
    const [leftItems, setLeftItems] = useState<StatusBarItem[]>(defaultLeftItems);
    const [rightItems, setRightItems] = useState<StatusBarItem[]>(defaultRightItems);

    const addItem = useCallback((item: StatusBarItem, position: 'left' | 'right') => {
        const setter = position === 'left' ? setLeftItems : setRightItems;
        setter(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev;
            }
            const newItems = [...prev, item];
            return newItems.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        });
    }, []);

    const removeItem = useCallback((id: string) => {
        setLeftItems(prev => prev.filter(i => i.id !== id));
        setRightItems(prev => prev.filter(i => i.id !== id));
    }, []);

    const updateItem = useCallback((id: string, updates: Partial<StatusBarItem>) => {
        const updater = (items: StatusBarItem[]) =>
            items.map(item => (item.id === id ? { ...item, ...updates } : item));
        setLeftItems(updater);
        setRightItems(updater);
    }, []);

    return (
        <StatusBarContext.Provider
            value={{ leftItems, rightItems, addItem, removeItem, updateItem }}
        >
            {children}
        </StatusBarContext.Provider>
    );
};

// Status Bar Item Component
const StatusBarItemView: React.FC<{
    item: StatusBarItem;
}> = ({ item }) => {
    if (item.visible === false) {
        return null;
    }

    return (
        <div
            onClick={item.onClick}
            title={item.tooltip}
            className={cn(
                'flex items-center gap-1 px-2 py-0.5 typo-overline transition-colors',
                item.onClick && 'cursor-pointer hover:bg-foreground/10'
            )}
            style={item.backgroundColor ? { backgroundColor: item.backgroundColor } : undefined}
        >
            {item.content}
        </div>
    );
};

// Main Status Bar Component
export const StatusBar: React.FC<{
    className?: string;
    workspaceId?: string;
    variant?: 'default' | 'primary' | 'warning' | 'error';
}> = ({ className, workspaceId, variant = 'default' }) => {
    const { leftItems, rightItems } = useStatusBar();
    const variantClass = {
        default: 'bg-primary/90',
        primary: 'bg-primary',
        warning: 'bg-warning',
        error: 'bg-destructive',
    }[variant];

    return (
        <div
            className={cn(
                'fixed bottom-0 left-0 right-0 z-50 flex h-6 select-none items-center justify-between border-t border-border/10 text-foreground/90',
                variantClass,
                className
            )}
        >
            {/* Left section */}
            <div className="flex items-center">
                <AnalysisStatus workspaceId={workspaceId} />
                <GlobalDiagnosticCounts workspaceId={workspaceId} />
                <WorkspaceIntelligenceStatus workspaceId={workspaceId} />
                {leftItems.map(item => (
                    <StatusBarItemView key={item.id} item={item} />
                ))}
            </div>

            {/* Right section */}
            <div className="flex items-center">
                {rightItems.map(item => (
                    <StatusBarItemView key={item.id} item={item} />
                ))}
            </div>
        </div>
    );
};

// Pre-built Status Items
export const GitBranchStatus: React.FC<{
    branch?: string;
    modified?: number;
    onClick?: () => void;
}> = ({ branch = 'main', modified = 0, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            'flex items-center gap-1 px-2 py-0.5 typo-overline',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        <IconGitBranch className="h-3.5 w-3.5" />
        <span>{branch}</span>
        {modified > 0 && <span className="opacity-70">+{modified}</span>}
    </div>
);

export const ConnectionStatus: React.FC<{
    connected: boolean;
    label?: string;
    onClick?: () => void;
}> = ({ connected, label, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            'flex items-center gap-1 px-2 py-0.5 typo-overline',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        {connected ? (
            <IconWifi className="h-3.5 w-3.5" />
        ) : (
            <IconWifiOff className="h-3.5 w-3.5 text-destructive" />
        )}
        {label && <span>{label}</span>}
    </div>
);

export const NotificationBell: React.FC<{
    count?: number;
    onClick?: () => void;
}> = ({ count = 0, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            'relative flex items-center px-2 py-0.5',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        <IconBell className="h-3.5 w-3.5" />
        {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 typo-overline font-bold">
                {count > 99 ? '99+' : count}
            </span>
        )}
    </div>
);

export const LoadingStatus: React.FC<{
    loading: boolean;
    label?: string;
}> = ({ loading, label }) => {
    if (!loading) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 px-2 py-0.5 typo-overline">
            <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
            {label && <span>{label}</span>}
        </div>
    );
};

export const AnalysisStatus: React.FC<{
    workspaceId: string | undefined;
}> = ({ workspaceId }) => {
    const { t } = useTranslation();
    const analyzing = useAnalyzing(workspaceId);

    if (!analyzing) {
        return null;
    }

    return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 typo-overline text-foreground/80">
            <div className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/60"></span>
            </div>
            <span>{t('frontend.statusBar.analyzing')}</span>
        </div>
    );
};

export const ErrorStatus: React.FC<{
    count: number;
    onClick?: () => void;
}> = ({ count, onClick }) => {
    const { t } = useTranslation();
    if (count === 0) {
        return null;
    }
    const label = count === 1 ? t('frontend.statusBar.error') : t('frontend.statusBar.errors');

    return (
        <div
            onClick={onClick}
            className={cn(
                'flex items-center gap-1 bg-destructive/50 px-2 py-0.5 typo-overline',
                onClick && 'cursor-pointer hover:bg-destructive/70'
            )}
        >
            <IconAlertCircle className="h-3.5 w-3.5" />
            <span>
                {count} {label}
            </span>
        </div>
    );
};

interface LspProgress {
    token: string | number;
    value: {
        kind: 'begin' | 'report' | 'end';
        title?: string;
        message?: string;
        percentage?: number;
    };
}

interface LspNotification {
    workspaceId: string;
    serverId: string;
    message: string;
    type: 'info' | 'warn' | 'error';
}

export const WorkspaceIntelligenceStatus: React.FC<{
    workspaceId: string | undefined;
}> = ({ workspaceId }) => {
    const [progress, setProgress] = useState<Map<string | number, LspProgress['value']>>(new Map());
    const [notifications, setNotifications] = useState<LspNotification[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const cleanupProgress = window.electron.ipcRenderer.on('lsp:progress-event', (_event, data: { workspaceId: string, token: string | number, value: LspProgress['value'] }) => {
            if (workspaceId && data.workspaceId !== workspaceId) {return;}
            
            setProgress(prev => {
                const next = new Map(prev);
                if (data.value.kind === 'end') {
                    next.delete(data.token);
                } else {
                    next.set(data.token, data.value);
                }
                return next;
            });
        });

        const cleanupNotify = window.electron.ipcRenderer.on('lsp:notification-event', (_event, data: LspNotification) => {
            if (workspaceId && data.workspaceId !== workspaceId) {return;}
            setNotifications(prev => [data, ...prev].slice(0, 50));
        });

        return () => {
            cleanupProgress();
            cleanupNotify();
        };
    }, [workspaceId]);

    const activeProgress = Array.from(progress.values());
    const currentProgress = activeProgress[0]; // Just show one for brevity in status bar

    return (
        <div className="relative flex items-center h-full">
            {currentProgress && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 typo-overline text-foreground/80 animate-pulse border-r border-foreground/10">
                    <IconLoader2 className="h-3 w-3 animate-spin" />
                    <span className="truncate max-w-[120px]">{currentProgress.title || currentProgress.message || 'Processing...'}</span>
                    {currentProgress.percentage !== undefined && (
                        <span className="opacity-60">{currentProgress.percentage}%</span>
                    )}
                </div>
            )}
            
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                }}
                className={cn(
                    "relative flex items-center h-full px-2 transition-colors",
                    isMenuOpen ? "bg-foreground/20" : "hover:bg-foreground/10",
                    notifications.length > 0 && "text-warning"
                )}
                title="Workspace Intelligence"
            >
                <IconBrain className="h-3.5 w-3.5" />
                {notifications.length > 0 && (
                    <span className="absolute right-1 top-1 flex h-1.5 w-1.5 rounded-full bg-destructive shadow-sm" />
                )}
            </button>

            {isMenuOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40 cursor-default" 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(false);
                        }} 
                    />
                    <div className="absolute bottom-full left-0 z-50 mb-1 w-72 max-h-96 overflow-y-auto rounded-md border border-border/40 bg-popover/95 backdrop-blur-md p-1 shadow-2xl custom-scrollbar ring-1 ring-black/5">
                        <div className="p-2 border-b border-border/20 mb-1 flex items-center justify-between sticky top-0 bg-popover/90 backdrop-blur-sm z-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace Intelligence</span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setNotifications([]);
                                }}
                                className="text-[10px] hover:text-foreground transition-colors font-medium opacity-60"
                            >
                                Clear all
                            </button>
                        </div>
                        <div className="py-1">
                            {notifications.length === 0 ? (
                                <div className="py-8 text-center">
                                    <IconBrain className="h-8 w-8 mx-auto mb-2 opacity-10" />
                                    <div className="text-[10px] text-muted-foreground opacity-50">No new notifications</div>
                                </div>
                            ) : (
                                notifications.map((n, i) => (
                                    <div key={i} className="px-3 py-2.5 text-[11px] hover:bg-foreground/5 transition-colors border-b border-border/10 last:border-0 group">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={cn(
                                                "h-1.5 w-1.5 rounded-full",
                                                n.type === 'error' ? "bg-destructive shadow-[0_0_4px_rgba(239,68,68,0.4)]" : 
                                                n.type === 'warn' ? "bg-warning shadow-[0_0_4px_rgba(245,158,11,0.4)]" : "bg-primary shadow-[0_0_4px_rgba(59,130,246,0.4)]"
                                            )} />
                                            <span className="font-bold opacity-40 group-hover:opacity-60 transition-opacity">[{n.serverId}]</span>
                                            <span className="ml-auto text-[9px] opacity-30">Just now</span>
                                        </div>
                                        <div className="leading-relaxed text-foreground/90 font-medium selection:bg-primary/20">{n.message}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export const WarningStatus: React.FC<{
    count: number;
    onClick?: () => void;
}> = ({ count, onClick }) => {
    const { t } = useTranslation();
    if (count === 0) {
        return null;
    }
    const label = count === 1 ? t('frontend.statusBar.warning') : t('frontend.statusBar.warnings');

    return (
        <div
            onClick={onClick}
            className={cn(
                'flex items-center gap-1 bg-warning/50 px-2 py-0.5 typo-overline',
                onClick && 'cursor-pointer hover:bg-warning/70'
            )}
        >
            <IconAlertCircle className="h-3.5 w-3.5" />
            <span>
                {count} {label}
            </span>
        </div>
    );
};

export const ModelStatus: React.FC<{
    model?: string;
    onClick?: () => void;
}> = ({ model = 'GPT-4', onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            'flex items-center gap-1 px-2 py-0.5 typo-overline',
            onClick && 'cursor-pointer hover:bg-foreground/10'
        )}
    >
        <IconBolt className="h-3.5 w-3.5" />
        <span>{model}</span>
    </div>
);

const GlobalDiagnosticCounts: React.FC<{ workspaceId: string | undefined }> = ({ workspaceId }) => {
    const { errors, warnings } = useWorkspaceDiagnosticCounts(workspaceId);
    return (
        <div className="flex items-center">
            <ErrorStatus count={errors} />
            <WarningStatus count={warnings} />
        </div>
    );
};

export default StatusBar;

