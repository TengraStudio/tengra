import { AlertTriangle, CheckCircle2, CircleDot, Download, Image, RotateCcw, Settings2 } from 'lucide-react';
import React, { useState } from 'react';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

interface ImageSettingsRuntimeProps {
    sdCppStatus: string;
    isReinstalling: boolean;
    setIsReinstalling: (val: boolean) => void;
    downloadProgress: { downloaded: number; total: number; filename: string } | null;
    setDownloadProgress: (val: { downloaded: number; total: number; filename: string } | null) => void;
    checkStatus: () => Promise<void>;
    t: (key: string) => string;
}

export const ImageSettingsRuntime: React.FC<ImageSettingsRuntimeProps> = ({
    sdCppStatus,
    isReinstalling,
    setIsReinstalling,
    downloadProgress,
    setDownloadProgress,
    checkStatus,
    t,
}) => {
    const [isReinstallModalOpen, setIsReinstallModalOpen] = useState(false);

    const handleReinstallClick = (): void => {
        if (isReinstalling || sdCppStatus === 'installing') { return; }
        setIsReinstallModalOpen(true);
    };

    const handleReinstallConfirm = async (): Promise<void> => {
        setIsReinstallModalOpen(false);
        setIsReinstalling(true);
        setDownloadProgress(null);
        try {
            await window.electron.sdCpp.reinstall();
            await checkStatus();
        } catch (error) {
            appLogger.error('ImageSettingsRuntime', 'Failed to reinstall SD-CPP', error as Error);
        } finally {
            setIsReinstalling(false);
        }
    };

    const getStatusIcon = (): JSX.Element => {
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

    const getStatusText = (): string => {
        return t(`settings.images.status.${sdCppStatus}`);
    };

    const progressPercentage = downloadProgress ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100) : 0;

    return (
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
                                {t('settings.images.runtimeName')}
                                {sdCppStatus === 'ready' && (
                                    <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
                                        {t('settings.images.runtimeVersion')}
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
                            onClick={handleReinstallClick}
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
                                    {t('settings.images.downloading')}
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

            <ConfirmationModal
                isOpen={isReinstallModalOpen}
                onClose={() => setIsReinstallModalOpen(false)}
                onConfirm={() => { void handleReinstallConfirm(); }}
                title={t('settings.images.reinstall')}
                message={t('settings.images.reinstallConfirm')}
                confirmLabel={t('settings.images.reinstall')}
                variant="warning"
            />
        </div>
    );
};
