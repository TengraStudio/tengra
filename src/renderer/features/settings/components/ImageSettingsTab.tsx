import { Image, Layers, RefreshCw } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import { useImageSettingsHandlers } from '../hooks/useImageSettingsHandlers';
import { SettingsSharedProps } from '../types';

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
    const h = useImageSettingsHandlers({ settings, handleSave, t });

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
                currentProvider={h.currentProvider}
                handleProviderChange={h.handleProviderChange}
                t={t}
            />

            <ImageSettingsRuntime
                sdCppStatus={h.sdCppStatus}
                isReinstalling={h.isReinstalling}
                setIsReinstalling={h.setIsReinstalling}
                downloadProgress={h.downloadProgress}
                setDownloadProgress={h.setDownloadProgress}
                checkStatus={h.checkStatus}
                t={t}
            />

            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-xxs font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        {t('settings.images.operationsTitle')}
                    </h4>
                    <button
                        onClick={() => { void h.refreshImageData(); }}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', h.isDataRefreshing && 'animate-spin')} />
                        {t('settings.images.refreshData')}
                    </button>
                </div>

                {h.actionMessage && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                        {h.actionMessage}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <ImageSettingsHistory
                        historyEntries={h.historyEntries}
                        selectedCompareIds={h.selectedCompareIds}
                        toggleCompareSelection={h.toggleCompareSelection}
                        handleRegenerate={h.handleRegenerate}
                        handleRunComparison={h.handleRunComparison}
                        setSelectedCompareIds={h.setSelectedCompareIds}
                        comparisonResult={h.comparisonResult}
                        t={t}
                    />

                    <ImageSettingsPresets
                        presetEntries={h.presetEntries}
                        presetName={h.presetName}
                        setPresetName={h.setPresetName}
                        presetPromptPrefix={h.presetPromptPrefix}
                        setPresetPromptPrefix={h.setPresetPromptPrefix}
                        handleSavePreset={h.handleSavePreset}
                        handleDeletePreset={h.handleDeletePreset}
                        t={t}
                    />

                    <ImageSettingsSchedules
                        schedulePrompt={h.schedulePrompt}
                        setSchedulePrompt={h.setSchedulePrompt}
                        scheduleAt={h.scheduleAt}
                        setScheduleAt={h.setScheduleAt}
                        handleCreateSchedule={h.handleCreateSchedule}
                        queueStats={h.queueStats}
                        scheduleEntries={h.scheduleEntries}
                        handleCancelSchedule={h.handleCancelSchedule}
                        t={t}
                    />

                    <ImageSettingsEdit
                        batchPrompts={h.batchPrompts}
                        setBatchPrompts={h.setBatchPrompts}
                        handleRunBatch={h.handleRunBatch}
                        editSource={h.editSource}
                        setEditSource={h.setEditSource}
                        editPrompt={h.editPrompt}
                        setEditPrompt={h.setEditPrompt}
                        editMode={h.editMode}
                        setEditMode={h.setEditMode}
                        handleRunEdit={h.handleRunEdit}
                        t={t}
                    />
                </div>
            </div>
        </div>
    );
};
