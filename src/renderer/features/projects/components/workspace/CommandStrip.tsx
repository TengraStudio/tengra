import { AlertCircle, Bell, CheckCircle2, GitBranch } from 'lucide-react';
import React from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface CommandStripProps {
    className?: string;
    language: Language;
    branchName?: string;
    notificationCount?: number;
    status?: 'ready' | 'busy' | 'error';
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: 'code' | 'image';
    onCommandClick?: () => void;
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
    txt: 'Plain Text',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
};

function detectLanguageName(path?: string): string {
    if (!path) {
        return 'Plain Text';
    }

    const extension = path.split('.').pop()?.toLowerCase();
    if (!extension) {
        return 'Plain Text';
    }

    return LANGUAGE_BY_EXTENSION[extension] ?? extension.toUpperCase();
}

function detectEncoding(content?: string): string {
    if (!content || content.length === 0) {
        return 'UTF-8';
    }

    if (content.charCodeAt(0) === 0xfeff) {
        return 'UTF-8 BOM';
    }

    if (content.includes('\u0000')) {
        return 'UTF-16/32';
    }

    const isAscii = [...content].every(char => char.charCodeAt(0) <= 0x7f);
    return isAscii ? 'ASCII' : 'UTF-8';
}

export const CommandStrip: React.FC<CommandStripProps> = ({
    className,
    language,
    branchName = 'main',
    notificationCount = 0,
    status = 'ready',
    activeFilePath,
    activeFileContent,
    activeFileType = 'code',
    onCommandClick,
    onMouseDown,
}) => {
    const { t } = useTranslation(language);
    const shouldShowFileMeta = Boolean(activeFilePath) && activeFileType === 'code';
    const detectedEncoding = React.useMemo(
        () => detectEncoding(activeFileContent),
        [activeFileContent]
    );
    const detectedLanguageName = React.useMemo(
        () => detectLanguageName(activeFilePath),
        [activeFilePath]
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
                <div
                    className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors"
                    title={t('workspace.currentBranch')}
                >
                    <GitBranch className="w-3 h-3" />
                    <span>{branchName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {status === 'ready' && <CheckCircle2 className="w-3 h-3 text-success" />}
                    {status === 'busy' && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                    {status === 'error' && <AlertCircle className="w-3 h-3 text-destructive" />}
                    <span
                        className={cn(
                            status === 'ready'
                                ? 'text-success/80'
                                : status === 'error'
                                  ? 'text-destructive/80'
                                  : 'text-primary/80'
                        )}
                    >
                        {status.toUpperCase()}
                    </span>
                </div>
                {onCommandClick && (
                    <button
                        onMouseDown={e => {
                            e.stopPropagation();
                        }}
                        onClick={e => {
                            e.stopPropagation();
                            onCommandClick();
                        }}
                        className="px-2 py-0.5 rounded-md border border-border/40 bg-muted/20 hover:bg-muted/40 text-xxs font-semibold text-foreground/80 transition-colors"
                        title={t('shortcuts.commandPalette')}
                    >
                        Ctrl/Cmd+K
                    </button>
                )}
            </div>

            {/* Right: System Stats */}
            <div className="flex items-center gap-3">
                {shouldShowFileMeta && (
                    <>
                        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                            <span>
                                {t('workspace.encoding')}: {detectedEncoding}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                            <span>
                                {t('workspace.language')}: {detectedLanguageName}
                            </span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                    </>
                )}
                <button className="flex items-center gap-1.5 hover:text-foreground transition-colors relative">
                    <Bell className="w-3 h-3" />
                    {notificationCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                </button>
            </div>
        </div>
    );
};
