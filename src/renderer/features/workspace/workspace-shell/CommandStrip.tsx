import { Bell, Check, ChevronsUpDown, GitBranch, Loader2, } from 'lucide-react';
import React from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface CommandStripProps {
    className?: string;
    language: Language;
    branchName?: string;
    branches?: string[];
    isBranchLoading?: boolean;
    isBranchSwitching?: boolean;
    notificationCount?: number;
    status?: 'ready' | 'busy' | 'error';
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: 'code' | 'image';
    runningTaskCount?: number;
    onRunWorkspace?: () => void;
    onBranchSelect?: (branch: string) => void | Promise<void>;
    onCommandClick?: () => void;
    onQuickSwitchClick?: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
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
    txt: 'workspace.fileLabels.plainText',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
};

const ENCODING_LABEL_KEYS = {
    utf8: 'workspace.fileLabels.encodingUtf8',
    utf8Bom: 'workspace.fileLabels.encodingUtf8Bom',
    utf1632: 'workspace.fileLabels.encodingUtf1632',
    ascii: 'workspace.fileLabels.encodingAscii',
} as const;

function detectLanguageName(path?: string): string {
    if (!path) {
        return 'workspace.fileLabels.plainText';
    }

    const extension = path.split('.').pop()?.toLowerCase();
    if (!extension) {
        return 'workspace.fileLabels.plainText';
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

export const CommandStrip: React.FC<CommandStripProps> = ({
    className,
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
    onMouseDown,
}) => {
    const { t } = useTranslation(language);
    const [isBranchPopoverOpen, setIsBranchPopoverOpen] = React.useState(false);
    const hasBranchSelector = Boolean(onBranchSelect);
    const shouldShowFileMeta = Boolean(activeFilePath) && activeFileType === 'code';
    const detectedEncoding = React.useMemo(
        () => detectEncoding(activeFileContent),
        [activeFileContent]
    );
    const detectedLanguageName = React.useMemo(
        () => detectLanguageName(activeFilePath),
        [activeFilePath]
    );
    const resolveWorkspaceLabel = React.useCallback(
        (value: string) => (value.startsWith('workspace.fileLabels.') ? t(value) : value),
        [t]
    );

    return (
        <div
            className={cn(
                'h-8 flex items-center justify-between px-3 bg-background/80 backdrop-blur-md border-t border-white/5 select-none text-xxs font-medium text-muted-foreground cursor-ns-resize',
                className
            )}
            onMouseDown={onMouseDown}
        >
            {/* Left: Context */}
            <div className="flex items-center gap-4">
                {hasBranchSelector ? (
                    <Popover open={isBranchPopoverOpen} onOpenChange={setIsBranchPopoverOpen}>
                        <PopoverTrigger asChild>
                            <button
                                className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors disabled:opacity-60"
                                title={t('workspace.currentBranch')}
                                disabled={isBranchLoading}
                                onMouseDown={e => {
                                    e.stopPropagation();
                                }}
                                onClick={e => {
                                    e.stopPropagation();
                                }}
                            >
                                {isBranchLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                ) : (
                                    <GitBranch className="w-3 h-3" />
                                )}
                                <span>{branchName}</span>
                                <ChevronsUpDown className="w-3 h-3 opacity-70" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            side="top"
                            align="start"
                            sideOffset={8}
                            className="w-auto min-w-[220px] p-1 bg-popover border border-border rounded-lg"
                            onMouseDown={e => {
                                e.stopPropagation();
                            }}
                        >
                            {isBranchLoading ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                    {t('workspace.loadingBranches')}
                                </div>
                            ) : branches.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                    {t('workspace.noBranchesFound')}
                                </div>
                            ) : (
                                <>
                                    {isBranchSwitching && (
                                        <div className="px-3 py-2 text-[11px] text-primary flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            {t('workspace.switchingBranch')}
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
                                            className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="truncate">{branch}</span>
                                            {branch === branchName && (
                                                <Check className="w-3 h-3 text-primary shrink-0" />
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
                        title={t('workspace.currentBranch')}
                    >
                        <GitBranch className="w-3 h-3" />
                        <span>{branchName}</span>
                    </div>
                )}
            </div>

            {/* Right: System Stats */}
            <div className="flex items-center gap-3">
                {shouldShowFileMeta && (
                    <>
                        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                            <span>
                                {t('workspace.encoding')}: {resolveWorkspaceLabel(detectedEncoding)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                            <span>
                                {t('workspace.language')}: {resolveWorkspaceLabel(detectedLanguageName)}
                            </span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                    </>
                )}
                <button
                    onMouseDown={e => {
                        e.stopPropagation();
                    }}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors relative"
                >
                    <Bell className="w-3 h-3" />
                    {notificationCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                </button>
            </div>
        </div>
    );
};
