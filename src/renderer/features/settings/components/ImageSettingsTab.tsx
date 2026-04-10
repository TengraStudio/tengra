import { Button } from '@renderer/components/ui/button';
import { cn } from '@renderer/lib/utils';
import { Image, Layers, RefreshCw } from 'lucide-react';
import React from 'react';

import { GalleryView } from '@/components/shared/GalleryView';

import { useImageSettingsHandlers } from '../hooks/useImageSettingsHandlers';
import type { SettingsSharedProps } from '../types';

import { ImageSettingsEdit } from './image-settings/ImageSettingsEdit';
import { ImageSettingsHistory } from './image-settings/ImageSettingsHistory';
import { ImageSettingsPresets } from './image-settings/ImageSettingsPresets';
import { ImageSettingsProvider } from './image-settings/ImageSettingsProvider';
import { ImageSettingsRuntime } from './image-settings/ImageSettingsRuntime';
import { ImageSettingsSchedules } from './image-settings/ImageSettingsSchedules';
import { ImageSettingsWorkflow } from './image-settings/ImageSettingsWorkflow';

/**

/**
 * ImageSettingsTab component for managing image generation settings.
 * Allows selecting providers and managing local runtime (SD-CPP).
 */
export const ImageSettingsTab: React.FC<SettingsSharedProps> = ({ settings, handleSave, t }) => {
    const h = useImageSettingsHandlers({ settings, handleSave, t });
    const language = settings?.general.language ?? 'en';

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-20">
            {/* Page Header */}
            <div className="relative group px-1">
                <div className="flex items-center gap-4 mb-3">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-2xl shadow-primary/10 group-hover:scale-110 transition-transform duration-700 ring-1 ring-primary/20">
                        <Image className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-foreground leading-none">
                            {t('settings.images.title')}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-1 w-8 bg-primary rounded-full group-hover:w-12 transition-all duration-700" />
                            <p className="typo-body font-bold text-muted-foreground opacity-50">
                                Visual Studio Engine
                            </p>
                        </div>
                    </div>
                </div>
                <p className="typo-caption text-muted-foreground/60 leading-relaxed max-w-2xl font-medium px-1">
                    {t('settings.images.description')}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
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
            </div>

            <div className="space-y-6 pt-12 border-t border-border/20 group/gallery">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/5 group-hover/gallery:scale-110 transition-transform duration-500">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">
                                {t('settings.images.libraryTitle')}
                            </h3>
                            <p className="typo-body text-muted-foreground mt-1 font-bold opacity-40">
                                Global Generation Cloud
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-border/20 bg-muted/20 overflow-hidden shadow-sm group-hover/gallery:border-border/40 transition-all duration-500">
                    <div className="h-[60vh] min-h-[500px]">
                        <GalleryView language={language} />
                    </div>
                </div>
            </div>

            <div className="space-y-8 pt-12 border-t border-border/20">
                <div className="flex flex-wrap items-center justify-between gap-6 px-1">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <h4 className="text-xxs font-bold text-muted-foreground">
                            {t('settings.images.operationsTitle')}
                        </h4>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { void h.refreshImageData(); }}
                        className="h-10 px-6 rounded-xl border-border/40 bg-muted/20 typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-95 flex items-center gap-3 shadow-sm"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', h.isDataRefreshing && 'animate-spin')} />
                        {t('settings.images.refreshData')}
                    </Button>
                </div>

                {h.actionMessage && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 typo-caption font-bold text-primary animate-in slide-in-from-top-2 duration-500">
                        {h.actionMessage}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                    <ImageSettingsHistory
                        historyEntries={h.historyEntries}
                        historySearchQuery={h.historySearchQuery}
                        setHistorySearchQuery={h.setHistorySearchQuery}
                        imageAnalytics={h.imageAnalytics}
                        selectedCompareIds={h.selectedCompareIds}
                        toggleCompareSelection={h.toggleCompareSelection}
                        handleRegenerate={h.handleRegenerate}
                        handleExportHistory={h.handleExportHistory}
                        handleRunComparison={h.handleRunComparison}
                        handleExportComparison={h.handleExportComparison}
                        handleShareComparison={h.handleShareComparison}
                        comparisonShareCode={h.comparisonShareCode}
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
                        presetShareCode={h.presetShareCode}
                        setPresetShareCode={h.setPresetShareCode}
                        handleSavePreset={h.handleSavePreset}
                        handleDeletePreset={h.handleDeletePreset}
                        handleExportPresetShare={h.handleExportPresetShare}
                        handleImportPresetShare={h.handleImportPresetShare}
                        t={t}
                    />

                    <ImageSettingsSchedules
                        schedulePrompt={h.schedulePrompt}
                        setSchedulePrompt={h.setSchedulePrompt}
                        scheduleAt={h.scheduleAt}
                        setScheduleAt={h.setScheduleAt}
                        schedulePriority={h.schedulePriority}
                        setSchedulePriority={h.setSchedulePriority}
                        scheduleResourceProfile={h.scheduleResourceProfile}
                        setScheduleResourceProfile={h.setScheduleResourceProfile}
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
                        editStrength={h.editStrength}
                        setEditStrength={h.setEditStrength}
                        editPresetId={h.editPresetId}
                        handleApplyEditPreset={h.handleApplyEditPreset}
                        handleRunEdit={h.handleRunEdit}
                        t={t}
                    />

                    <div className="xl:col-span-2">
                        <ImageSettingsWorkflow
                            workflowTemplates={h.workflowTemplates}
                            workflowTemplateName={h.workflowTemplateName}
                            setWorkflowTemplateName={h.setWorkflowTemplateName}
                            workflowTemplateJson={h.workflowTemplateJson}
                            setWorkflowTemplateJson={h.setWorkflowTemplateJson}
                            workflowShareCode={h.workflowShareCode}
                            setWorkflowShareCode={h.setWorkflowShareCode}
                            handleSaveWorkflowTemplate={h.handleSaveWorkflowTemplate}
                            handleDeleteWorkflowTemplate={h.handleDeleteWorkflowTemplate}
                            handleExportWorkflowTemplateShare={h.handleExportWorkflowTemplateShare}
                            handleImportWorkflowTemplateShare={h.handleImportWorkflowTemplateShare}
                            t={t}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
