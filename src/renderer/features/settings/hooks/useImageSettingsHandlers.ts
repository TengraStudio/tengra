import { useCallback, useEffect, useState } from 'react';

import {
    ImageComparisonResult,
    ImageHistoryEntry,
    ImagePresetEntry,
    ImageProvider,
    ImageScheduleEntry,
} from '../types';
import { AppSettings } from '@shared/types/settings';

/**
 * Props required by the image settings handlers hook.
 */
interface UseImageSettingsHandlersProps {
    settings: AppSettings | null;
    handleSave: (ns?: AppSettings) => Promise<void>;
    t: (key: string) => string;
}

/**
 * Manages all image settings handler callbacks, data state, and form fields.
 * Extracted from ImageSettingsTab to keep the component under the NASA 60-line limit.
 */
export function useImageSettingsHandlers({ settings, handleSave, t }: UseImageSettingsHandlersProps) {
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

    const currentProvider = (settings?.images?.provider || 'antigravity') as ImageProvider;

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

    /** Subscribe to SD-CPP status and progress events on mount. */
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

    const handleProviderChange = useCallback(
        (provider: string) => {
            if (!settings) {
                return;
            }
            const updated = {
                ...settings,
                images: {
                    ...(settings.images || { provider: 'antigravity' }),
                    provider: provider as ImageProvider,
                },
            };
            void handleSave(updated);
        },
        [settings, handleSave]
    );

    const toggleCompareSelection = useCallback((id: string) => {
        setSelectedCompareIds(previous => {
            if (previous.includes(id)) {
                return previous.filter(item => item !== id);
            }
            if (previous.length >= 4) {
                return previous;
            }
            return [...previous, id];
        });
    }, []);

    const handleRegenerate = useCallback(
        async (id: string) => {
            try {
                await window.electron.sdCpp.regenerate(id);
                setActionMessage(t('common.success'));
                await refreshImageData();
            } catch (error) {
                window.electron.log.error('Failed to regenerate image:', error);
                setActionMessage(t('common.error'));
            }
        },
        [refreshImageData, t]
    );

    const handleSavePreset = useCallback(async () => {
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
    }, [presetName, presetPromptPrefix, currentProvider, refreshImageData, t]);

    const handleDeletePreset = useCallback(
        async (id: string) => {
            try {
                await window.electron.sdCpp.deletePreset(id);
                setActionMessage(t('common.success'));
                await refreshImageData();
            } catch (error) {
                window.electron.log.error('Failed to delete image preset:', error);
                setActionMessage(t('common.error'));
            }
        },
        [refreshImageData, t]
    );

    const handleCreateSchedule = useCallback(async () => {
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
    }, [schedulePrompt, scheduleAt, refreshImageData, t]);

    const handleCancelSchedule = useCallback(
        async (id: string) => {
            try {
                await window.electron.sdCpp.cancelSchedule(id);
                setActionMessage(t('common.success'));
                await refreshImageData();
            } catch (error) {
                window.electron.log.error('Failed to cancel image schedule:', error);
                setActionMessage(t('common.error'));
            }
        },
        [refreshImageData, t]
    );

    const handleRunComparison = useCallback(async () => {
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
    }, [selectedCompareIds, t]);

    const handleRunBatch = useCallback(async () => {
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
    }, [batchPrompts, refreshImageData, t]);

    const handleRunEdit = useCallback(async () => {
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
    }, [editSource, editPrompt, editMode, refreshImageData, t]);

    const handleSetSelectedCompareIds = useCallback((ids: string[]) => {
        setSelectedCompareIds(ids);
    }, []);

    return {
        currentProvider,
        sdCppStatus,
        isReinstalling,
        setIsReinstalling,
        downloadProgress,
        setDownloadProgress,
        historyEntries,
        presetEntries,
        scheduleEntries,
        selectedCompareIds,
        setSelectedCompareIds: handleSetSelectedCompareIds,
        comparisonResult,
        queueStats,
        isDataRefreshing,
        actionMessage,
        presetName,
        setPresetName,
        presetPromptPrefix,
        setPresetPromptPrefix,
        schedulePrompt,
        setSchedulePrompt,
        scheduleAt,
        setScheduleAt,
        batchPrompts,
        setBatchPrompts,
        editSource,
        setEditSource,
        editPrompt,
        setEditPrompt,
        editMode,
        setEditMode,
        checkStatus,
        refreshImageData,
        handleProviderChange,
        toggleCompareSelection,
        handleRegenerate,
        handleSavePreset,
        handleDeletePreset,
        handleCreateSchedule,
        handleCancelSchedule,
        handleRunComparison,
        handleRunBatch,
        handleRunEdit,
    };
}
