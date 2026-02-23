import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    CircleDot,
    Download,
    History,
    Image,
    Layers,
    Play,
    RefreshCw,
    RotateCcw,
    Settings2,
    Wand2,
    XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { cn } from '@/lib/utils';

import { SettingsSharedProps } from '../types';

type ImageProvider = 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations' | 'sd-cpp';

interface ImageHistoryEntry {
    id: string;
    provider: string;
    prompt: string;
    width: number;
    height: number;
    steps: number;
    cfgScale: number;
    imagePath: string;
    createdAt: number;
}

interface ImagePresetEntry {
    id: string;
    name: string;
    promptPrefix?: string;
    width: number;
    height: number;
    steps: number;
    cfgScale: number;
}

interface ImageScheduleEntry {
    id: string;
    runAt: number;
    status: string;
    options: {
        prompt: string;
    };
}

interface ImageComparisonResult {
    ids: string[];
    summary: {
        averageFileSizeBytes: number;
        smallestFileId?: string;
        largestFileId?: string;
    };
}

/**
 * ImageSettingsTab component for managing image generation settings.
 * Allows selecting providers and managing local runtime (SD-CPP).
 */
export const ImageSettingsTab: React.FC<SettingsSharedProps> = ({ settings, handleSave, t }) => {
    const [sdCppStatus, setSdCppStatus] = useState<string>('checking');
    const [isReinstalling, setIsReinstalling] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number; filename: string } | null>(null);
    const [historyEntries, setHistoryEntries] = useState<ImageHistoryEntry[]>([]);
    const [presetEntries, setPresetEntries] = useState<ImagePresetEntry[]>([]);
    const [scheduleEntries, setScheduleEntries] = useState<ImageScheduleEntry[]>([]);
    const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
    const [comparisonResult, setComparisonResult] = useState<ImageComparisonResult | null>(null);
    const [queueStats, setQueueStats] = useState<{ queued: number; running: boolean }>({ queued: 0, running: false });
    const [isDataRefreshing, setIsDataRefreshing] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [presetName, setPresetName] = useState('');
    const [presetPromptPrefix, setPresetPromptPrefix] = useState('');
    const [schedulePrompt, setSchedulePrompt] = useState('');
    const [scheduleAt, setScheduleAt] = useState('');
    const [batchPrompts, setBatchPrompts] = useState('');
    const [editSource, setEditSource] = useState('');
    const [editPrompt, setEditPrompt] = useState('');
    const [editMode, setEditMode] = useState<'img2img' | 'inpaint' | 'outpaint' | 'style-transfer'>('img2img');

    const checkStatus = useCallback(async () => {
        try {
            const status = await window.electron.sdCpp.getStatus();
            setSdCppStatus(status);
        } catch (error) {
            window.electron.log.error('Failed to get SD-CPP status:', error);
            setSdCppStatus('failed');
        }
    }, []);

    const refreshImageData = useCallback(async () => {
        setIsDataRefreshing(true);
        try {
            const [history, presets, schedulesRaw, stats] = await Promise.all([
                window.electron.sdCpp.getHistory(24),
                window.electron.sdCpp.listPresets(),
                window.electron.sdCpp.listSchedules(),
                window.electron.sdCpp.getQueueStats(),
            ]);
            setHistoryEntries(history);
            setPresetEntries(presets);
            setScheduleEntries(Array.isArray(schedulesRaw) ? (schedulesRaw as ImageScheduleEntry[]) : []);
            setQueueStats(stats);
        } catch (error) {
            window.electron.log.error('Failed to refresh image data:', error);
        } finally {
            setIsDataRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void Promise.all([checkStatus(), refreshImageData()]);

        const removeStatusListener = window.electron.onSdCppStatus((data: unknown) => {
            setSdCppStatus((data as { state: string }).state);
        });

        const removeProgressListener = window.electron.onSdCppProgress((data: unknown) => {
            setDownloadProgress(data as { downloaded: number; total: number; filename: string });
        });

        return () => {
            removeStatusListener();
            removeProgressListener();
        };
    }, [checkStatus, refreshImageData]);

    const [isReinstallModalOpen, setIsReinstallModalOpen] = useState(false);

    const handleReinstallClick = () => {
        if (isReinstalling || sdCppStatus === 'installing') { return; }
        setIsReinstallModalOpen(true);
    };

    const handleReinstallConfirm = async () => {
        setIsReinstallModalOpen(false);
        setIsReinstalling(true);
        setDownloadProgress(null);
        try {
            await window.electron.sdCpp.reinstall();
            await checkStatus();
        } catch (error) {
            window.electron.log.error('Failed to reinstall SD-CPP:', error);
        } finally {
            setIsReinstalling(false);
        }
    };

    const getStatusIcon = () => {
        switch (sdCppStatus) {
            case 'ready':
                return <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />;
            case 'installing':
                return <Download className="text-blue-500 w-5 h-5 animate-pulse flex-shrink-0" />;
            case 'failed':
                return <AlertTriangle className="text-rose-500 w-5 h-5 flex-shrink-0" />;
            default:
                return <CircleDot className="text-muted-foreground w-5 h-5 flex-shrink-0" />;
        }
    };

    const getStatusText = () => {
        return t(`settings.images.status.${sdCppStatus}`);
    };

    const progressPercentage = downloadProgress ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100) : 0;

    const currentProvider = (settings?.images?.provider || 'antigravity') as ImageProvider;

    const handleProviderChange = (provider: string) => {
        if (!settings) { return; }
        const updated = {
            ...settings,
            images: {
                ...(settings.images || { provider: 'antigravity' }),
                provider: provider as "antigravity" | "ollama" | "sd-webui" | "comfyui" | "pollinations" | "sd-cpp"
            }
        };
        void handleSave(updated);
    };

    const toggleCompareSelection = (id: string) => {
        setSelectedCompareIds(previous => {
            if (previous.includes(id)) {
                return previous.filter(item => item !== id);
            }
            if (previous.length >= 4) {
                return previous;
            }
            return [...previous, id];
        });
    };

    const handleRegenerate = async (id: string) => {
        try {
            await window.electron.sdCpp.regenerate(id);
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to regenerate image:', error);
            setActionMessage(t('common.error'));
        }
    };

    const handleSavePreset = async () => {
        if (!presetName.trim()) {
            setActionMessage(t('common.invalidInput'));
            return;
        }
        try {
            await window.electron.sdCpp.savePreset({
                name: presetName.trim(),
                promptPrefix: presetPromptPrefix.trim() || undefined,
                width: 1024,
                height: 1024,
                steps: 24,
                cfgScale: 7,
                provider: currentProvider,
            });
            setPresetName('');
            setPresetPromptPrefix('');
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to save image preset:', error);
            setActionMessage(t('common.error'));
        }
    };

    const handleDeletePreset = async (id: string) => {
        try {
            await window.electron.sdCpp.deletePreset(id);
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to delete image preset:', error);
            setActionMessage(t('common.error'));
        }
    };

    const handleCreateSchedule = async () => {
        const normalizedPrompt = schedulePrompt.trim();
        const runAt = Date.parse(scheduleAt);
        if (!normalizedPrompt || Number.isNaN(runAt)) {
            setActionMessage(t('common.invalidInput'));
            return;
        }
        try {
            await window.electron.sdCpp.schedule({
                runAt,
                options: {
                    prompt: normalizedPrompt,
                    width: 1024,
                    height: 1024,
                    steps: 24,
                    cfgScale: 7,
                },
            });
            setSchedulePrompt('');
            setScheduleAt('');
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to create image schedule:', error);
            setActionMessage(t('common.error'));
        }
    };

    const handleCancelSchedule = async (id: string) => {
        try {
            await window.electron.sdCpp.cancelSchedule(id);
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to cancel image schedule:', error);
            setActionMessage(t('common.error'));
        }
    };

    const handleRunComparison = async () => {
        if (selectedCompareIds.length < 2) {
            setActionMessage(t('settings.images.compareSelectionHint'));
            return;
        }
        try {
            const result = await window.electron.sdCpp.compare(selectedCompareIds);
            setComparisonResult(result as ImageComparisonResult);
            setActionMessage(t('common.success'));
        } catch (error) {
            window.electron.log.error('Failed to compare generations:', error);
            setActionMessage(t('common.error'));
        }
    };

    const handleRunBatch = async () => {
        const requests = batchPrompts
            .split('\n')
            .map(prompt => prompt.trim())
            .filter(prompt => prompt.length > 0)
            .slice(0, 20)
            .map(prompt => ({
                prompt,
                width: 1024,
                height: 1024,
                steps: 24,
                cfgScale: 7,
            }));
        if (requests.length === 0) {
            setActionMessage(t('common.invalidInput'));
            return;
        }
        try {
            await window.electron.sdCpp.batchGenerate(requests);
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to run batch generation:', error);
            setActionMessage(t('common.error'));
        }
    };

    const handleRunEdit = async () => {
        if (!editSource.trim() || !editPrompt.trim()) {
            setActionMessage(t('common.invalidInput'));
            return;
        }
        try {
            await window.electron.sdCpp.edit({
                sourceImage: editSource.trim(),
                mode: editMode,
                prompt: editPrompt.trim(),
                width: 1024,
                height: 1024,
            });
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to edit image:', error);
            setActionMessage(t('common.error'));
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Page Header */}
            <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-tight flex items-center gap-2">
                    <Image className="w-4 h-4 text-primary" />
                    {t('settings.images.title')}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('settings.images.description')}
                </p>
            </div>

            {/* Provider Selection */}
            <div className="space-y-4">
                <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-1">
                    {t('settings.images.provider')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {['antigravity', 'pollinations', 'sd-cpp'].map((p) => (
                        <button
                            key={p}
                            onClick={() => handleProviderChange(p)}
                            className={cn(
                                "flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden text-left",
                                currentProvider === p
                                    ? "bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                                    : "bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10"
                            )}
                        >
                            <div className="flex items-center gap-3 relative z-10 w-full pr-8">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 flex-shrink-0",
                                    currentProvider === p ? "bg-primary text-white" : "bg-white/5 text-muted-foreground group-hover:text-foreground"
                                )}>
                                    {p === 'sd-cpp' ? <span className="font-bold text-xs italic">SD</span> : <Image className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <p className={cn("text-sm font-semibold transition-colors duration-200 truncate", currentProvider === p ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                        {p === 'sd-cpp' ? 'Stable Diffusion (Local)' : p.charAt(0).toUpperCase() + p.slice(1)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/60 leading-none mt-1.5 uppercase tracking-wider font-bold">
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

            {/* Runtime Management */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" />
                    {t('settings.images.runtimeManagement')}
                </h4>

                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-5">
                    <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner",
                                sdCppStatus === 'ready' ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-muted-foreground"
                            )}>
                                {sdCppStatus === 'ready' ? <CheckCircle2 className="w-6 h-6" /> : <Image className="w-6 h-6" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                    Stable Diffusion (C++)
                                    {sdCppStatus === 'ready' && (
                                        <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
                                            v1.5
                                        </span>
                                    )}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={cn("w-2 h-2 rounded-full",
                                        sdCppStatus === 'ready' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                            sdCppStatus === 'installing' ? "bg-blue-500 animate-pulse" : "bg-muted-foreground/30")
                                    } />
                                    <span className="text-xxs font-bold text-muted-foreground/80 uppercase tracking-widest">
                                        {getStatusText()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {getStatusIcon()}
                            <button
                                onClick={handleReinstallClick}
                                disabled={isReinstalling || sdCppStatus === 'installing'}
                                className={cn(
                                    "px-4 py-2.5 rounded-xl transition-all duration-300 group flex items-center gap-2 text-[10px] font-black uppercase tracking-tight shadow-sm w-full sm:w-auto justify-center",
                                    (isReinstalling || sdCppStatus === 'installing')
                                        ? "bg-white/5 text-muted-foreground/50 border border-white/5 cursor-not-allowed"
                                        : "bg-white/5 text-foreground hover:bg-primary hover:text-white border border-white/10 hover:border-primary shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                                )}
                            >
                                <RotateCcw className={cn("w-3.5 h-3.5", (isReinstalling || sdCppStatus === 'installing') && "animate-spin")} />
                                {t('settings.images.reinstall')}
                            </button>
                        </div>
                    </div>

                    {/* Progress Monitor */}
                    {(sdCppStatus === 'installing' || isReinstalling) && downloadProgress && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-500 bg-black/20 p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-end gap-4">
                                <div className="space-y-1 min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                                        Downloading
                                    </p>
                                    <p className="text-xxs text-muted-foreground/80 truncate font-medium underline underline-offset-4 decoration-white/10">
                                        {downloadProgress.filename}
                                    </p>
                                </div>
                                <span className="text-xl font-black text-foreground/90 tabular-nums italic">
                                    {progressPercentage}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
                                <div
                                    className="h-full bg-primary transition-all duration-700 ease-out relative rounded-full"
                                    style={{ width: `${progressPercentage}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                    <div className="absolute top-0 right-0 h-full w-4 bg-gradient-to-r from-transparent to-white/30 blur-sm" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Help/Support Text */}
                    <div className="rounded-xl bg-orange-500/5 border border-orange-500/10 p-3.5 flex gap-3">
                        <AlertTriangle className="w-4 h-4 text-orange-500/60 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] leading-relaxed text-muted-foreground/80 font-medium italic">
                            {t('settings.images.reinstallHelp')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        {t('settings.images.operationsTitle')}
                    </h4>
                    <button
                        onClick={() => { void refreshImageData(); }}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', isDataRefreshing && 'animate-spin')} />
                        {t('settings.images.refreshData')}
                    </button>
                </div>

                {actionMessage && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                        {actionMessage}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <History className="h-3.5 w-3.5" />
                            {t('settings.images.historyTitle')}
                        </h5>
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
                        </div>

                        {comparisonResult && (
                            <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2 text-[11px] text-muted-foreground">
                                <div className="mb-1 font-semibold text-foreground/90">{t('settings.images.compareTitle')}</div>
                                <div>{comparisonResult.ids.length}</div>
                                <div>{Math.round(comparisonResult.summary.averageFileSizeBytes / 1024)} {t('common.kb')}</div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {t('settings.images.presetsTitle')}
                        </h5>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <input
                                value={presetName}
                                onChange={event => setPresetName(event.target.value)}
                                placeholder={t('settings.images.presetName')}
                                className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                            />
                            <input
                                value={presetPromptPrefix}
                                onChange={event => setPresetPromptPrefix(event.target.value)}
                                placeholder={t('settings.images.promptPrefix')}
                                className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                            />
                        </div>
                        <button
                            onClick={() => { void handleSavePreset(); }}
                            className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                        >
                            {t('settings.images.savePreset')}
                        </button>
                        <div className="mt-3 space-y-1.5">
                            {presetEntries.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t('settings.images.noPresets')}</p>
                            ) : (
                                presetEntries.map(preset => (
                                    <div key={preset.id} className="flex items-center justify-between rounded border border-white/10 bg-black/10 px-2 py-1 text-xs">
                                        <span className="truncate">{preset.name}</span>
                                        <button onClick={() => { void handleDeletePreset(preset.id); }} className="text-destructive">
                                            <XCircle className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {t('settings.images.schedulesTitle')}
                        </h5>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <input
                                value={schedulePrompt}
                                onChange={event => setSchedulePrompt(event.target.value)}
                                placeholder={t('settings.images.schedulePrompt')}
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
                            <div>{t('settings.images.queueStatus')}: {queueStats.running ? t('settings.images.queueRunning') : t('settings.images.queueIdle')}</div>
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

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <Wand2 className="h-3.5 w-3.5" />
                            {t('settings.images.editTitle')}
                        </h5>

                        <textarea
                            value={batchPrompts}
                            onChange={event => setBatchPrompts(event.target.value)}
                            placeholder={t('settings.images.batchPrompts')}
                            className="min-h-[78px] w-full rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                        />
                        <button
                            onClick={() => { void handleRunBatch(); }}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                        >
                            <Play className="h-3.5 w-3.5" />
                            {t('settings.images.batchRun')}
                        </button>

                        <div className="mt-3 grid grid-cols-1 gap-2">
                            <input
                                value={editSource}
                                onChange={event => setEditSource(event.target.value)}
                                placeholder={t('settings.images.editSource')}
                                className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                            />
                            <input
                                value={editPrompt}
                                onChange={event => setEditPrompt(event.target.value)}
                                placeholder={t('settings.images.editPrompt')}
                                className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                            />
                            <select
                                value={editMode}
                                onChange={event => setEditMode(event.target.value as 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer')}
                                className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                            >
                                <option value="img2img">img2img</option>
                                <option value="inpaint">inpaint</option>
                                <option value="outpaint">outpaint</option>
                                <option value="style-transfer">style-transfer</option>
                            </select>
                        </div>
                        <button
                            onClick={() => { void handleRunEdit(); }}
                            className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
                        >
                            {t('settings.images.editRun')}
                        </button>
                    </div>
                </div>
            </div>
            <ConfirmationModal
                isOpen={isReinstallModalOpen}
                onClose={() => setIsReinstallModalOpen(false)}
                onConfirm={() => { void handleReinstallConfirm(); }}
                title={t('settings.images.reinstall')}
                message={t('settings.images.reinstallConfirm')}
                confirmLabel={t('settings.images.reinstall')}
                variant="warning"
            />
        </div>
    );
};

