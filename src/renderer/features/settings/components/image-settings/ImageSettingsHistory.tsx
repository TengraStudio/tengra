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
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                {t('settings.images.historyTitle')}
            </h5>
            <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                    value={historySearchQuery}
                    onChange={event => setHistorySearchQuery(event.target.value)}
                    placeholder={t('settings.images.searchHistory') || 'Search image history'}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                />
                <button
                    onClick={() => { void handleExportHistory(); }}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.exportHistory') || 'Export History'}
                </button>
            </div>
            {historyEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('settings.images.noHistory')}</p>
            ) : (
                <div className="space-y-2">
                    {historyEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className="rounded-lg border border-white/10 bg-black/10 p-2 text-xs">
                            <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="truncate font-semibold text-foreground/90">{entry.prompt}</span>
                                <button
                                    onClick={() => { void handleRegenerate(entry.id); }}
                                    className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                    {t('settings.images.regenerate')}
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                                <span>{entry.provider}</span>
                                <span>{entry.width}x{entry.height}</span>
                                <span>{new Date(entry.createdAt).toLocaleString(t('common.locale'))}</span>
                            </div>
                            <label className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
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
                    className="rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                >
                    {t('settings.images.compareRun')}
                </button>
                <button
                    onClick={() => setSelectedCompareIds([])}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.compareClear')}
                </button>
                <button
                    onClick={() => { void handleExportComparison(); }}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.compareExport') || 'Export Compare'}
                </button>
                <button
                    onClick={() => { void handleShareComparison(); }}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    {t('settings.images.compareShare') || 'Share Compare'}
                </button>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2 text-[11px] text-muted-foreground">
                <div className="mb-1 font-semibold text-foreground/90">{t('settings.images.analyticsTitle') || 'Image Analytics'}</div>
                <div>{t('settings.images.analyticsTotal') || 'Total'}: {imageAnalytics.totalGenerated}</div>
                <div>{t('settings.images.analyticsAverageSteps') || 'Avg Steps'}: {imageAnalytics.averageSteps}</div>
                {typeof imageAnalytics.averageDurationMs === 'number' && (
                    <div>{t('settings.images.analyticsAverageDuration') || 'Avg Duration (ms)'}: {imageAnalytics.averageDurationMs}</div>
                )}
            </div>

            {comparisonResult && (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2 text-[11px] text-muted-foreground">
                    <div className="mb-1 font-semibold text-foreground/90">{t('settings.images.compareTitle')}</div>
                    <div>{comparisonResult.ids.length}</div>
                    <div>{Math.round(comparisonResult.summary.averageFileSizeBytes / 1024)} {t('common.kb')}</div>
                    {typeof comparisonResult.summary.averageBytesPerPixel === 'number' && (
                        <div>{t('settings.images.compareQuality') || 'Avg bytes/pixel'}: {comparisonResult.summary.averageBytesPerPixel}</div>
                    )}
                    {Array.isArray(comparisonResult.entries) && comparisonResult.entries.length > 0 && (
                        <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
                            {comparisonResult.entries.map(entry => (
                                <div key={entry.id} className="rounded border border-white/10 bg-black/20 p-2">
                                    <div className="truncate text-[10px] font-semibold text-foreground/90">{entry.prompt}</div>
                                    <div className="text-[10px]">
                                        {entry.width}x{entry.height} · {entry.steps} steps · cfg {entry.cfgScale}
                                    </div>
                                    <div className="text-[10px]">
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
                    className="mt-3 min-h-[64px] w-full rounded-md border border-white/10 bg-black/10 px-2 py-1.5 font-mono text-[10px]"
                />
            )}
        </div>
    );
};
