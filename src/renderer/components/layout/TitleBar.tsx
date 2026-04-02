import { Loader2, Minus, Puzzle, Square, X } from 'lucide-react';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './title-bar.css';


type AppRegionStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface TitleBarProps {
    children?: ReactNode;
    leftContent?: ReactNode;
    className?: string;
    onExtensionClick?: () => void;
}

export function TitleBar({ children, leftContent, className, onExtensionClick }: TitleBarProps) {
    const { t } = useTranslation();
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
                className={cn("tengra-title-bar", className)}
                style={dragStyle}
            >
                <div className="tengra-title-bar__left" style={noDragStyle}>
                    <div className="tengra-title-bar__logo">
                        <img
                            src="@renderer/assets/logo.png"
                            alt={t('app.name')}
                            className="tengra-title-bar__logo-image"
                        />
                        <span className="tengra-title-bar__logo-text">
                            {t('app.name')}
                        </span>
                    </div>
                    {leftContent}
                </div>

                {/* Center Content (e.g. Token Counter) */}
                {children}

                <div className="tengra-title-bar__right" style={noDragStyle}>
                    <div className="tengra-title-bar__controls titlebar-controls">
                        <div
                            className="tengra-title-bar__status"
                            title={t('titleBar.lazyServicesStatus', {
                                loaded: lazyStatus.loaded,
                                registered: lazyStatus.registered
                            })}
                        >
                            {lazyStatus.loading > 0 && <Loader2 className="tengra-title-bar__status-spinner" />}
                            <span>{lazyStatus.loaded}/{lazyStatus.registered}</span>
                        </div>
                        {onExtensionClick && (
                            <button
                                onClick={onExtensionClick}
                                className="tengra-title-bar__control tengra-title-bar__control--extension"
                                title={t('titleBar.extension')}
                                aria-label={t('titleBar.extension')}
                            >
                                <Puzzle className="tengra-title-bar__control-icon" />
                            </button>
                        )}
                        <button
                            onClick={handleMinimize}
                            className="tengra-title-bar__control"
                            title={t('titleBar.minimize')}
                            aria-label={t('titleBar.minimize')}
                        >
                            <Minus className="tengra-title-bar__control-icon" />
                        </button>
                        <button
                            onClick={handleMaximize}
                            className="tengra-title-bar__control"
                            title={t('titleBar.maximize')}
                            aria-label={t('titleBar.maximize')}
                        >
                            <Square className="tengra-title-bar__control-icon tengra-title-bar__control-icon--maximize" />
                        </button>
                        <button
                            onClick={handleClose}
                            className="tengra-title-bar__control tengra-title-bar__control--close"
                            title={t('titleBar.close')}
                            aria-label={t('titleBar.close')}
                        >
                            <X className="tengra-title-bar__control-icon" />
                        </button>
                    </div>
                </div>
            </header>


        </>
    );
}
