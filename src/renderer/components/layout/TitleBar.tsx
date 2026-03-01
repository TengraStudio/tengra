import { FileText, Loader2, Minus, Puzzle, Square, X } from 'lucide-react';
import { type CSSProperties, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

const LazyChangelogModal = lazy(() => import('./ChangelogModal'));

type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface TitleBarProps {
    children?: ReactNode;
    leftContent?: ReactNode;
    className?: string;
    onExtensionClick?: () => void;
}

export function TitleBar({ children, leftContent, className, onExtensionClick }: TitleBarProps) {
    const { t } = useTranslation();
    const [isChangelogOpen, setIsChangelogOpen] = useState(false);
    const [lazyStatus, setLazyStatus] = useState<{ loaded: number; registered: number; loading: number }>({
        loaded: 0,
        registered: 0,
        loading: 0
    });

    const dragStyle = useMemo<AppRegionStyle>(() => ({ WebkitAppRegion: 'drag' }), []);
    const noDragStyle = useMemo<AppRegionStyle>(() => ({ WebkitAppRegion: 'no-drag' }), []);

    const openChangelog = useCallback(() => setIsChangelogOpen(true), []);
    const closeChangelog = useCallback(() => setIsChangelogOpen(false), []);
    const handleMinimize = useCallback(() => window.electron.minimize(), []);
    const handleMaximize = useCallback(() => window.electron.maximize(), []);
    const handleClose = useCallback(() => window.electron.close(), []);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const status = await window.electron.lazyServices.getStatus();
                if (!mounted) {
                    return;
                }
                setLazyStatus({
                    loaded: status.totals.loaded,
                    registered: status.totals.registered,
                    loading: status.totals.loading
                });
            } catch {
                // noop
            }
        };
        void load();
        const timer = window.setInterval(() => {
            void load();
        }, 5000);
        return () => {
            mounted = false;
            window.clearInterval(timer);
        };
    }, []);

    return (
        <>
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
                        <div
                            className="px-2 py-1 rounded-md border border-border/60 text-xxs text-muted-foreground flex items-center gap-1"
                            title={`Lazy services: ${lazyStatus.loaded}/${lazyStatus.registered} loaded`}
                        >
                            {lazyStatus.loading > 0 && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>{lazyStatus.loaded}/{lazyStatus.registered}</span>
                        </div>
                        <button
                            onClick={openChangelog}
                            className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-md transition-all duration-200 text-muted-foreground"
                            title={t('titleBar.changelog')}
                            aria-label={t('titleBar.changelog')}
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        {onExtensionClick && (
                            <button
                                onClick={onExtensionClick}
                                className="p-1.5 hover:bg-info/10 hover:text-info rounded-md transition-all duration-200 text-muted-foreground"
                                title={t('titleBar.extension')}
                                aria-label={t('titleBar.extension')}
                            >
                                <Puzzle className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={handleMinimize}
                            className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                            title={t('titleBar.minimize')}
                            aria-label={t('titleBar.minimize')}
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleMaximize}
                            className="p-1.5 hover:bg-muted/50 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground"
                            title={t('titleBar.maximize')}
                            aria-label={t('titleBar.maximize')}
                        >
                            <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={handleClose}
                            className="p-1.5 hover:bg-destructive hover:text-destructive-foreground rounded-md transition-all duration-200 text-muted-foreground"
                            title={t('titleBar.close')}
                            aria-label={t('titleBar.close')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {isChangelogOpen && (
                <Suspense fallback={null}>
                    <LazyChangelogModal isOpen={isChangelogOpen} onClose={closeChangelog} />
                </Suspense>
            )}
        </>
    );
}
