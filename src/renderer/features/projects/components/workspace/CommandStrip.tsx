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
    encoding?: string;
    languageName?: string;
    onCommandClick?: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
}

export const CommandStrip: React.FC<CommandStripProps> = ({
    className,
    language,
    branchName = 'main',
    notificationCount = 0,
    status = 'ready',
    encoding = 'UTF-8',
    languageName = 'Plain Text',
    onCommandClick: _onCommandClick,
    onMouseDown,
}) => {
    const { t } = useTranslation(language);

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
            </div>

            {/* Right: System Stats */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                    <span>
                        {t('workspace.encoding')}: {encoding}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                    <span>
                        {t('workspace.language')}: {languageName}
                    </span>
                </div>
                <div className="w-px h-3 bg-white/10" />
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
