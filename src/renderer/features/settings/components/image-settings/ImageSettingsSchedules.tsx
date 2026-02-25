import { CalendarClock } from 'lucide-react';
import React from 'react';

import { ImageScheduleEntry } from '../../types';

interface ImageSettingsSchedulesProps {
    schedulePrompt: string;
    setSchedulePrompt: (prompt: string) => void;
    scheduleAt: string;
    setScheduleAt: (at: string) => void;
    handleCreateSchedule: () => Promise<void>;
    queueStats: { queued: number; running: boolean };
    scheduleEntries: ImageScheduleEntry[];
    handleCancelSchedule: (id: string) => Promise<void>;
    t: (key: string, options?: Record<string, string | number>) => string | undefined;
}

export const ImageSettingsSchedules: React.FC<ImageSettingsSchedulesProps> = ({
    schedulePrompt,
    setSchedulePrompt,
    scheduleAt,
    setScheduleAt,
    handleCreateSchedule,
    queueStats,
    scheduleEntries,
    handleCancelSchedule,
    t,
}) => {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {t('settings.images.schedulesTitle')}
            </h5>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                    value={schedulePrompt}
                    onChange={event => setSchedulePrompt(event.target.value)}
                    placeholder={t('settings.images.schedulePrompt') || 'Schedule Prompt'}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                />
                <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={event => setScheduleAt(event.target.value)}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                />
            </div>
            <button
                onClick={() => { void handleCreateSchedule(); }}
                className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
            >
                {t('settings.images.scheduleCreate')}
            </button>

            <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground/90">{t('settings.images.queueTitle')}</div>
                <div>{t('settings.images.queueStatus')}: {queueStats.running ? t('settings.images.queueRunning') || 'Running' : t('settings.images.queueIdle') || 'Idle'}</div>
                <div>{queueStats.queued} {t('common.pending')}</div>
            </div>

            <div className="mt-3 space-y-1.5">
                {scheduleEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('settings.images.noSchedules')}</p>
                ) : (
                    scheduleEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/10 px-2 py-1 text-xs">
                            <div className="min-w-0">
                                <div className="truncate">{entry.options.prompt}</div>
                                <div className="text-[10px] text-muted-foreground/80">
                                    {new Date(entry.runAt).toLocaleString(t('common.locale'))} • {entry.status}
                                </div>
                            </div>
                            {entry.status === 'scheduled' && (
                                <button
                                    onClick={() => { void handleCancelSchedule(entry.id); }}
                                    className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-muted-foreground"
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
