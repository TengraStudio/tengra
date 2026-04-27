/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt,IconCheck, IconDownload, IconHistory, IconRefresh, IconSearch, IconSparkles } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { ImageComparisonResult, ImageHistoryEntry } from '../../types';

/* Batch-02: Extracted Long Classes */
const C_IMAGESETTINGSHISTORY_1 = "p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/history:scale-110 transition-transform duration-500";
const C_IMAGESETTINGSHISTORY_2 = "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 transition-colors group-focus-within:text-primary";
const C_IMAGESETTINGSHISTORY_3 = "h-10 px-6 rounded-xl border-border/40 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-95 shadow-sm";
const C_IMAGESETTINGSHISTORY_4 = "h-10 px-6 rounded-xl border-border/40 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-95 shadow-sm";


interface ImageSettingsHistoryProps {
    historyEntries: ImageHistoryEntry[];
    historySearchQuery: string;
    setHistorySearchQuery: (value: string) => void;
    imageAnalytics: {
        totalGenerated: number;
        byProvider: Record<string, number>;
        averageSteps: number;
        bySource?: Record<string, number>;
        averageDurationMs?: number;
    };
    selectedCompareIds: string[];
    toggleCompareSelection: (id: string) => void;
    handleRegenerate: (id: string) => Promise<void>;
    handleExportHistory: () => Promise<void>;
    handleRunComparison: () => Promise<void>;
    handleExportComparison: () => Promise<void>;
    handleShareComparison: () => Promise<void>;
    comparisonShareCode: string;
    setSelectedCompareIds: (ids: string[]) => void;
    comparisonResult: ImageComparisonResult | null;
    t: (key: string, options?: Record<string, string | number>) => string | undefined;
}

