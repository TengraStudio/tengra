import { Image, Layers, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import {
    ImageComparisonResult,
    ImageHistoryEntry,
    ImagePresetEntry,
    ImageProvider,
    ImageScheduleEntry,
    SettingsSharedProps
} from '../types';

import { ImageSettingsEdit } from './image-settings/ImageSettingsEdit';
import { ImageSettingsHistory } from './image-settings/ImageSettingsHistory';
import { ImageSettingsPresets } from './image-settings/ImageSettingsPresets';
import { ImageSettingsProvider } from './image-settings/ImageSettingsProvider';
import { ImageSettingsRuntime } from './image-settings/ImageSettingsRuntime';
import { ImageSettingsSchedules } from './image-settings/ImageSettingsSchedules';

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

            <ImageSettingsProvider
                currentProvider={currentProvider}
                handleProviderChange={handleProviderChange}
                t={t}
            />

            <ImageSettingsRuntime
                sdCppStatus={sdCppStatus}
                isReinstalling={isReinstalling}
                setIsReinstalling={setIsReinstalling}
                downloadProgress={downloadProgress}
                setDownloadProgress={setDownloadProgress}
                checkStatus={checkStatus}
                t={t}
            />

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
                    <ImageSettingsHistory
                        historyEntries={historyEntries}
                        selectedCompareIds={selectedCompareIds}
                        toggleCompareSelection={toggleCompareSelection}
                        handleRegenerate={handleRegenerate}
                        handleRunComparison={handleRunComparison}
                        setSelectedCompareIds={setSelectedCompareIds}
                        comparisonResult={comparisonResult}
                        t={t}
                    />

                    <ImageSettingsPresets
                        presetEntries={presetEntries}
                        presetName={presetName}
                        setPresetName={setPresetName}
                        presetPromptPrefix={presetPromptPrefix}
                        setPresetPromptPrefix={setPresetPromptPrefix}
                        handleSavePreset={handleSavePreset}
                        handleDeletePreset={handleDeletePreset}
                        t={t}
                    />

                    <ImageSettingsSchedules
                        schedulePrompt={schedulePrompt}
                        setSchedulePrompt={setSchedulePrompt}
                        scheduleAt={scheduleAt}
                        setScheduleAt={setScheduleAt}
                        handleCreateSchedule={handleCreateSchedule}
                        queueStats={queueStats}
                        scheduleEntries={scheduleEntries}
                        handleCancelSchedule={handleCancelSchedule}
                        t={t}
                    />

                    <ImageSettingsEdit
                        batchPrompts={batchPrompts}
                        setBatchPrompts={setBatchPrompts}
                        handleRunBatch={handleRunBatch}
                        editSource={editSource}
                        setEditSource={setEditSource}
                        editPrompt={editPrompt}
                        setEditPrompt={setEditPrompt}
                        editMode={editMode}
                        setEditMode={setEditMode}
                        handleRunEdit={handleRunEdit}
                        t={t}
                    />
                </div>
            </div>
        </div>
    );
};
