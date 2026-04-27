/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconCircleCheck, IconDownload, IconRotate, IconSettings2 } from '@tabler/icons-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

/* Batch-02: Extracted Long Classes */
const C_IMAGESETTINGSRUNTIME_1 = "p-8 rounded-3xl bg-muted/20 border border-border/20 space-y-8 shadow-sm group-hover/runtime:border-border/40 transition-all duration-500 overflow-hidden relative lg:p-10";
const C_IMAGESETTINGSRUNTIME_2 = "space-y-4 animate-in slide-in-from-top-4 duration-700 bg-background/40 p-6 rounded-2xl border border-border/20 shadow-inner relative z-10 lg:p-8";
const C_IMAGESETTINGSRUNTIME_3 = "rounded-2xl bg-warning/5 border border-warning/10 p-5 flex gap-4 relative z-10 group/help cursor-help hover:bg-warning/10 transition-colors duration-500 sm:p-6 lg:p-8 sm:gap-5 lg:gap-6";


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

    const progressPercentage = downloadProgress ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100) : 0;

    return (
        <div className="space-y-6 pt-6 border-t border-border/20 group/runtime">
            <div className="flex items-center gap-3 px-1">
                <div className={cn(
                    "h-2 w-2 rounded-full animate-pulse",
                    sdCppStatus === 'ready' ? "bg-success" : "bg-warning"
                )} />
                <h4 className="text-sm font-bold text-muted-foreground">
                    {t('settings.images.runtimeManagement')}
                </h4>
            </div>

            <div className={C_IMAGESETTINGSRUNTIME_1}>
                <div className="flex items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-inner border",
                            sdCppStatus === 'ready'
                                ? "bg-success/10 border-success/20 text-success scale-110 shadow-success/10"
                                : "bg-muted/30 border-border/10 text-muted-foreground"
                        )}>
                            {sdCppStatus === 'ready' ? <IconCircleCheck className="w-8 h-8" /> : <IconSettings2 className="w-8 h-8" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h4 className="text-lg font-bold text-foreground">
                                    {t('settings.images.runtimeName')}
                                </h4>
                                {sdCppStatus === 'ready' && (
                                    <Badge className="bg-success/10 text-success hover:bg-success/20 border-success/20 typo-body font-bold px-2 py-0.5 rounded-lg">
                                        {t('settings.images.runtimeVersion')}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 px-0.5">
                                <span className={cn(
                                    "typo-body font-bold px-2.5 py-0.5 rounded-md border",
                                    sdCppStatus === 'ready' ? "bg-success/5 border-success/10 text-success" :
                                        sdCppStatus === 'installing' ? "bg-primary/5 border-primary/10 text-primary animate-pulse" : "bg-muted/10 border-border/10 text-muted-foreground/60"
                                )}>
                                    {t(`settings.images.status.${sdCppStatus}`)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Button
                        onClick={handleReinstallClick}
                        disabled={isReinstalling || sdCppStatus === 'installing'}
                        className={cn(
                            "h-12 px-6 rounded-2xl typo-body font-bold transition-all duration-500 flex items-center gap-3 shadow-lg active:scale-95 disabled:scale-100",
                            (isReinstalling || sdCppStatus === 'installing')
                                ? "bg-muted/40 text-muted-foreground/50 border border-border/20 cursor-not-allowed"
                                : "bg-foreground text-background hover:bg-primary hover:text-primary-foreground shadow-black/10"
                        )}
                    >
                        <IconRotate className={cn("w-4 h-4", (isReinstalling || sdCppStatus === 'installing') && "animate-spin")} />
                        {t('settings.images.reinstall')}
                    </Button>
                </div>

                {/* Progress Monitor */}
                {(sdCppStatus === 'installing' || isReinstalling) && downloadProgress && (
                    <div className={C_IMAGESETTINGSRUNTIME_2}>
                        <div className="flex justify-between items-end gap-6">
                            <div className="space-y-2 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <IconDownload className="w-3.5 h-3.5 text-primary animate-bounce" />
                                    <p className="typo-body font-bold text-primary leading-none">
                                        {t('settings.images.downloading')}
                                    </p>
                                </div>
                                <p className="typo-caption text-muted-foreground/80 truncate font-bold opacity-40">
                                    {downloadProgress.filename}
                                </p>
                            </div>
                            <div className="text-3xl font-bold text-foreground tabular-nums">
                                {progressPercentage}%
                            </div>
                        </div>
                        <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/10 shadow-inner">
                            <div
                                className="h-full bg-primary transition-all duration-1000 ease-out relative rounded-full shadow-lg shadow-primary/20"
                                style={{ width: `${progressPercentage}%` }}
                            >
                                <div className="absolute inset-0 bg-muted/20 animate-pulse" />
                                <div className="absolute top-0 right-0 h-full w-8 bg-gradient-to-r from-transparent to-muted/20 blur-sm" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Help/Support Text */}
                <div className={C_IMAGESETTINGSRUNTIME_3}>
                    <div className="p-2 rounded-xl bg-warning/10 text-warning h-fit group-hover/help:scale-110 transition-transform">
                        <IconAlertTriangle className="w-4 h-4" />
                    </div>
                    <p className="typo-body leading-relaxed text-muted-foreground/60 font-bold pt-1 text-justify">
                        {t('settings.images.reinstallHelp')}
                    </p>
                </div>

                <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl opacity-50" />
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
