import { Minus, Puzzle, Square, X } from 'lucide-react';
import { type CSSProperties, ReactNode } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface TitleBarProps {
    children?: ReactNode;
    leftContent?: ReactNode;
    className?: string;
    onExtensionClick?: () => void;
}

export function TitleBar({ children, leftContent, className, onExtensionClick }: TitleBarProps) {
    const { t } = useTranslation();
    type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };
    const dragStyle: AppRegionStyle = { WebkitAppRegion: 'drag' };
    const noDragStyle: AppRegionStyle = { WebkitAppRegion: 'no-drag' };
    return (
        <header
            className={cn(
                'h-12 border-b border-border/40 flex items-center justify-between px-6 bg-card/40 backdrop-blur-md z-40 select-none',
                className
            )}
            style={dragStyle}
        >
            <div className="flex items-center gap-4" style={noDragStyle}>
                <div className="flex items-center gap-2">
                    <img
                        src="@renderer/assets/logo.png"
                        alt={t('app.name')}
                        className="w-8 h-8 object-contain"
                    />
                    <span className="text-xs font-bold tracking-widest text-foreground/80 uppercase">
                        {t('app.name')}
                    </span>
                </div>
                {leftContent}
            </div>

            {/* Center Content (e.g. Token Counter) */}
            {children}

            <div className="flex items-center gap-2" style={noDragStyle}>
                <div className="flex gap-2 titlebar-controls px-2">
                    {onExtensionClick && (
                        <button
                            onClick={onExtensionClick}
                            className="p-1.5 hover:bg-info/10 hover:text-info rounded-md transition-all duration-200 text-muted-foreground"
                            title={t('titleBar.extension')}
                        >
                            <Puzzle className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => window.electron.minimize()}
                        className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                        title={t('titleBar.minimize')}
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => window.electron.maximize()}
                        className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                        title={t('titleBar.maximize')}
                    >
                        <Square className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => window.electron.close()}
                        className="p-1.5 hover:bg-destructive hover:text-destructive-foreground rounded-md transition-all duration-200 text-muted-foreground"
                        title={t('titleBar.close')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}
