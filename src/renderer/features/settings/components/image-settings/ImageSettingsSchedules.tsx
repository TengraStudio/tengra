import { CalendarClock } from 'lucide-react';
import React from 'react';

import { ImageScheduleEntry } from '../../types';

interface ImageSettingsSchedulesProps {
    schedulePrompt: string;
    setSchedulePrompt: (prompt: string) => void;
    scheduleAt: string;
    setScheduleAt: (at: string) => void;
    schedulePriority: 'low' | 'normal' | 'high';
    setSchedulePriority: (priority: 'low' | 'normal' | 'high') => void;
    scheduleResourceProfile: 'balanced' | 'quality' | 'speed';
    setScheduleResourceProfile: (profile: 'balanced' | 'quality' | 'speed') => void;
    handleCreateSchedule: () => Promise<void>;
    queueStats: { queued: number; running: boolean; byPriority?: Record<string, number> };
    scheduleEntries: ImageScheduleEntry[];
    handleCancelSchedule: (id: string) => Promise<void>;
    t: (key: string, options?: Record<string, string | number>) => string | undefined;
}

export const ImageSettingsSchedules: React.FC<ImageSettingsSchedulesProps> = ({
    schedulePrompt,
    setSchedulePrompt,
    scheduleAt,
    setScheduleAt,
    schedulePriority,
    setSchedulePriority,
    scheduleResourceProfile,
    setScheduleResourceProfile,
    handleCreateSchedule,
    queueStats,
    scheduleEntries,
    handleCancelSchedule,
    t,
}) => {
    return (
        <div className="rounded-xl border border-border/40 bg-muted/30 p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {t('settings.images.schedulesTitle')}
            </h5>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                    value={schedulePrompt}
                    onChange={event => setSchedulePrompt(event.target.value)}
                    placeholder={t('settings.images.schedulePrompt')}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
                />
                <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={event => setScheduleAt(event.target.value)}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
                />
                <select
                    value={schedulePriority}
                    onChange={event => setSchedulePriority(event.target.value as 'low' | 'normal' | 'high')}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
                >
                    <option value="low">{t('settings.images.priorityLow')}</option>
                    <option value="normal">{t('settings.images.priorityNormal')}</option>
                    <option value="high">{t('settings.images.priorityHigh')}</option>
                </select>
                <select
                    value={scheduleResourceProfile}
                    onChange={event => setScheduleResourceProfile(event.target.value as 'balanced' | 'quality' | 'speed')}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
                >
                    <option value="balanced">{t('settings.images.resourceBalanced')}</option>
                    <option value="quality">{t('settings.images.resourceQuality')}</option>
                    <option value="speed">{t('settings.images.resourceSpeed')}</option>
                </select>
            </div>
            <button
                onClick={() => { void handleCreateSchedule(); }}
                className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 tw-text-10 font-bold uppercase tracking-wider text-primary"
            >
                {t('settings.images.scheduleCreate')}
            </button>

            <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-2 tw-text-11 text-muted-foreground">
                <div className="font-semibold text-foreground/90">{t('settings.images.queueTitle')}</div>
                <div>{t('settings.images.queueStatus')}: {queueStats.running ? t('settings.images.queueRunning') : t('settings.images.queueIdle')}</div>
                <div>{queueStats.queued} {t('common.pending')}</div>
                {queueStats.byPriority && (
                    <div className="tw-text-10">
                        {t('settings.images.queuePrioritySummary', {
                            high: queueStats.byPriority.high ?? 0,
                            normal: queueStats.byPriority.normal ?? 0,
                            low: queueStats.byPriority.low ?? 0,
                        })}
                    </div>
                )}
            </div>

            <div className="mt-3 space-y-1.5">
                {scheduleEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('settings.images.noSchedules')}</p>
                ) : (
                    scheduleEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/40 px-2 py-1 text-xs">
                            <div className="min-w-0">
                                <div className="truncate">{entry.options.prompt}</div>
                                <div className="tw-text-10 text-muted-foreground/80">
                                    {new Date(entry.runAt).toLocaleString(t('common.locale'))} • {entry.status} • {entry.priority} • {entry.resourceProfile}
                                </div>
                            </div>
                            {entry.status === 'scheduled' && (
                                <button
                                    onClick={() => { void handleCancelSchedule(entry.id); }}
                                    className="rounded border border-border/50 px-2 py-0.5 tw-text-10 text-muted-foreground"
                                >
                                    {t('settings.images.scheduleCancel')}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
