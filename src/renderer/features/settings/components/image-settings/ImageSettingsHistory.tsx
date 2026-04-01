import { History } from 'lucide-react';
import React from 'react';

import { ImageComparisonResult, ImageHistoryEntry } from '../../types';

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
    return (
        <div className="rounded-xl border border-border/40 bg-muted/30 p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                {t('settings.images.historyTitle')}
            </h5>
            <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                    value={historySearchQuery}
                    onChange={event => setHistorySearchQuery(event.target.value)}
                    placeholder={t('settings.images.searchHistory')}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
                />
                <button
                    onClick={() => { void handleExportHistory(); }}
                    className="rounded-lg border border-border/50 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.exportHistory')}
                </button>
            </div>
            {historyEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('settings.images.noHistory')}</p>
            ) : (
                <div className="space-y-2">
                    {historyEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className="rounded-lg border border-border/40 bg-background/40 p-2 text-xs">
                            <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="truncate font-semibold text-foreground/90">{entry.prompt}</span>
                                <button
                                    onClick={() => { void handleRegenerate(entry.id); }}
                                    className="rounded border border-border/50 px-2 py-0.5 tw-text-10 text-muted-foreground hover:text-foreground"
                                >
                                    {t('settings.images.regenerate')}
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 tw-text-10 text-muted-foreground/80">
                                <span>{entry.provider}</span>
                                <span>{entry.width}x{entry.height}</span>
                                <span>{new Date(entry.createdAt).toLocaleString(t('common.locale'))}</span>
                            </div>
                            <label className="mt-1 flex items-center gap-2 tw-text-10 text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={selectedCompareIds.includes(entry.id)}
                                    onChange={() => toggleCompareSelection(entry.id)}
                                />
                                {t('common.select')}
                            </label>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    onClick={() => { void handleRunComparison(); }}
                    className="rounded-lg border border-primary/35 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-primary"
                >
                    {t('settings.images.compareRun')}
                </button>
                <button
                    onClick={() => setSelectedCompareIds([])}
                    className="rounded-lg border border-border/50 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.compareClear')}
                </button>
                <button
                    onClick={() => { void handleExportComparison(); }}
                    className="rounded-lg border border-border/50 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.compareExport')}
                </button>
                <button
                    onClick={() => { void handleShareComparison(); }}
                    className="rounded-lg border border-border/50 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.compareShare')}
                </button>
            </div>

            <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2 tw-text-11 text-muted-foreground">
                <div className="mb-1 font-semibold text-foreground/90">{t('settings.images.analyticsTitle')}</div>
                <div>{t('settings.images.analyticsTotal')}: {imageAnalytics.totalGenerated}</div>
                <div>{t('settings.images.analyticsAverageSteps')}: {imageAnalytics.averageSteps}</div>
                {typeof imageAnalytics.averageDurationMs === 'number' && (
                    <div>{t('settings.images.analyticsAverageDuration')}: {imageAnalytics.averageDurationMs}</div>
                )}
            </div>

            {comparisonResult && (
                <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2 tw-text-11 text-muted-foreground">
                    <div className="mb-1 font-semibold text-foreground/90">{t('settings.images.compareTitle')}</div>
                    <div>{comparisonResult.ids.length}</div>
                    <div>{Math.round(comparisonResult.summary.averageFileSizeBytes / 1024)} {t('common.kb')}</div>
                    {typeof comparisonResult.summary.averageBytesPerPixel === 'number' && (
                        <div>{t('settings.images.compareQuality')}: {comparisonResult.summary.averageBytesPerPixel}</div>
                    )}
                    {Array.isArray(comparisonResult.entries) && comparisonResult.entries.length > 0 && (
                        <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
                            {comparisonResult.entries.map(entry => (
                                <div key={entry.id} className="rounded border border-border/40 bg-background/50 p-2">
                                    <div className="truncate tw-text-10 font-semibold text-foreground/90">{entry.prompt}</div>
                                    <div className="tw-text-10">
                                        {t('settings.images.compareEntryMeta', {
                                            width: entry.width,
                                            height: entry.height,
                                            steps: entry.steps,
                                            cfg: entry.cfgScale,
                                        })}
                                    </div>
                                    <div className="tw-text-10">
                                        {Math.round(entry.fileSizeBytes / 1024)} {t('common.kb')} · {entry.bytesPerPixel}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {comparisonShareCode && (
                <textarea
                    value={comparisonShareCode}
                    readOnly
                    className="mt-3 tw-min-h-64 w-full rounded-md border border-border/40 bg-background/40 px-2 py-1.5 font-mono tw-text-10"
                />
            )}
        </div>
    );
};
