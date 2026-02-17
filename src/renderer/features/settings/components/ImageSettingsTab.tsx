import { AlertTriangle, CheckCircle2, CircleDot, Download, Image, RotateCcw, Settings2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { SettingsSharedProps } from '../types';

/**
 * ImageSettingsTab component for managing image generation settings.
 * Allows selecting providers and managing local runtime (SD-CPP).
 */
export const ImageSettingsTab: React.FC<SettingsSharedProps> = ({ settings, handleSave, t }) => {
    const [sdCppStatus, setSdCppStatus] = useState<string>('checking');
    const [isReinstalling, setIsReinstalling] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number; filename: string } | null>(null);

    const checkStatus = useCallback(async () => {
        try {
            const status = await window.electron.sdCpp.getStatus();
            setSdCppStatus(status);
        } catch (error) {
            window.electron.log.error('Failed to get SD-CPP status:', error);
            setSdCppStatus('failed');
        }
    }, []);

    useEffect(() => {
        void checkStatus();

        const removeStatusListener = window.electron.onSdCppStatus((data: unknown) => {
            setSdCppStatus((data as { state: string }).state);
        });

        const removeProgressListener = window.electron.onSdCppProgress((data: unknown) => {
            setDownloadProgress(data as { downloaded: number; total: number; filename: string });
        });

        return () => {
            removeStatusListener();
            removeProgressListener();
        };
    }, [checkStatus]);

    const handleReinstall = async () => {
        if (isReinstalling || sdCppStatus === 'installing') { return; }

        // eslint-disable-next-line no-alert
        if (!window.confirm(t('settings.images.reinstallConfirm'))) {
            return;
        }

        setIsReinstalling(true);
        setDownloadProgress(null);
        try {
            await window.electron.sdCpp.reinstall();
            await checkStatus();
        } catch (error) {
            window.electron.log.error('Failed to reinstall SD-CPP:', error);
        } finally {
            setIsReinstalling(false);
        }
    };

    const getStatusIcon = () => {
        switch (sdCppStatus) {
            case 'ready':
                return <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />;
            case 'installing':
                return <Download className="text-blue-500 w-5 h-5 animate-pulse flex-shrink-0" />;
            case 'failed':
                return <AlertTriangle className="text-rose-500 w-5 h-5 flex-shrink-0" />;
            default:
                return <CircleDot className="text-muted-foreground w-5 h-5 flex-shrink-0" />;
        }
    };

    const getStatusText = () => {
        return t(`settings.images.status.${sdCppStatus}`);
    };

    const progressPercentage = downloadProgress ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100) : 0;

    const currentProvider = settings?.images?.provider || 'antigravity';

    const handleProviderChange = (provider: string) => {
        if (!settings) { return; }
        const updated = {
            ...settings,
            images: {
                ...(settings.images || { provider: 'antigravity' }),
                provider: provider as "antigravity" | "ollama" | "sd-webui" | "comfyui" | "pollinations" | "sd-cpp"
            }
        };
        void handleSave(updated);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Page Header */}
            <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-tight flex items-center gap-2">
                    <Image className="w-4 h-4 text-primary" />
                    {t('settings.images.title')}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('settings.images.description')}
                </p>
            </div>

            {/* Provider Selection */}
            <div className="space-y-4">
                <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-1">
                    {t('settings.images.provider')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {['antigravity', 'pollinations', 'sd-cpp'].map((p) => (
                        <button
                            key={p}
                            onClick={() => handleProviderChange(p)}
                            className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden text-left",
                                currentProvider === p
                                    ? "bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                                    : "bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10"
                            )}
                        >
                            <div className="flex items-center gap-3 relative z-10 w-full pr-8">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 flex-shrink-0",
                                    currentProvider === p ? "bg-primary text-white" : "bg-white/5 text-muted-foreground group-hover:text-foreground"
                                )}>
                                    {p === 'sd-cpp' ? <span className="font-bold text-xs italic">SD</span> : <Image className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <p className={cn("text-sm font-semibold transition-colors duration-200 truncate", currentProvider === p ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                        {p === 'sd-cpp' ? 'Stable Diffusion (Local)' : p.charAt(0).toUpperCase() + p.slice(1)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/60 leading-none mt-1.5 uppercase tracking-wider font-bold">
                                        {p === 'sd-cpp' ? t('settings.images.localRuntime') : t('settings.images.remoteCloud')}
                                    </p>
                                </div>
                            </div>
                            {currentProvider === p && (
                                <CheckCircle2 className="w-5 h-5 text-primary absolute right-4 top-1/2 -translate-y-1/2 z-10" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Runtime Management */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" />
                    {t('settings.images.runtimeManagement')}
                </h4>

                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-5">
                    <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner",
                                sdCppStatus === 'ready' ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-muted-foreground"
                            )}>
                                {sdCppStatus === 'ready' ? <CheckCircle2 className="w-6 h-6" /> : <Image className="w-6 h-6" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                    Stable Diffusion (C++)
                                    {sdCppStatus === 'ready' && (
                                        <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
                                            v1.5
                                        </span>
                                    )}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={cn("w-2 h-2 rounded-full",
                                        sdCppStatus === 'ready' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                            sdCppStatus === 'installing' ? "bg-blue-500 animate-pulse" : "bg-muted-foreground/30")
                                    } />
                                    <span className="text-xxs font-bold text-muted-foreground/80 uppercase tracking-widest">
                                        {getStatusText()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {getStatusIcon()}
                            <button
                                onClick={() => { void handleReinstall(); }}
                                disabled={isReinstalling || sdCppStatus === 'installing'}
                                className={cn(
                                    "px-4 py-2.5 rounded-xl transition-all duration-300 group flex items-center gap-2 text-[10px] font-black uppercase tracking-tight shadow-sm w-full sm:w-auto justify-center",
                                    (isReinstalling || sdCppStatus === 'installing')
                                        ? "bg-white/5 text-muted-foreground/50 border border-white/5 cursor-not-allowed"
                                        : "bg-white/5 text-foreground hover:bg-primary hover:text-white border border-white/10 hover:border-primary shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                                )}
                            >
                                <RotateCcw className={cn("w-3.5 h-3.5", (isReinstalling || sdCppStatus === 'installing') && "animate-spin")} />
                                {t('settings.images.reinstall')}
                            </button>
                        </div>
                    </div>

                    {/* Progress Monitor */}
                    {(sdCppStatus === 'installing' || isReinstalling) && downloadProgress && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-500 bg-black/20 p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-end gap-4">
                                <div className="space-y-1 min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                                        Downloading
                                    </p>
                                    <p className="text-xxs text-muted-foreground/80 truncate font-medium underline underline-offset-4 decoration-white/10">
                                        {downloadProgress.filename}
                                    </p>
                                </div>
                                <span className="text-xl font-black text-foreground/90 tabular-nums italic">
                                    {progressPercentage}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                                <div
                                    className="h-full bg-primary transition-all duration-700 ease-out relative rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                    <div className="absolute top-0 right-0 h-full w-4 bg-gradient-to-r from-transparent to-white/30 blur-sm" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Help/Support Text */}
                    <div className="rounded-xl bg-orange-500/5 border border-orange-500/10 p-3.5 flex gap-3">
                        <AlertTriangle className="w-4 h-4 text-orange-500/60 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] leading-relaxed text-muted-foreground/80 font-medium italic">
                            {t('settings.images.reinstallHelp')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

