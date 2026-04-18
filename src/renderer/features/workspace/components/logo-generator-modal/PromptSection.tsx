/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import React, { useCallback } from 'react';

/* Batch-02: Extracted Long Classes */
const C_PROMPTSECTION_1 = "w-full bg-muted/30 border border-border/50 rounded-xl p-3 text-sm min-h-100 resize-none focus:border-primary/50 transition-colors outline-none text-foreground";


interface PromptSectionProps {
    prompt: string;
    setPrompt: (value: string) => void;
    isAnalyzing: boolean;
    onAnalyze: () => Promise<void>;
    onImprovePrompt: () => Promise<void>;
    translateKey: (key: string) => string;
}

export const PromptSection: React.FC<PromptSectionProps> = ({
    prompt,
    setPrompt,
    isAnalyzing,
    onAnalyze,
    onImprovePrompt,
    translateKey,
}) => {
    const handleAnalyzeClick = useCallback(() => {
        void onAnalyze();
    }, [onAnalyze]);

    const handleImproveClick = useCallback(() => {
        void onImprovePrompt();
    }, [onImprovePrompt]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xxs font-bold text-muted-foreground">
                    {translateKey('workspaces.prompt')}
                </label>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleImproveClick}
                        disabled={isAnalyzing || !prompt}
                        className="text-xxs font-bold text-success hover:text-success-light transition-colors flex items-center gap-1 disabled:opacity-50"
                        title={translateKey('workspace.improvePromptWithAI')}
                    >
                        <Sparkles className="w-3 h-3" />
                        {translateKey('workspaces.improvePrompt')}
                    </button>
                    <button
                        onClick={handleAnalyzeClick}
                        disabled={isAnalyzing}
                        className="text-xxs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                        {isAnalyzing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Wand2 className="w-3 h-3" />
                        )}
                        {translateKey('workspaces.analyzeContext')}
                    </button>
                </div>
            </div>
            <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className={C_PROMPTSECTION_1}
                placeholder={translateKey('workspaces.logoPromptPlaceholder')}
            />
        </div>
    );
};
