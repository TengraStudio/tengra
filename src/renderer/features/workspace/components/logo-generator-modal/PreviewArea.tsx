/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Check, ImageIcon, Loader2, Sparkles } from 'lucide-react';
import React, { useCallback } from 'react';

import { toSafeFileUrl } from '@/utils/safe-file-url.util';

/* Batch-02: Extracted Long Classes */
const C_PREVIEWAREA_1 = "aspect-square w-full rounded-2xl bg-muted/30 border-2 border-dashed border-border/50 flex items-center justify-center relative overflow-hidden group shadow-2xl";
const C_PREVIEWAREA_2 = "px-4 py-2 bg-muted/20 hover:bg-muted/30 border border-border/50 rounded-lg text-xxs font-bold transition-all hover:scale-105 active:scale-95";
const C_PREVIEWAREA_3 = "flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-98 flex items-center justify-center gap-2 shadow-xl shadow-primary/20";
const C_PREVIEWAREA_4 = "flex items-center justify-center px-6 bg-success text-foreground rounded-xl hover:bg-success transition-all active:scale-95 shadow-md shadow-emerald-500/20 disabled:opacity-50";
const C_PREVIEWAREA_5 = "flex items-center justify-center px-6 bg-muted/20 text-muted-foreground hover:text-foreground border border-border/50 rounded-xl hover:bg-muted/30 transition-all active:scale-95";


interface PreviewAreaProps {
    isGenerating: boolean;
    generatedLogo: string | null;
    onGenerate: () => Promise<void>;
    onManualUpload: () => Promise<void>;
    onApply: () => Promise<void>;
    translateKey: (key: string) => string;
    prompt: string;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({
    isGenerating,
    generatedLogo,
    onGenerate,
    onManualUpload,
    onApply,
    translateKey,
    prompt,
}) => {
    const generatedLogoUrl = toSafeFileUrl(generatedLogo);

    const handleGenerateClick = useCallback(() => {
        void onGenerate();
    }, [onGenerate]);

    const handleManualUploadClick = useCallback(() => {
        void onManualUpload();
    }, [onManualUpload]);

    const handleApplyClick = useCallback(() => {
        void onApply();
    }, [onApply]);

    return (
        <div className="flex flex-col gap-4">
            <div className={C_PREVIEWAREA_1}>
                {isGenerating ? (
                    <div className="text-center space-y-3 p-8">
                        <Sparkles className="w-12 h-12 mx-auto animate-bounce text-primary" />
                        <div className="space-y-1">
                            <p className="typo-caption font-bold text-foreground">
                                {translateKey('workspaces.generating')}
                            </p>
                            <p className="text-xxs text-muted-foreground">
                                {translateKey('workspaces.logoGeneratingSubtitle')}
                            </p>
                        </div>
                    </div>
                ) : generatedLogoUrl ? (
                    <img
                        src={generatedLogoUrl}
                        alt={translateKey('workspaces.generatedAlt')}
                        className="w-full h-full object-cover animate-in zoom-in-95 duration-500"
                    />
                ) : (
                    <div className="text-center p-8 opacity-40">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-primary/40" />
                        <p className="typo-caption font-bold mb-4">
                            {translateKey('workspaces.preview')}
                        </p>
                        <button
                            onClick={handleManualUploadClick}
                            className={C_PREVIEWAREA_2}
                        >
                            {translateKey('workspaces.uploadOriginal')}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleGenerateClick}
                    disabled={isGenerating || !prompt}
                    className={C_PREVIEWAREA_3}
                >
                    <Sparkles className="w-4 h-4" />
                    {translateKey('workspaces.generate')}
                </button>

                {generatedLogoUrl ? (
                    <button
                        onClick={handleApplyClick}
                        disabled={isGenerating}
                        className={C_PREVIEWAREA_4}
                        title={translateKey('workspace.applyLogo')}
                    >
                        {isGenerating ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <Check className="w-6 h-6" />
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handleManualUploadClick}
                        className={C_PREVIEWAREA_5}
                        title={translateKey('workspace.uploadImage')}
                    >
                        <ImageIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    );
};
