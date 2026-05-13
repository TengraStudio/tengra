/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBell, IconCheck, IconGitBranch, IconLoader2, IconSelector, IconX } from '@tabler/icons-react';
import React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAnalyzing, useWorkspaceDiagnosticCounts } from '@/store/diagnostics.store';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEFOOTER_1 = "w-full px-3 py-2 text-left typo-caption font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm disabled:opacity-50 disabled:cursor-not-allowed";


interface WorkspaceFooterProps {
    className?: string;
    style?: React.CSSProperties;
    language: Language;
    branchName?: string;
    branches?: string[];
    isBranchLoading?: boolean;
    isBranchSwitching?: boolean;
    notificationCount?: number;
    status?: 'ready' | 'busy' | 'error';
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: 'code' | 'image' | 'diff';
    runningTaskCount?: number;
    onRunWorkspace?: () => void;
    onBranchSelect?: (branch: string) => void | Promise<void>;
    onCommandClick?: () => void;
    onQuickSwitchClick?: () => void;
    workspaceId?: string;
}

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
    id?: string | number;
    workspaceId: string;
    serverId: string;
    message: string;
    type: 'info' | 'warn' | 'error';
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
    c: 'C',
    cpp: 'C++',
    cs: 'C#',
    css: 'CSS',
    go: 'Go',
    html: 'HTML',
    java: 'Java',
    js: 'JavaScript',
    json: 'JSON',
    jsx: 'JavaScript React',
    md: 'Markdown',
    php: 'PHP',
    py: 'Python',
    rb: 'Ruby',
    rs: 'Rust',
    sh: 'Shell',
    sql: 'SQL',
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    txt: 'frontend.workspace.fileLabels.plainText',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
};

const ENCODING_LABEL_KEYS = {
    utf8: 'frontend.workspace.fileLabels.encodingUtf8',
    utf8Bom: 'frontend.workspace.fileLabels.encodingUtf8Bom',
    utf1632: 'frontend.workspace.fileLabels.encodingUtf1632',
    ascii: 'frontend.workspace.fileLabels.encodingAscii',
} as const;

function detectLanguageName(path?: string): string {
    if (!path) {
        return 'frontend.workspace.fileLabels.plainText';
    }

    const extension = path.split('.').pop()?.toLowerCase();
    if (!extension) {
        return 'frontend.workspace.fileLabels.plainText';
    }

    return LANGUAGE_BY_EXTENSION[extension] ?? extension.toUpperCase();
}

function detectEncoding(content?: string): string {
    if (!content || content.length === 0) {
        return ENCODING_LABEL_KEYS.utf8;
    }

    if (content.charCodeAt(0) === 0xfeff) {
        return ENCODING_LABEL_KEYS.utf8Bom;
    }

    if (content.includes('\u0000')) {
        return ENCODING_LABEL_KEYS.utf1632;
    }

    const isAscii = [...content].every(char => char.charCodeAt(0) <= 0x7f);
    return isAscii ? ENCODING_LABEL_KEYS.ascii : ENCODING_LABEL_KEYS.utf8;
}