export const ImageSettingsHistory: React.FC<ImageSettingsHistoryProps> = ({
    historyEntries,
    historySearchQuery,
    setHistorySearchQuery,
    imageAnalytics,
    selectedCompareIds,
    toggleCompareSelection,
    handleRegenerate,
    handleExportHistory,
    handleRunComparison,
    handleExportComparison,
    handleShareComparison,
    comparisonShareCode,
    setSelectedCompareIds,
    comparisonResult,
    t,
}) => {
    const COMPONENT_CLASSES = {
        wrapper: "bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/history hover:border-border/60 transition-all duration-500 overflow-hidden relative",
        buttonExport: "h-10 px-6 rounded-xl border-border/40 bg-muted/20 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-95 flex items-center gap-3 shadow-sm",
        searchBase: "h-12 pl-12 pr-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 typo-caption font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all",
        emptyState: "flex flex-col items-center justify-center py-12 text-center bg-muted/5 border-2 border-dashed border-border/20 rounded-2xl opacity-40 group-hover/history:border-primary/20 transition-all duration-500 relative z-10",
        historyItem: "group/item flex flex-col gap-4 bg-background/50 border border-border/20 rounded-2xl p-5 transition-all hover:bg-muted/10 hover:border-border/40 shadow-sm",
        buttonRegenerate: "h-8 px-4 rounded-lg typo-body font-bold bg-primary/5 text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95 shadow-sm shrink-0",
        buttonRunCompare: "h-12 px-8 rounded-2xl bg-foreground text-background hover:bg-primary hover:text-primary-foreground typo-body font-bold transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 shadow-xl shadow-black/10 flex items-center gap-3",
        buttonUtil: "h-10 px-6 rounded-xl border-border/40 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-95 shadow-sm",
        analyticsBox: "bg-muted/20 border border-border/20 rounded-2xl p-6 space-y-4 relative z-10 group/analytics hover:bg-muted/30 transition-all duration-500",
        textArea: "min-h-32 w-full rounded-2xl border border-border/40 bg-muted/40 p-6 font-mono typo-body text-muted-foreground leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20 outline-none transition-all custom-scrollbar",
        compareBox: "bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-6 relative z-10 animate-in zoom-in-95 duration-700",
        compareItem: "bg-background/80 border border-primary/10 rounded-xl p-4 space-y-3 shadow-inner hover:border-primary/40 transition-all duration-500"
    };
    return (
        <div className={COMPONENT_CLASSES.wrapper}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={C_IMAGESETTINGSHISTORY_1}>
                        <IconHistory className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground group-hover/history:text-primary transition-colors">
                            {t('settings.images.historyTitle')}
                        </h3>
                        <p className="typo-body text-muted-foreground mt-1 font-bold opacity-60">
                            {historyEntries.length} {t('settings.images.historyEntries')}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { void handleExportHistory(); }}
                    className={COMPONENT_CLASSES.buttonExport}
                >
                    <IconDownload className="w-3.5 h-3.5" />
                    {t('settings.images.exportHistory')}
                </Button>
            </div>

            <div className="relative group max-w-md w-full relative z-10">
                <IconSearch className={C_IMAGESETTINGSHISTORY_2} />
                <Input
                    value={historySearchQuery}
                    onChange={event => setHistorySearchQuery(event.target.value)}
                    placeholder={t('settings.images.searchHistory')}
                    className={COMPONENT_CLASSES.searchBase}
                />
            </div>

            {historyEntries.length === 0 ? (
                <div className={COMPONENT_CLASSES.emptyState}>
                    <IconHistory className="w-8 h-8 mb-4 text-muted-foreground" />
                    <p className="typo-body font-bold text-muted-foreground px-6">
                        {t('settings.images.noHistory')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 relative z-10 max-h-400 overflow-y-auto pr-2 custom-scrollbar">
                    {historyEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className={COMPONENT_CLASSES.historyItem}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1.5 min-w-0 flex-1">
                                    <div className="typo-caption font-bold text-foreground truncate group-hover/item:text-primary transition-colors">
                                        {entry.prompt}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge variant="outline" className="h-5 typo-body px-2 font-bold border-border/40 text-muted-foreground/60 rounded-md">
                                            {entry.provider}
                                        </Badge>
                                        <Badge variant="outline" className="h-5 typo-body px-2 font-bold border-border/40 text-muted-foreground/60 rounded-md bg-muted/20">
                                            {entry.width}x{entry.height}
                                        </Badge>
                                        <span className="typo-body font-bold text-muted-foreground/30">
                                            {new Date(entry.createdAt).toLocaleString(t('common.locale'))}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { void handleRegenerate(entry.id); }}
                                    className={COMPONENT_CLASSES.buttonRegenerate}
                                >
                                    <IconRefresh className="w-3 h-3 mr-2" />
                                    {t('settings.images.regenerate')}
                                </Button>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t border-border/10">
                                <div className="flex items-center gap-2 group/check cursor-pointer" onClick={() => toggleCompareSelection(entry.id)}>
                                    <div className={cn(
                                        "h-5 w-5 rounded-md border transition-all flex items-center justify-center",
                                        selectedCompareIds.includes(entry.id)
                                            ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                                            : "border-border/40 bg-muted/20 text-transparent group-hover/check:border-primary/40"
                                    )}>
                                        <IconCheck className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={cn(
                                        "typo-body font-bold transition-colors",
                                        selectedCompareIds.includes(entry.id) ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {t('common.select')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border/20 relative z-10">
                <Button
                    onClick={() => { void handleRunComparison(); }}
                    disabled={selectedCompareIds.length < 2}
                    className={COMPONENT_CLASSES.buttonRunCompare}
                >
                    <IconBolt className="w-4 h-4" />
                    {t('settings.images.compareRun')}
                </Button>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCompareIds([])}
                        className={COMPONENT_CLASSES.buttonUtil}
                    >
                        {t('settings.images.compareClear')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { void handleExportComparison(); }}
                        className={C_IMAGESETTINGSHISTORY_3}
                    >
                        {t('settings.images.compareExport')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { void handleShareComparison(); }}
                        className={C_IMAGESETTINGSHISTORY_4}
                    >
                        {t('settings.images.compareShare')}
                    </Button>
                </div>
            </div>

            <div className={COMPONENT_CLASSES.analyticsBox}>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover/analytics:rotate-12 transition-transform">
                        <IconSparkles className="w-4 h-4" />
                    </div>
                    <div className="typo-body font-bold text-foreground">{t('settings.images.analyticsTitle')}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <div className="typo-body font-bold text-muted-foreground/40">{t('settings.images.analyticsTotal')}</div>
                        <div className="text-2xl font-bold text-foreground tabular-nums group-hover/analytics:text-primary transition-colors">{imageAnalytics.totalGenerated}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="typo-body font-bold text-muted-foreground/40">{t('settings.images.analyticsAverageSteps')}</div>
                        <div className="text-2xl font-bold text-foreground tabular-nums group-hover/analytics:text-primary transition-colors">{imageAnalytics.averageSteps}</div>
                    </div>
                    {typeof imageAnalytics.averageDurationMs === 'number' && (
                        <div className="space-y-1">
                            <div className="typo-body font-bold text-muted-foreground/40">{t('settings.images.analyticsAverageDuration')}</div>
                            <div className="text-2xl font-bold text-foreground tabular-nums group-hover/analytics:text-primary transition-colors">
                                {Math.round(imageAnalytics.averageDurationMs / 1000)}<span className="typo-caption ml-1">s</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {comparisonResult && (
                <div className={COMPONENT_CLASSES.compareBox}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                                <IconBolt className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="typo-body font-bold text-foreground">{t('settings.images.compareTitle')}</div>
                                <div className="typo-body font-bold text-primary">{comparisonResult.ids.length} Models Analyzed</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-foreground">
                                {Math.round(comparisonResult.summary.averageFileSizeBytes / 1024)} <span className="typo-caption font-bold text-muted-foreground/40">kb</span>
                            </div>
                            <div className="typo-body font-bold text-muted-foreground/40 mt-1">Average Size</div>
                        </div>
                    </div>

                    {Array.isArray(comparisonResult.entries) && comparisonResult.entries.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {comparisonResult.entries.map(entry => (
                                <div key={entry.id} className={COMPONENT_CLASSES.compareItem}>
                                    <div className="typo-body font-bold text-foreground truncate border-b border-primary/5 pb-2">
                                        {entry.prompt}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="typo-body font-bold text-muted-foreground/40">Resolution</div>
                                            <div className="typo-body font-bold">{entry.width}x{entry.height}</div>
                                        </div>
                                        <div>
                                            <div className="typo-body font-bold text-muted-foreground/40">Efficiency</div>
                                            <div className="typo-body font-bold">{entry.bytesPerPixel} <span className="typo-body opacity-40">bpp</span></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {comparisonShareCode && (
                <div className="space-y-3 relative z-10 animate-in slide-in-from-bottom-4 duration-700">
                    <div className="typo-body font-bold text-muted-foreground/40 px-1 px-1">Comparison Logic Hash</div>
                    <textarea
                        value={comparisonShareCode}
                        readOnly
                        className={COMPONENT_CLASSES.textArea}
                    />
                </div>
            )}

            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl opacity-30 pointer-events-none" />
        </div>
    );
};
