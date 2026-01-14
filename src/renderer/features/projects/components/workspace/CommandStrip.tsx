import { AlertCircle,Bell, CheckCircle2, Command, GitBranch } from 'lucide-react';
import React from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface CommandStripProps {
    className?: string;
    language: Language;
    branchName?: string;
    notificationCount?: number;
    status?: 'ready' | 'busy' | 'error';
    onCommandClick?: () => void;
}

export const CommandStrip: React.FC<CommandStripProps> = ({
    className,
    language,
    branchName = 'main',
    notificationCount = 0,
    status = 'ready',
    onCommandClick
}) => {
    const { t } = useTranslation(language);

    return (
        <div className={cn(
            "h-8 flex items-center justify-between px-3 bg-background/80 backdrop-blur-md border-t border-white/5 select-none text-[11px] font-medium text-muted-foreground",
            className
        )}>
            {/* Left: Context */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors" title={t('workspace.currentBranch')}>
                    <GitBranch className="w-3 h-3" />
                    <span>{branchName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {status === 'ready' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    {status === 'busy' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                    {status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                    <span className={cn(
                        status === 'ready' ? "text-emerald-500/80" : status === 'error' ? "text-red-500/80" : "text-blue-500/80"
                    )}>
                        {status.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Center: Command Trigger */}
            <button
                onClick={onCommandClick}
                className="flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
            >
                <Command className="w-3 h-3 text-primary group-hover:text-foreground transition-colors" />
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">{t('workspace.typeCommand')}</span>
                <span className="flex items-center gap-0.5 text-[9px] bg-black/20 px-1 rounded border border-white/5 text-muted-foreground/50">
                    <span>⌘</span><span>K</span>
                </span>
            </button>

            {/* Right: System Stats */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                    <span>UTF-8</span>
                </div>
                <div className="flex items-center gap-1.5 hover:text-foreground cursor-pointer transition-colors">
                    <span>TypeScript</span>
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