export const WorkspaceFooter: React.FC<WorkspaceFooterProps> = ({
    className,
    style,
    language,
    branchName = 'main',
    branches = [],
    isBranchLoading = false,
    isBranchSwitching = false,
    notificationCount = 0,
    activeFilePath,
    activeFileContent,
    activeFileType = 'code',
    onBranchSelect,
    workspaceId,
}) => {
    const { t } = useTranslation(language);
    const [isBranchPopoverOpen, setIsBranchPopoverOpen] = React.useState(false);
    const [isNotifyPopoverOpen, setIsNotifyPopoverOpen] = React.useState(false);

    const [progress, setProgress] = React.useState<Map<string | number, LspProgress['value']>>(new Map());
    const [notifications, setNotifications] = React.useState<LspNotification[]>([]);

    React.useEffect(() => {
        const cleanupProgress = window.electron.ipcRenderer.on('lsp:progress-event', (_event, data: { workspaceId: string, token: string | number, value: LspProgress['value'] }) => {
            if (workspaceId && data.workspaceId !== workspaceId) { return; }

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
            if (workspaceId && data.workspaceId !== workspaceId) { return; }
            setNotifications(prev => {
                // Prevent duplicate messages in a row
                if (prev.length > 0 && prev[0].message === data.message && prev[0].serverId === data.serverId) {
                    return prev;
                }
                return [{ ...data, id: Date.now() }, ...prev].slice(0, 50);
            });
        });

        return () => {
            cleanupProgress();
            cleanupNotify();
        };
    }, [workspaceId]);

    const activeProgress = Array.from(progress.values());
    const currentProgress = activeProgress[0];

    const hasBranchSelector = Boolean(onBranchSelect);
    const shouldShowFileMeta = Boolean(activeFilePath) && activeFileType !== 'image';
    const detectedEncoding = React.useMemo(
        () => detectEncoding(activeFileContent),
        [activeFileContent]
    );
    const detectedLanguageName = React.useMemo(
        () => detectLanguageName(activeFilePath),
        [activeFilePath]
    );
    const resolveWorkspaceLabel = React.useCallback(
        (value: string) => (value.startsWith('frontend.workspace.fileLabels.') ? t(value) : value),
        [t]
    );

    return (
        <div
            className={cn(
                'h-8 flex items-center justify-between px-3 bg-background/80 backdrop-blur-md select-none text-sm font-medium text-muted-foreground',
                className
            )}
            style={style}
        >
            {/* Left: Context */}
            <div className="flex items-center gap-4">
                {hasBranchSelector ? (
                    <Popover open={isBranchPopoverOpen} onOpenChange={setIsBranchPopoverOpen}>
                        <PopoverTrigger asChild>
                            <button
                                className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors disabled:opacity-60"
                                title={t('frontend.workspace.currentBranch')}
                                disabled={isBranchLoading}
                                onMouseDown={e => {
                                    e.stopPropagation();
                                }}
                                onClick={e => {
                                    e.stopPropagation();
                                }}
                            >
                                {isBranchLoading ? (
                                    <IconLoader2 className="w-3 h-3 animate-spin text-primary" />
                                ) : (
                                    <IconGitBranch className="w-3 h-3" />
                                )}
                                <span>{branchName}</span>
                                <IconSelector className="w-3 h-3 opacity-70" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            side="top"
                            align="start"
                            sideOffset={8}
                            className="w-auto min-w-220 p-1 bg-popover border border-border rounded-lg"
                            onMouseDown={e => {
                                e.stopPropagation();
                            }}
                        >
                            {isBranchLoading ? (
                                <div className="px-3 py-2 typo-caption text-muted-foreground">
                                    {t('frontend.workspace.loadingBranches')}
                                </div>
                            ) : branches.length === 0 ? (
                                <div className="px-3 py-2 typo-caption text-muted-foreground">
                                    {t('frontend.workspace.noBranchesFound')}
                                </div>
                            ) : (
                                <>
                                    {isBranchSwitching && (
                                        <div className="px-3 py-2 typo-overline text-primary flex items-center gap-2">
                                            <IconLoader2 className="w-3 h-3 animate-spin" />
                                            {t('frontend.workspace.switchingBranch')}
                                        </div>
                                    )}
                                    {branches.map(branch => (
                                        <button
                                            key={branch}
                                            onClick={event => {
                                                event.stopPropagation();
                                                setIsBranchPopoverOpen(false);
                                                if (branch !== branchName) {
                                                    void onBranchSelect?.(branch);
                                                }
                                            }}
                                            disabled={isBranchSwitching}
                                            className={C_WORKSPACEFOOTER_1}
                                        >
                                            <span className="truncate">{branch}</span>
                                            {branch === branchName && (
                                                <IconCheck className="w-3 h-3 text-primary shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </>
                            )}
                        </PopoverContent>
                    </Popover>
                ) : (
                    <div
                        className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors"
                        title={t('frontend.workspace.currentBranch')}
                    >
                        <IconGitBranch className="w-3 h-3" />
                        <span>{branchName}</span>
                    </div>
                )}
            </div>

            {/* Right: System Stats */}
            <div className="flex items-center gap-3">
                <AnalysisStatus workspaceId={workspaceId} />
                <GlobalDiagnosticCounts workspaceId={workspaceId} />

                {shouldShowFileMeta && (
                    <>
                        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                            <span>
                                {t('frontend.workspace.encoding')}: {resolveWorkspaceLabel(detectedEncoding)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                            <span>
                                {t('frontend.workspace.language')}: {resolveWorkspaceLabel(detectedLanguageName)}
                            </span>
                        </div>
                        <div className="w-px h-3 bg-muted/60" />
                    </>
                )}
                {currentProgress && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 animate-pulse border-r border-border/20 mr-1">
                        <IconLoader2 className="w-3 h-3 animate-spin" />
                        <span className="truncate max-w-[120px] text-[10px] uppercase tracking-wider">{currentProgress.title || currentProgress.message || 'Processing...'}</span>
                        {currentProgress.percentage !== undefined && (
                            <span className="opacity-60 text-[9px]">{currentProgress.percentage}%</span>
                        )}
                    </div>
                )}

                <Popover open={isNotifyPopoverOpen} onOpenChange={setIsNotifyPopoverOpen}>
                    <PopoverTrigger asChild>
                        <button
                            onMouseDown={e => {
                                e.stopPropagation();
                            }}
                            onClick={e => {
                                e.stopPropagation();
                                setIsNotifyPopoverOpen(!isNotifyPopoverOpen);
                            }}
                            className={cn(
                                "flex items-center gap-1.5 hover:text-foreground transition-colors relative h-full px-1",
                                notifications.length > 0 && "text-primary"
                            )}
                            title="Workspace Notifications"
                        >
                            <IconBell className="w-3 h-3" />
                            {(notifications.length > 0 || notificationCount > 0) && (
                                <span className="absolute top-1 right-0 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
                            )}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        side="top"
                        align="end"
                        sideOffset={12}
                        className="w-96 p-0 overflow-hidden rounded-md border border-border bg-popover shadow-2xl animate-in slide-in-from-bottom-2"
                        onMouseDown={e => {
                            e.stopPropagation();
                        }}
                    >
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/50">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notifications</span>
                            {notifications.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setNotifications([]);
                                    }}
                                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>

                        <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground/40 italic text-[11px]">
                                    No new notifications
                                </div>
                            ) : (
                                notifications.map((n, i) => (
                                    <div key={n.id || i} className="relative group px-4 py-3 border-b border-border/40 last:border-0 hover:bg-accent/5 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "mt-1.5 shrink-0 w-2 h-2 rounded-full",
                                                n.type === 'error' ? "bg-destructive" :
                                                    n.type === 'warn' ? "bg-warning" : "bg-primary"
                                            )} />
                                            <div className="flex-1 min-w-0 pr-6">
                                                <div className="text-[11px] font-medium leading-relaxed text-foreground/90 mb-1 break-words">
                                                    {n.message}
                                                </div>
                                                <div className="text-[9px] text-muted-foreground/60 flex items-center gap-1.5 font-mono">
                                                    <span className="uppercase">{n.serverId}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setNotifications(prev => prev.filter((_, idx) => idx !== i));
                                                }}
                                                className="absolute top-2 right-2 p-1 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
                                            >
                                                <IconX className="w-3 h-3 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};

const AnalysisStatus: React.FC<{
    workspaceId: string | undefined;
}> = ({ workspaceId }) => {
    const { t } = useTranslation();
    const analyzing = useAnalyzing(workspaceId);

    if (!analyzing) {
        return null;
    }

    return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80">
            <div className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/40 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground/60"></span>
            </div>
            <span>{t('frontend.statusBar.analyzing')}</span>
        </div>
    );
};

const GlobalDiagnosticCounts: React.FC<{ workspaceId: string | undefined }> = ({ workspaceId }) => {
    const { errors, warnings } = useWorkspaceDiagnosticCounts(workspaceId);
    if (errors === 0 && warnings === 0) { return null; }

    return (
        <div className="flex items-center gap-2 mr-2">
            {errors > 0 && (
                <div className="flex items-center gap-1 text-destructive text-[10px] font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    <span>{errors}</span>
                </div>
            )}
            {warnings > 0 && (
                <div className="flex items-center gap-1 text-warning text-[10px] font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                    <span>{warnings}</span>
                </div>
            )}
        </div>
    );
};

