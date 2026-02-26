import {
    Activity,
    AlertCircle,
    ChevronRight,
    Play,
    RefreshCw,
    Search,
    Square,
    Terminal as TerminalIcon,
    Trash2,
    X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { useExtensionLogs } from '../hooks/useExtensionLogs';
import { useExtensions } from '../hooks/useExtensions';

interface ExtensionDevToolsProps {
    onClose: () => void;
}

/**
 * Extension Developer Tools
 * Provides an interface for hot reload management and log inspection
 */
export const ExtensionDevTools: React.FC<ExtensionDevToolsProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const {
        extensions,
        loading,
        refresh,
        reload,
        deactivate,
        activate,
    } = useExtensions();

    const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
    const { logs, clearLogs } = useExtensionLogs(selectedExtensionId || undefined);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLogs = useMemo(() => {
        if (!searchQuery) { return logs; }
        return logs.filter((log) =>
            log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.extensionId.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [logs, searchQuery]);

    const activeExtension = useMemo(() =>
        extensions.find((e) => e.manifest.id === selectedExtensionId),
        [extensions, selectedExtensionId]
    );

    return (
        <div className="flex flex-col h-full bg-background border-l border-border animate-in slide-in-from-right duration-300 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <TerminalIcon size={18} className="text-primary" />
                    <h2 className="font-semibold text-foreground">{t('extensionDev.devtools')}</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar: Extension List */}
                <div className="w-64 border-r border-border flex flex-col bg-card/30">
                    <div className="p-3 border-b border-border flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('extensionDev.extensions')}</span>
                        <button
                            onClick={() => void refresh()}
                            className={cn("p-1 hover:bg-muted rounded-md transition-colors", loading && "animate-spin")}
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 space-y-1">
                        {extensions.map((ext) => (
                            <button
                                key={ext.manifest.id}
                                onClick={() => setSelectedExtensionId(ext.manifest.id)}
                                className={cn(
                                    "w-full flex flex-col gap-1 p-3 rounded-lg text-left transition-all relative group",
                                    selectedExtensionId === ext.manifest.id
                                        ? "bg-primary/10 border border-primary/20"
                                        : "hover:bg-muted border border-transparent"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm text-foreground truncate">{ext.manifest.name}</span>
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        ext.status === 'active' ? "bg-success animate-pulse" : "bg-muted-foreground"
                                    )} />
                                </div>
                                <span className="text-xs text-muted-foreground truncate opacity-70">{ext.manifest.id}</span>
                                {selectedExtensionId === ext.manifest.id && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <ChevronRight size={14} className="text-primary" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content: Logs & Actions */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedExtensionId ? (
                        <>
                            {/* Toolbar */}
                            <div className="p-3 border-b border-border flex items-center justify-between bg-card/20">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => void (activeExtension?.status === 'active' ? deactivate(selectedExtensionId) : activate(selectedExtensionId))}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                            activeExtension?.status === 'active'
                                                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                                : "bg-success/10 text-success hover:bg-success/20"
                                        )}
                                    >
                                        {activeExtension?.status === 'active' ? (
                                            <>
                                                <Square size={14} />
                                                {t('extensionDev.deactivate')}
                                            </>
                                        ) : (
                                            <>
                                                <Play size={14} />
                                                {t('extensionDev.activate')}
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => void reload(selectedExtensionId)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-md text-sm font-medium transition-colors"
                                    >
                                        <RefreshCw size={14} />
                                        {t('extensionDev.reload')}
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder={t('extensionDev.searchLogs')}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-8 pr-3 py-1.5 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary w-48"
                                        />
                                    </div>
                                    <button
                                        onClick={clearLogs}
                                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
                                        title={t('extensionDev.clearLogs')}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Log Viewer */}
                            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-0.5 bg-background select-text">
                                {filteredLogs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                        <Activity size={32} className="opacity-20" />
                                        <p>{t('extensionDev.noLogs')}</p>
                                    </div>
                                ) : (
                                    filteredLogs.map((log, idx) => (
                                        <div
                                            key={`${log.timestamp}-${idx}`}
                                            className={cn(
                                                "py-0.5 px-2 rounded hover:bg-muted/30 flex gap-4 animate-in fade-in slide-in-from-left-1 duration-200",
                                                log.level === 'error' && "text-destructive bg-destructive/5",
                                                log.level === 'warn' && "text-warning bg-warning/5",
                                                log.level === 'debug' && "text-muted-foreground opacity-60"
                                            )}
                                        >
                                            <span className="opacity-40 shrink-0 w-24">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <span className={cn(
                                                "font-bold uppercase w-10 shrink-0",
                                                log.level === 'info' && "text-primary",
                                                log.level === 'error' && "text-destructive font-black"
                                            )}>
                                                {log.level}
                                            </span>
                                            <span className="break-all whitespace-pre-wrap">{log.message}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center border border-border">
                                <AlertCircle size={32} className="opacity-50" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-foreground">{t('extensionDev.noExtensionSelected')}</h3>
                                <p className="text-sm">{t('extensionDev.selectExtensionPrompt')}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
