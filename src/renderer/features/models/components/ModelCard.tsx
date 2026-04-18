/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { HFModel, OllamaLibraryModel, UnifiedModel } from '@renderer/features/models/types';
import { Download, Sparkles, Star } from 'lucide-react';
import React, { memo } from 'react';

import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_MODELCARD_1 = "flex items-center gap-2 text-xxs font-bold text-muted-foreground/80 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/30";
const C_MODELCARD_2 = "px-3 py-1.5 bg-muted/40 rounded-xl text-xxs font-bold text-muted-foreground/60 border border-transparent group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary transition-all";
const C_MODELCARD_3 = "inline-flex items-center gap-1 text-xxxs font-bold px-2 py-1 rounded-lg bg-primary/15 text-primary border border-primary/20";
const C_MODELCARD_4 = "inline-flex items-center gap-1 text-xxxs font-bold px-2 py-1 rounded-lg bg-warning/15 text-warning border border-warning/20";
const C_MODELCARD_5 = "mb-4 text-xxs font-bold text-muted-foreground flex items-center justify-between border border-border/30 rounded-lg px-3 py-2 bg-muted/20";
const C_MODELCARD_6 = "absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-full group-hover:translate-y-0";


interface ModelCardProps {
    model: UnifiedModel;
    isSelected: boolean;
    isInstalled: boolean;
    isRecommended?: boolean;
    isWatchlisted?: boolean;
    onSelect: (model: UnifiedModel) => void | Promise<void>;
    t: (key: string) => string;
}

const ARCHITECTURE_MAP: Record<string, string> = {
    llama: 'Llama',
    mistral: 'Mistral',
    phi: 'Phi',
    gemma: 'Gemma',
    qwen: 'Qwen'
};

function detectArchitecture(modelName: string, fallbackArchitecture: string): string {
    const nameLower = modelName.toLowerCase();
    for (const [key, arch] of Object.entries(ARCHITECTURE_MAP)) {
        if (nameLower.includes(key)) {
            return arch;
        }
    }
    return fallbackArchitecture;
}

function formatDownloads(downloads: number): string {
    return downloads > 1000 ? `${(downloads / 1000).toFixed(1)}k` : String(downloads);
}

const DownloadBadge: React.FC<{ count: string | number }> = ({ count }) => (
    <div className={C_MODELCARD_1}>
        <Download className="w-3.5 h-3.5" />
        {count}
    </div>
);

function getSecondaryBadgeContent(model: UnifiedModel): { count: string | number } | null {
    if (model.provider === 'huggingface') {
        return { count: formatDownloads((model as HFModel).downloads) };
    }
    const ollamaModel = model as OllamaLibraryModel;
    if (ollamaModel.pulls) {
        return { count: ollamaModel.pulls };
    }
    return null;
}

interface ModelHeaderProps {
    isOllama: boolean;
    isInstalled: boolean;
    badgeContent: { count: string | number } | null;
    t: (key: string) => string;
}

const ModelHeader: React.FC<ModelHeaderProps> = ({ isOllama, isInstalled, badgeContent, t }) => (
    <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-2">
            <div className={cn('text-xxxs font-bold px-3 py-1.5 rounded-xl   shadow-sm', isOllama ? 'bg-warning/20 text-warning border border-warning/40' : 'bg-warning/20 text-warning-foreground border border-warning/40')}>
                {isOllama ? 'OLLAMA' : 'HUGGINGFACE'}
            </div>
            {isInstalled && (
                <div className="text-xxxs font-bold px-3 py-1.5 rounded-xl bg-success/20 text-success border border-success/20 shadow-sm">
                    {t('modelExplorer.pulled')}
                </div>
            )}
        </div>
        {badgeContent && <DownloadBadge count={badgeContent.count} />}
    </div>
);

const ModelTags: React.FC<{ tags: string[] }> = ({ tags }) => (
    <div className="flex flex-wrap gap-2 mt-auto">
        {tags.slice(0, 4).map(tag => (
            <span key={tag} className={C_MODELCARD_2}>
                {tag}
            </span>
        ))}
        {tags.length > 4 && <span className="px-2 py-1 text-xxs font-bold text-muted-foreground/30">+{tags.length - 4}</span>}
    </div>
);

export const ModelCard = memo(({
    model,
    isSelected,
    isInstalled,
    isRecommended = false,
    isWatchlisted = false,
    onSelect,
    t
}: ModelCardProps) => {
    const isOllama = model.provider === 'ollama';
    const name = isOllama ? (model as OllamaLibraryModel).name : (model as HFModel).name;
    const params = isOllama
        ? (model as OllamaLibraryModel).tags.find(tag => tag.toLowerCase().includes('b') || tag.toLowerCase().includes('m'))
        : '';
    const architecture = detectArchitecture(name, t('modelExplorer.architectureTransformer'));
    const badgeContent = getSecondaryBadgeContent(model);

    return (
        <motion.div
            onClick={() => void onSelect(model)}
            className={cn(
                'group relative flex flex-col bg-card border rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer',
                isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/[0.02]' : 'border-border/40 hover:border-primary/30 hover:bg-accent/5'
            )}
        >
            <div className="p-7 flex-1 flex flex-col">
                <ModelHeader isOllama={isOllama} isInstalled={isInstalled} badgeContent={badgeContent} t={t} />
                {(isRecommended || isWatchlisted) && (
                    <div className="flex items-center gap-2 mb-3">
                        {isRecommended && (
                            <span className={C_MODELCARD_3}>
                                <Sparkles className="w-3 h-3" />
                                {t('modelExplorer.recommended')}
                            </span>
                        )}
                        {isWatchlisted && (
                            <span className={C_MODELCARD_4}>
                                <Star className="w-3 h-3" />
                                {t('modelExplorer.watchlist')}
                            </span>
                        )}
                    </div>
                )}
                <div className="relative mb-2">
                    <h3 className="font-bold text-2xl line-clamp-1" title={name}>{name}</h3>
                </div>
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-xxs font-bold text-primary/70">{architecture}</span>
                    {params && <span className="w-1 h-1 rounded-full bg-border" />}
                    {params && <span className="text-xxs font-bold text-muted-foreground">{params} {t('modelExplorer.paramsSuffix')}</span>}
                </div>
                <p className="text-sm text-muted-foreground/70 line-clamp-3 mb-8 leading-relaxed font-medium">
                    {model.description || t('modelExplorer.defaultDescription')}
                </p>
                {model.provider === 'huggingface' && (
                    <div className={C_MODELCARD_5}>
                        <span>{t('modelExplorer.benchmarkScore')}</span>
                        <span className="text-primary">{Math.round((model as HFModel).recommendationScore ?? 0)}/100</span>
                    </div>
                )}
                <ModelTags tags={model.tags} />
            </div>
            <div className={C_MODELCARD_6} />
        </motion.div>
    );
});

ModelCard.displayName = 'ModelCard';
