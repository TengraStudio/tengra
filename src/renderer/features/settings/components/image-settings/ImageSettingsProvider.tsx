/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCircleCheck, IconPhoto } from '@tabler/icons-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { ImageProvider } from '../../types';

/* Batch-02: Extracted Long Classes */
const C_IMAGESETTINGSPROVIDER_1 = "absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500";


interface ImageSettingsProviderProps {
    currentProvider: ImageProvider;
    handleProviderChange: (provider: string) => void;
    t: (key: string) => string | undefined;
}

export const ImageSettingsProvider: React.FC<ImageSettingsProviderProps> = ({
    currentProvider,
    handleProviderChange,
    t,
}) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 px-1">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <h4 className="text-sm font-bold text-muted-foreground">
                    {t('frontend.settings.images.provider')}
                </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['antigravity', 'sd-cpp'].map((p) => (
                    <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={cn(
                            "flex items-center justify-between p-6 rounded-3xl border transition-all duration-500 group relative overflow-hidden text-left",
                            currentProvider === p
                                ? "bg-primary/5 border-primary/40 shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                                : "bg-muted/20 border-border/20 hover:bg-muted/40 hover:border-border/60 hover:shadow-xl hover:shadow-black/5"
                        )}
                    >
                        <div className="flex items-center gap-5 relative z-10 w-full pr-8">
                            <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 flex-shrink-0 border shadow-inner",
                                currentProvider === p
                                    ? "bg-primary border-primary/20 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                                    : "bg-background border-border/20 text-muted-foreground group-hover:text-primary group-hover:border-primary/20 group-hover:scale-105"
                            )}>
                                {p === 'sd-cpp' ? <span className="font-bold text-sm">SD</span> : <IconPhoto className="w-6 h-6" />}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                    {p === 'sd-cpp' ? 'Local Runtime' : 'Remote Cloud'}
                                </div>
                                <p className="typo-body text-muted-foreground/40 leading-none mt-1.5 font-bold">
                                    {p === 'sd-cpp' ? t('frontend.settings.images.localRuntime') : t('frontend.settings.images.remoteCloud')}
                                </p>
                            </div>
                        </div>
                        {currentProvider === p && (
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 animate-in zoom-in-50 duration-500">
                                <IconCircleCheck className="w-6 h-6 text-primary" />
                            </div>
                        )}
                        <div className={C_IMAGESETTINGSPROVIDER_1} />
                    </button>
                ))}
            </div>
        </div>
    );
};
