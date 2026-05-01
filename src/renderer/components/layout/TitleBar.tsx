/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import logoBlack from '@assets/tengra_black.png';
import logoWhite from '@assets/tengra_white.png';
import { IconLoader2, IconMinus, IconPuzzle, IconSquare, IconX } from '@tabler/icons-react';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface TitleBarProps {
    children?: ReactNode;
    leftContent?: ReactNode;
    className?: string;
    onExtensionClick?: () => void;
}

export function TitleBar({ children, leftContent, className, onExtensionClick }: TitleBarProps) {
    const { t } = useTranslation();
    const { isLight } = useTheme();
    const [lazyStatus, setLazyStatus] = useState<{ loaded: number; registered: number; loading: number }>({
        loaded: 0,
        registered: 0,
        loading: 0
    });

    const dragStyle = useMemo<AppRegionStyle>(() => ({ WebkitAppRegion: 'drag' }), []);
    const noDragStyle = useMemo<AppRegionStyle>(() => ({ WebkitAppRegion: 'no-drag' }), []);

    const handleMinimize = useCallback(() => window.electron.minimize(), []);
    const handleMaximize = useCallback(() => window.electron.maximize(), []);
    const handleClose = useCallback(() => window.electron.close(), []);

    const logo = useMemo(() => (isLight ? logoBlack : logoWhite), [isLight]);

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
                    'z-40 flex h-12 select-none items-center justify-between border-b border-border/40 bg-card/40 px-6 backdrop-blur',
                    className
                )}
                style={dragStyle}
            >
                <div className="flex items-center gap-4" style={noDragStyle}>
                    <div className="flex items-center gap-2">
                        <img
                            src={logo}
                            alt={t('frontend.app.name')}
                            className="h-8 w-8 object-contain"
                        />
                        <span className="text-sm font-bold text-foreground/80">
                            {t('frontend.app.name')}
                        </span>
                    </div>
                    {leftContent}
                </div>

                {/* Center Content (e.g. Token Counter) */}
                {children}

                <div className="flex items-center gap-2" style={noDragStyle}>
                    <div className="flex items-center gap-2 px-2">
                        <div
                            className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 typo-overline text-muted-foreground"
                            title={t('frontend.titleBar.lazyServicesStatus', {
                                loaded: lazyStatus.loaded,
                                registered: lazyStatus.registered
                            })}
                        >
                            {lazyStatus.loading > 0 && <IconLoader2 className="h-3 w-3 animate-spin" />}
                            <span>{lazyStatus.loaded}/{lazyStatus.registered}</span>
                        </div>
                        {onExtensionClick && (
                            <button
                                onClick={onExtensionClick}
                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-info/10 hover:text-info"
                                title={t('frontend.titleBar.extension')}
                                aria-label={t('frontend.titleBar.extension')}
                            >
                                <IconPuzzle className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            onClick={handleMinimize}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                            title={t('frontend.titleBar.minimize')}
                            aria-label={t('frontend.titleBar.minimize')}
                        >
                            <IconMinus className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleMaximize}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                            title={t('frontend.titleBar.maximize')}
                            aria-label={t('frontend.titleBar.maximize')}
                        >
                            <IconSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={handleClose}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                            title={t('frontend.titleBar.close')}
                            aria-label={t('frontend.titleBar.close')}
                        >
                            <IconX className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>
        </>
    );
}
