import { AppSettings } from '@shared/types/settings';
import { useCallback, useEffect, useState } from 'react';

import {
    ImageComparisonResult,
    ImageHistoryEntry,
    ImagePresetEntry,
    ImageProvider,
    ImageScheduleEntry,
    ImageWorkflowTemplateEntry,
} from '../types';

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
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [presetEntries, setPresetEntries] = useState<ImagePresetEntry[]>([]);
    const [imageAnalytics, setImageAnalytics] = useState<{
        totalGenerated: number;
        byProvider: Record<string, number>;
        averageSteps: number;
        bySource?: Record<string, number>;
        averageDurationMs?: number;
    }>({ totalGenerated: 0, byProvider: {}, averageSteps: 0 });
    const [scheduleEntries, setScheduleEntries] = useState<ImageScheduleEntry[]>([]);
    const [schedulePriority, setSchedulePriority] = useState<'low' | 'normal' | 'high'>('normal');
    const [scheduleResourceProfile, setScheduleResourceProfile] = useState<'balanced' | 'quality' | 'speed'>('balanced');
    const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
    const [comparisonResult, setComparisonResult] = useState<ImageComparisonResult | null>(null);
    const [comparisonShareCode, setComparisonShareCode] = useState('');
    const [queueStats, setQueueStats] = useState<{ queued: number; running: boolean; byPriority?: Record<string, number> }>({ queued: 0, running: false });
    const [isDataRefreshing, setIsDataRefreshing] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [presetName, setPresetName] = useState('');
    const [presetPromptPrefix, setPresetPromptPrefix] = useState('');
    const [presetShareCode, setPresetShareCode] = useState('');
    const [schedulePrompt, setSchedulePrompt] = useState('');
    const [scheduleAt, setScheduleAt] = useState('');
    const [batchPrompts, setBatchPrompts] = useState('');
    const [editSource, setEditSource] = useState('');
    const [editPrompt, setEditPrompt] = useState('');
    const [editMode, setEditMode] = useState<'img2img' | 'inpaint' | 'outpaint' | 'style-transfer'>('img2img');
    const [editStrength, setEditStrength] = useState(0.55);
    const [editPresetId, setEditPresetId] = useState<'balanced' | 'detail' | 'stylize'>('balanced');
    const [workflowTemplates, setWorkflowTemplates] = useState<ImageWorkflowTemplateEntry[]>([]);
    const [workflowTemplateName, setWorkflowTemplateName] = useState('');
    const [workflowTemplateJson, setWorkflowTemplateJson] = useState('');
    const [workflowShareCode, setWorkflowShareCode] = useState('');

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
            const historyPromise = historySearchQuery.trim().length > 0
                ? window.electron.ipcRenderer.invoke('sd-cpp:searchHistory', historySearchQuery.trim(), 24)
                : window.electron.sdCpp.getHistory(24);
            const [history, presets, schedulesRaw, stats, analytics, templatesRaw] = await Promise.all([
                historyPromise,
                window.electron.sdCpp.listPresets(),
                window.electron.sdCpp.listSchedules(),
                window.electron.sdCpp.getQueueStats(),
                window.electron.sdCpp.getAnalytics(),
                window.electron.ipcRenderer.invoke('sd-cpp:listWorkflowTemplates'),
            ]);
            setHistoryEntries(Array.isArray(history) ? (history as ImageHistoryEntry[]) : []);
            setPresetEntries(presets);
            setScheduleEntries(Array.isArray(schedulesRaw) ? (schedulesRaw as ImageScheduleEntry[]) : []);
            setQueueStats(stats);
            setImageAnalytics(analytics);
            setWorkflowTemplates(Array.isArray(templatesRaw) ? (templatesRaw as ImageWorkflowTemplateEntry[]) : []);
        } catch (error) {
            window.electron.log.error('Failed to refresh image data:', error);
        } finally {
            setIsDataRefreshing(false);
        }
    }, [historySearchQuery]);

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

    const handleExportPresetShare = useCallback(async (id: string) => {
        try {
            const code = await window.electron.ipcRenderer.invoke('sd-cpp:exportPresetShare', id);
            setPresetShareCode(String(code));
            await window.electron.clipboard.writeText(String(code));
            setActionMessage(t('common.copied'));
        } catch (error) {
            window.electron.log.error('Failed to export preset share code:', error);
            setActionMessage(t('common.error'));
        }
    }, [t]);

    const handleImportPresetShare = useCallback(async () => {
        const code = presetShareCode.trim();
        if (!code) {
            setActionMessage(t('common.invalidInput'));
            return;
        }
        try {
            await window.electron.ipcRenderer.invoke('sd-cpp:importPresetShare', code);
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to import preset share code:', error);
            setActionMessage(t('common.error'));
        }
    }, [presetShareCode, refreshImageData, t]);

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
                priority: schedulePriority,
                resourceProfile: scheduleResourceProfile,
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
    }, [schedulePrompt, scheduleAt, schedulePriority, scheduleResourceProfile, refreshImageData, t]);

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

    const handleExportComparison = useCallback(async () => {
        if (selectedCompareIds.length < 2) {
            setActionMessage(t('settings.images.compareSelectionHint'));
            return;
        }
        try {
            const csv = await window.electron.ipcRenderer.invoke('sd-cpp:exportComparison', {
                ids: selectedCompareIds,
                format: 'csv'
            });
            await window.electron.clipboard.writeText(csv as string);
            setActionMessage(t('common.copied'));
        } catch (error) {
            window.electron.log.error('Failed to export comparison:', error);
            setActionMessage(t('common.error'));
        }
    }, [selectedCompareIds, t]);

    const handleShareComparison = useCallback(async () => {
        if (selectedCompareIds.length < 2) {
            setActionMessage(t('settings.images.compareSelectionHint'));
            return;
        }
        try {
            const code = await window.electron.ipcRenderer.invoke('sd-cpp:shareComparison', selectedCompareIds);
            setComparisonShareCode(String(code));
            await window.electron.clipboard.writeText(String(code));
            setActionMessage(t('common.copied'));
        } catch (error) {
            window.electron.log.error('Failed to share comparison:', error);
            setActionMessage(t('common.error'));
        }
    }, [selectedCompareIds, t]);

    const handleExportHistory = useCallback(async () => {
        try {
            const report = await window.electron.ipcRenderer.invoke('sd-cpp:exportHistory', 'json');
            await window.electron.clipboard.writeText(String(report));
            setActionMessage(t('common.copied'));
        } catch (error) {
            window.electron.log.error('Failed to export history:', error);
            setActionMessage(t('common.error'));
        }
    }, [t]);

    const handleSaveWorkflowTemplate = useCallback(async () => {
        const trimmedName = workflowTemplateName.trim();
        const trimmedJson = workflowTemplateJson.trim();
        if (!trimmedName || !trimmedJson) {
            setActionMessage(t('common.invalidInput'));
            return;
        }
        try {
            const parsed = JSON.parse(trimmedJson) as Record<string, unknown>;
            await window.electron.ipcRenderer.invoke('sd-cpp:saveWorkflowTemplate', {
                name: trimmedName,
                workflow: parsed
            });
            setWorkflowTemplateName('');
            setWorkflowTemplateJson('');
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to save workflow template:', error);
            setActionMessage(t('common.error'));
        }
    }, [workflowTemplateName, workflowTemplateJson, refreshImageData, t]);

    const handleDeleteWorkflowTemplate = useCallback(async (id: string) => {
        try {
            await window.electron.ipcRenderer.invoke('sd-cpp:deleteWorkflowTemplate', id);
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to delete workflow template:', error);
            setActionMessage(t('common.error'));
        }
    }, [refreshImageData, t]);

    const handleExportWorkflowTemplateShare = useCallback(async (id: string) => {
        try {
            const code = await window.electron.ipcRenderer.invoke('sd-cpp:exportWorkflowTemplateShare', id);
            setWorkflowShareCode(String(code));
            await window.electron.clipboard.writeText(String(code));
            setActionMessage(t('common.copied'));
        } catch (error) {
            window.electron.log.error('Failed to export workflow template share:', error);
            setActionMessage(t('common.error'));
        }
    }, [t]);

    const handleImportWorkflowTemplateShare = useCallback(async () => {
        const code = workflowShareCode.trim();
        if (!code) {
            setActionMessage(t('common.invalidInput'));
            return;
        }
        try {
            await window.electron.ipcRenderer.invoke('sd-cpp:importWorkflowTemplateShare', code);
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to import workflow template share:', error);
            setActionMessage(t('common.error'));
        }
    }, [workflowShareCode, refreshImageData, t]);

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
                strength: editStrength,
                width: 1024,
                height: 1024,
            });
            setActionMessage(t('common.success'));
            await refreshImageData();
        } catch (error) {
            window.electron.log.error('Failed to edit image:', error);
            setActionMessage(t('common.error'));
        }
    }, [editSource, editPrompt, editMode, editStrength, refreshImageData, t]);

    const handleApplyEditPreset = useCallback((presetId: 'balanced' | 'detail' | 'stylize') => {
        setEditPresetId(presetId);
        if (presetId === 'detail') {
            setEditMode('inpaint');
            setEditStrength(0.35);
            return;
        }
        if (presetId === 'stylize') {
            setEditMode('style-transfer');
            setEditStrength(0.72);
            return;
        }
        setEditMode('img2img');
        setEditStrength(0.55);
    }, []);

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
        historySearchQuery,
        setHistorySearchQuery,
        presetEntries,
        imageAnalytics,
        scheduleEntries,
        schedulePriority,
        setSchedulePriority,
        scheduleResourceProfile,
        setScheduleResourceProfile,
        selectedCompareIds,
        setSelectedCompareIds: handleSetSelectedCompareIds,
        comparisonResult,
        comparisonShareCode,
        queueStats,
        isDataRefreshing,
        actionMessage,
        presetName,
        setPresetName,
        presetPromptPrefix,
        setPresetPromptPrefix,
        presetShareCode,
        setPresetShareCode,
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
        editStrength,
        setEditStrength,
        editPresetId,
        setEditPresetId,
        workflowTemplates,
        workflowTemplateName,
        setWorkflowTemplateName,
        workflowTemplateJson,
        setWorkflowTemplateJson,
        workflowShareCode,
        setWorkflowShareCode,
        checkStatus,
        refreshImageData,
        handleProviderChange,
        toggleCompareSelection,
        handleRegenerate,
        handleExportHistory,
        handleSavePreset,
        handleDeletePreset,
        handleExportPresetShare,
        handleImportPresetShare,
        handleCreateSchedule,
        handleCancelSchedule,
        handleRunComparison,
        handleExportComparison,
        handleShareComparison,
        handleRunBatch,
        handleRunEdit,
        handleApplyEditPreset,
        handleSaveWorkflowTemplate,
        handleDeleteWorkflowTemplate,
        handleExportWorkflowTemplateShare,
        handleImportWorkflowTemplateShare,
    };
}
