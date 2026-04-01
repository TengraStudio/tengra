import { CheckCircle2, Image } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { ImageProvider } from '../../types';

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
        <div className="space-y-4">
            <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-1">
                {t('settings.images.provider')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {['antigravity', 'sd-cpp'].map((p) => (
                    <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden text-left",
                            currentProvider === p
                                ? "bg-primary/20 border-primary/40 tw-shadow-primary-soft"
                                : "bg-muted/40 border-border/30 hover:bg-muted/60 hover:border-border/60"
                        )}
                    >
                        <div className="flex items-center gap-3 relative z-10 w-full pr-8">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 flex-shrink-0",
                                currentProvider === p ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground group-hover:text-foreground"
                            )}>
                                {p === 'sd-cpp' ? <span className="font-bold text-xs italic">SD</span> : <Image className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                                <p className="tw-text-10 text-muted-foreground/60 leading-none mt-1.5 uppercase tracking-wider font-bold">
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
    );
};
