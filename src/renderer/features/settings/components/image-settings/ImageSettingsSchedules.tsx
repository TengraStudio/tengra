import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { cn } from '@renderer/lib/utils';
import { CalendarClock, Plus, Zap } from 'lucide-react';
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
        <div className="bg-card rounded-3xl border border-border/40 p-8 space-y-8 shadow-sm group/schedules hover:border-border/60 transition-all duration-500 overflow-hidden relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/schedules:scale-110 transition-transform duration-500">
                        <CalendarClock className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground group-hover/schedules:text-primary transition-colors">
                            {t('settings.images.schedulesTitle')}
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold opacity-60">
                            {scheduleEntries.length} {t('settings.images.activeSchedules')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-muted-foreground/40 px-1">Prompt</div>
                        <Input
                            value={schedulePrompt}
                            onChange={event => setSchedulePrompt(event.target.value)}
                            placeholder={t('settings.images.schedulePrompt')}
                            className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 text-xs font-bold placeholder:text-muted-foreground/30 shadow-inner group-hover:bg-muted/30 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-muted-foreground/40 px-1">Scheduled Time</div>
                        <Input
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={event => setScheduleAt(event.target.value)}
                            className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 focus-visible:ring-primary/20 text-xs font-bold shadow-inner group-hover:bg-muted/30 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-muted-foreground/40 px-1">Priority</div>
                        <Select
                            value={schedulePriority}
                            onValueChange={(value: 'low' | 'normal' | 'high') => setSchedulePriority(value)}
                        >
                            <SelectTrigger className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 text-xs font-bold focus:ring-primary/20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                                <SelectItem value="low" className="text-[10px] font-bold">{t('settings.images.priorityLow')}</SelectItem>
                                <SelectItem value="normal" className="text-[10px] font-bold">{t('settings.images.priorityNormal')}</SelectItem>
                                <SelectItem value="high" className="text-[10px] font-bold text-primary">{t('settings.images.priorityHigh')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-muted-foreground/40 px-1">Resource Profile</div>
                        <Select
                            value={scheduleResourceProfile}
                            onValueChange={(value: 'balanced' | 'quality' | 'speed') => setScheduleResourceProfile(value)}
                        >
                            <SelectTrigger className="h-12 px-6 rounded-2xl bg-muted/20 border-border/40 text-xs font-bold focus:ring-primary/20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                                <SelectItem value="balanced" className="text-[10px] font-bold">{t('settings.images.resourceBalanced')}</SelectItem>
                                <SelectItem value="quality" className="text-[10px] font-bold text-primary">{t('settings.images.resourceQuality')}</SelectItem>
                                <SelectItem value="speed" className="text-[10px] font-bold text-success">{t('settings.images.resourceSpeed')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button
                    onClick={() => { void handleCreateSchedule(); }}
                    className="h-12 px-8 rounded-2xl bg-foreground text-background hover:bg-primary hover:text-primary-foreground text-[10px] font-bold transition-all active:scale-95 shadow-xl shadow-black/10 flex items-center gap-3 w-full sm:w-auto"
                >
                    <Plus className="w-4 h-4" />
                    {t('settings.images.scheduleCreate')}
                </Button>
            </div>

            <div className="bg-muted/20 border border-border/20 rounded-3xl p-6 space-y-6 relative z-10 group/queue">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-xl border transition-all",
                            queueStats.running ? "bg-success/10 border-success/20 text-success animate-pulse" : "bg-muted/30 border-border/10 text-muted-foreground/40"
                        )}>
                            <Zap className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-foreground">{t('settings.images.queueTitle')}</div>
                            <div className="text-[9px] font-bold text-muted-foreground/40 mt-0.5">
                                {queueStats.running ? t('settings.images.queueRunning') : t('settings.images.queueIdle')}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-foreground tabular-nums group-hover/queue:text-primary transition-colors">
                            {queueStats.queued}
                        </div>
                        <div className="text-[9px] font-bold text-muted-foreground/40">{t('common.pending')}</div>
                    </div>
                </div>

                {queueStats.byPriority && (
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/10">
                        {['high', 'normal', 'low'].map(p => (
                            <div key={p} className="space-y-1">
                                <div className="text-[8px] font-bold text-muted-foreground/30 text-center">{p}</div>
                                <div className={cn(
                                    "text-sm font-bold text-center  tabular-nums",
                                    p === 'high' ? "text-primary" : "text-foreground"
                                )}>
                                    {queueStats.byPriority?.[p] ?? 0}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-3 relative z-10">
                {scheduleEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center bg-muted/5 border-2 border-dashed border-border/20 rounded-2xl opacity-40">
                         <p className="text-[10px] font-bold text-muted-foreground px-6">
                            {t('settings.images.noSchedules')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {scheduleEntries.slice(0, 8).map(entry => (
                            <div key={entry.id} className="group/item flex flex-col gap-4 bg-background/50 border border-border/20 rounded-2xl p-5 transition-all hover:bg-muted/10 hover:border-border/40 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5 min-w-0 flex-1">
                                        <div className="text-xs font-bold text-foreground truncate group-hover/item:text-primary transition-colors">
                                            {entry.options.prompt}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Badge variant="outline" className={cn(
                                                "h-5 text-[8px] px-2 font-bold   border-border/40 rounded-md",
                                                entry.status === 'scheduled' ? "text-primary bg-primary/5" : "text-muted-foreground/60 bg-muted/20"
                                            )}>
                                                {entry.status}
                                            </Badge>
                                            <span className="text-[9px] font-bold text-muted-foreground/30">
                                                {new Date(entry.runAt).toLocaleString(t('common.locale'))}
                                            </span>
                                        </div>
                                    </div>
                                    {entry.status === 'scheduled' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { void handleCancelSchedule(entry.id); }}
                                            className="h-8 px-4 rounded-lg text-[9px] font-bold border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all active:scale-95 shadow-sm shrink-0"
                                        >
                                            {t('settings.images.scheduleCancel')}
                                        </Button>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 pt-2 border-t border-border/10">
                                    <div className="flex items-center gap-2">
                                        <div className="text-[8px] font-bold text-muted-foreground/40">Priority</div>
                                        <Badge variant="outline" className="h-4 text-[7px] px-1.5 font-bold border-border/20">{entry.priority}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-[8px] font-bold text-muted-foreground/40">Profile</div>
                                        <Badge variant="outline" className="h-4 text-[7px] px-1.5 font-bold border-border/20">{entry.resourceProfile}</Badge>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="absolute -left-24 -bottom-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] opacity-30 pointer-events-none" />
        </div>
    );
};
