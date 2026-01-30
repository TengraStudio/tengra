import {
    Bot,
    Camera,
    ChevronDown,
    Loader2,
    Paperclip,
    Pause,
    Play,
    Square,
    X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ModelSelector as FullModelSelector } from '@/features/models/components/ModelSelector';
import type { GroupedModels } from '@/features/models/utils/model-fetcher';
import { cn } from '@/lib/utils';
import { AppSettings, CodexUsage, QuotaResponse } from '@/types';

/**
 * Extract available models from grouped models structure
 */
const getAvailableModels = (t: (key: string, options?: Record<string, string | number>) => string, groupedModels?: GroupedModels): ModelOption[] => {
    if (!groupedModels) {
        return [];
    }
    const models: ModelOption[] = [];
    Object.values(groupedModels).forEach((providerModels) => {
        if (Array.isArray(providerModels)) {
            providerModels.forEach((m) => {
                models.push({
                    provider: m.provider || '',
                    model: m.id || m.name || '',
                    displayName: m.name ?? m.id ?? t('agent.unknownModel')
                });
            });
        }
    });
    return models;
};

export interface AttachedFile {
    id: string;
    name: string;
    path: string;
    type: 'image' | 'file';
    size: number;
    preview?: string;
}

export interface ModelOption {
    provider: string;
    model: string;
    displayName: string;
}

interface FilePreviewProps {
    files: AttachedFile[];
    onRemove: (id: string) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ files, onRemove }) => {
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (files.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {files.map((file) => (
                <div key={file.id} className="relative group bg-muted/20 border border-border/50 rounded-xl p-2 flex items-center gap-2 pr-8 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                        {file.preview ? (
                            <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                            <Paperclip className="w-4 h-4 text-primary" />
                        )}
                    </div>
                    <div className="min-w-0 max-w-[120px]">
                        <p className="text-[10px] font-bold text-foreground truncate">{file.name}</p>
                        <p className="text-[8px] text-muted-foreground uppercase">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                        onClick={() => onRemove(file.id)}
                        className="absolute right-1 top-1 p-1 hover:bg-destructive/10 rounded-lg text-destructive/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ))}
        </div>
    );
};

interface ModelSelectorProps {
    selectedModel: ModelOption | null;
    showDropdown: boolean;
    onToggle: () => void;
    availableModels: ModelOption[];
    onSelect: (model: ModelOption) => void;
    dropdownRef: React.RefObject<HTMLDivElement>;
    disabled?: boolean;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    selectedModel,
    showDropdown,
    onToggle,
    availableModels,
    onSelect,
    dropdownRef,
    disabled,
    t
}) => (
    <div className="relative" ref={dropdownRef}>
        <button
            onClick={onToggle}
            disabled={disabled}
            className="w-[200px] flex items-center justify-between p-3 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-all text-left disabled:opacity-50"
        >
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-foreground truncate">
                        {selectedModel?.displayName ?? t('agent.selectModel')}
                    </p>
                    <p className="text-[8px] text-muted-foreground uppercase leading-none">
                        {selectedModel?.provider || t('agent.aiProvider')}
                    </p>
                </div>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", showDropdown && "rotate-180")} />
        </button>

        {showDropdown && (
            <div className="absolute bottom-full left-0 w-full mb-2 bg-background/95 border border-border/50 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                <div className="max-h-[240px] overflow-y-auto scrollbar-thin py-2">
                    {availableModels.map((model) => (
                        <button
                            key={`${model.provider}-${model.model}`}
                            onClick={() => onSelect(model)}
                            className={cn(
                                "w-full px-4 py-2.5 text-left hover:bg-primary/10 transition-colors flex items-center justify-between group",
                                selectedModel?.model === model.model && "bg-primary/10"
                            )}
                        >
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                    {model.displayName}
                                </p>
                                <p className="text-[9px] text-muted-foreground uppercase">
                                    {model.provider}
                                </p>
                            </div>
                            {selectedModel?.model === model.model && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        )}
    </div>
);

interface ControlButtonsProps {
    hasTaskId: boolean;
    isRunning: boolean;
    isPaused: boolean;
    onPause: () => void;
    onStop: () => void;
    onSnapshot: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
    hasTaskId,
    isRunning,
    isPaused,
    onPause,
    onStop,
    onSnapshot,
    t
}) => {
    if (!hasTaskId) {
        return null;
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={onPause}
                disabled={!isRunning || isPaused}
                className="flex-1 p-3 bg-muted/20 border border-border/50 rounded-2xl hover:bg-yellow-500/10 hover:border-yellow-500/30 hover:text-yellow-500 transition-all text-muted-foreground disabled:opacity-30 flex items-center justify-center"
                title={t('agent.pause')}
            >
                <Pause className="w-4 h-4" />
            </button>
            <button
                onClick={onStop}
                disabled={!isRunning && !isPaused}
                className="flex-1 p-3 bg-muted/20 border border-border/50 rounded-2xl hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all text-muted-foreground disabled:opacity-30 flex items-center justify-center"
                title={t('agent.stop')}
            >
                <Square className="w-4 h-4 fill-current" />
            </button>
            <button
                onClick={onSnapshot}
                className="flex-1 p-3 bg-muted/20 border border-border/50 rounded-2xl hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all text-muted-foreground disabled:opacity-30 flex items-center justify-center"
                title={t('agent.snapshot')}
            >
                <Camera className="w-4 h-4" />
            </button>
        </div>
    );
};

interface ModelControlSectionProps {
    hasFullModelSelector: boolean;
    groupedModels?: GroupedModels;
    selectedModel: ModelOption | null;
    selectedProvider?: string;
    parentSelectedModel?: string;
    settings?: AppSettings | null;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    showModelDropdown: boolean;
    onToggleDropdown: () => void;
    availableModels: ModelOption[];
    onSelectModelFallback: (m: ModelOption) => void;
    onFullModelSelect: (provider: string, model: string) => void;
    modelDropdownRef: React.RefObject<HTMLDivElement>;
    isRunning: boolean;
    isLoading: boolean;
    hasTaskId: boolean;
    isPaused: boolean;
    onPause: () => void;
    onStop: () => void;
    onSnapshot: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const RemoteModelSelector: React.FC<{
    groupedModels: GroupedModels;
    selectedModel: ModelOption | null;
    selectedProvider?: string;
    parentSelectedModel?: string;
    settings?: AppSettings;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    onSelect: (provider: string, model: string) => void;
}> = ({ groupedModels, selectedModel, selectedProvider, parentSelectedModel, settings, quotas, codexUsage, onSelect }) => (
    <div className="w-[240px]">
        <FullModelSelector
            groupedModels={groupedModels}
            selectedProvider={selectedProvider || selectedModel?.provider || ''}
            selectedModel={parentSelectedModel ?? selectedModel?.model ?? ''}
            onSelect={onSelect}
            settings={settings}
            quotas={quotas ?? null}
            codexUsage={codexUsage ?? null}
            toggleFavorite={() => { }}
            isFavorite={() => false}
        />
    </div>
);

const LocalModelSelectorSection: React.FC<{
    selectedModel: ModelOption | null;
    showModelDropdown: boolean;
    onToggleDropdown: () => void;
    availableModels: ModelOption[];
    onSelectModelFallback: (m: ModelOption) => void;
    modelDropdownRef: React.RefObject<HTMLDivElement>;
    isRunning: boolean;
    isLoading: boolean;
    t: (key: string, options?: Record<string, string | number>) => string;
}> = ({ selectedModel, showModelDropdown, onToggleDropdown, availableModels, onSelectModelFallback, modelDropdownRef, isRunning, isLoading, t }) => (
    <ModelSelector
        selectedModel={selectedModel}
        showDropdown={showModelDropdown}
        onToggle={onToggleDropdown}
        availableModels={availableModels}
        onSelect={onSelectModelFallback}
        dropdownRef={modelDropdownRef}
        disabled={isRunning ?? isLoading}
        t={t}
    />
);

const ModelControlSection: React.FC<ModelControlSectionProps> = ({
    hasFullModelSelector,
    groupedModels,
    selectedModel,
    selectedProvider,
    parentSelectedModel,
    settings,
    quotas,
    codexUsage,
    t,
    ...props
}) => {
    return (
        <div className="flex flex-col gap-2">
            {hasFullModelSelector && groupedModels ? (
                <RemoteModelSelector
                    groupedModels={groupedModels}
                    selectedModel={selectedModel}
                    selectedProvider={selectedProvider}
                    parentSelectedModel={parentSelectedModel}
                    settings={settings ?? undefined}
                    quotas={quotas}
                    codexUsage={codexUsage}
                    onSelect={props.onFullModelSelect}
                />
            ) : (
                <LocalModelSelectorSection
                    selectedModel={selectedModel}
                    showModelDropdown={props.showModelDropdown}
                    onToggleDropdown={props.onToggleDropdown}
                    availableModels={props.availableModels}
                    onSelectModelFallback={props.onSelectModelFallback}
                    modelDropdownRef={props.modelDropdownRef}
                    isRunning={props.isRunning}
                    isLoading={props.isLoading}
                    t={t}
                />
            )}
            <ControlButtons
                hasTaskId={props.hasTaskId}
                isRunning={props.isRunning}
                isPaused={props.isPaused}
                onPause={props.onPause}
                onStop={props.onStop}
                onSnapshot={props.onSnapshot}
                t={t}
            />
        </div>
    );
};

interface ActionButtonProps {
    isLoading: boolean;
    isPaused: boolean;
    isFailed: boolean;
    isStuck: boolean;
    value: string;
    selectedModel: ModelOption | null;
    onStart: () => void;
    onResume: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const LoadingButton: React.FC<{ t: (key: string, options?: Record<string, string | number>) => string }> = ({ t }) => (
    <button disabled className="px-4 py-2 bg-muted text-muted-foreground rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {t('agent.start')}
    </button>
);

const ActionButton: React.FC<ActionButtonProps> = ({
    isLoading,
    isPaused,
    isFailed,
    isStuck,
    value,
    selectedModel,
    onStart,
    onResume,
    t
}) => {
    if (isLoading) {
        return <LoadingButton t={t} />;
    }

    if (isStuck ?? isPaused) {
        return (
            <button
                onClick={onResume}
                className={cn(
                    "px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-[0.98] flex items-center gap-2 text-white",
                    isStuck ? "bg-orange-500 shadow-orange-500/20 hover:bg-orange-600" : "bg-yellow-500 shadow-yellow-500/20 hover:bg-yellow-600"
                )}
            >
                <Play className="w-3.5 h-3.5 fill-current" />
                {t('agent.resume')}
            </button>
        );
    }

    if (isFailed) {
        return (
            <button
                onClick={onResume}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-xl font-black text-xs uppercase tracking-widest hover:bg-destructive/90 transition-all shadow-xl shadow-destructive/20 active:scale-[0.98] flex items-center gap-2"
            >
                <Play className="w-3.5 h-3.5 fill-current" />
                {t('agent.retry')}
            </button>
        );
    }

    return (
        <button
            onClick={() => {
                window.electron.log.info('[TaskInputForm] ActionButton CLICKED', {
                    hasValue: !!value.trim(),
                    hasSelectedModel: !!selectedModel,
                    model: selectedModel?.model
                });
                onStart();
            }}
            disabled={!value.trim() || !selectedModel}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
        >
            <Play className="w-3.5 h-3.5 fill-current" />
            {t('agent.start')}
        </button>
    );
};

interface PromptTextAreaProps {
    value: string;
    onChange: (val: string) => void;
    onStart: () => void;
    isLoading: boolean;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const PromptTextArea: React.FC<PromptTextAreaProps> = ({
    value,
    onChange,
    onStart,
    isLoading,
    t
}) => (
    <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                e.preventDefault();
                onStart();
            }
        }}
        placeholder={t('agent.promptPlaceholder')}
        className="w-full bg-muted/20 border border-border/50 rounded-2xl p-4 pr-32 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all min-h-[100px] resize-none scrollbar-thin placeholder:text-muted-foreground/50"
        disabled={isLoading}
    />
);

interface PromptInputProps {
    value: string;
    onChange: (val: string) => void;
    onStart: () => void;
    onFileSelect: () => void;
    isLoading: boolean;
    isPaused: boolean;
    isFailed: boolean;
    isStuck: boolean;
    selectedModel: ModelOption | null;
    onResume: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

const PromptInput: React.FC<PromptInputProps> = ({
    value,
    onChange,
    onStart,
    onFileSelect,
    isLoading,
    isPaused,
    isFailed,
    isStuck,
    selectedModel,
    onResume,
    t
}) => (
    <div className="flex-1 relative group">
        <PromptTextArea
            value={value}
            onChange={onChange}
            onStart={onStart}
            isLoading={isLoading}
            t={t}
        />

        <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <button
                onClick={onFileSelect}
                disabled={isLoading}
                className="p-2 hover:bg-muted/30 rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200 disabled:opacity-50"
                title={t('agent.attachFiles')}
            >
                <Paperclip className="w-4 h-4" />
            </button>

            <ActionButton
                isLoading={isLoading}
                isPaused={isPaused}
                isFailed={isFailed}
                isStuck={isStuck}
                value={value}
                selectedModel={selectedModel}
                onStart={onStart}
                onResume={onResume}
                t={t}
            />
        </div>
    </div>
);

export interface TaskInputFormProps {
    userPrompt: string;
    setUserPrompt: (val: string) => void;
    isLoading: boolean;
    attachedFiles: AttachedFile[];
    removeFile: (id: string) => void;
    onStartTask: () => void;
    onPauseTask: () => void;
    onResumeTask: () => void;
    onStopTask: () => void;
    onSaveSnapshot: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    selectedModel: ModelOption | null;
    setSelectedModel: (model: ModelOption) => void;
    modelDropdownRef: React.RefObject<HTMLDivElement>;
    agentState: string;
    taskId: string | null;
    t: (key: string, options?: Record<string, string | number>) => string;
    // Full ModelSelector props
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    settings?: AppSettings | null;
    selectedProvider?: string;
    parentSelectedModel?: string;
    onSelectModel?: (provider: string, model: string) => void;
}

const TaskInputLayout: React.FC<{
    userPrompt: string;
    setUserPrompt: (val: string) => void;
    onStartTask: () => void;
    onFileSelectClick: () => void;
    isLoading: boolean;
    isPaused: boolean;
    isFailed: boolean;
    isStuck: boolean;
    selectedModel: ModelOption | null;
    onResumeTask: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    modelControlProps: ModelControlSectionProps;
}> = ({
    userPrompt,
    setUserPrompt,
    onStartTask,
    onFileSelectClick,
    isLoading,
    isPaused,
    isFailed,
    isStuck,
    selectedModel,
    onResumeTask,
    t,
    modelControlProps
}) => (
        <div className="bg-card/50 border-t border-border p-4 backdrop-blur-md">
            <div className="max-w-5xl mx-auto space-y-4">
                <div className="flex gap-4 items-start">
                    <PromptInput
                        value={userPrompt}
                        onChange={setUserPrompt}
                        onStart={onStartTask}
                        onFileSelect={onFileSelectClick}
                        isLoading={isLoading}
                        isPaused={isPaused}
                        isFailed={isFailed}
                        isStuck={isStuck}
                        selectedModel={selectedModel}
                        onResume={onResumeTask}
                        t={t}
                    />
                    <ModelControlSection {...modelControlProps} />
                </div>
            </div>
        </div>
    );

export const TaskInputForm: React.FC<TaskInputFormProps> = ({
    userPrompt,
    setUserPrompt,
    isLoading,
    attachedFiles,
    removeFile,
    onStartTask,
    onPauseTask,
    onResumeTask,
    onStopTask,
    onSaveSnapshot,
    onFileSelect,
    fileInputRef,
    selectedModel,
    setSelectedModel,
    modelDropdownRef,
    agentState,
    taskId,
    t,
    groupedModels,
    quotas,
    codexUsage,
    settings,
    selectedProvider,
    parentSelectedModel,
    onSelectModel
}) => {
    const isStuck = agentState === 'waiting_llm' || agentState === 'waiting_tool';
    const isStopped = agentState === 'stopped';
    const isPaused = agentState === 'paused';
    const isFailed = agentState === 'failed' || isStopped;
    const isRunning = taskId ? (
        agentState !== 'idle' &&
        agentState !== 'completed' &&
        agentState !== 'failed' &&
        agentState !== 'paused' &&
        agentState !== 'stopped' &&
        !isStuck
    ) : false;
    const hasTaskId = !!taskId;

    const [showModelDropdown, setShowModelDropdown] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        if (showModelDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => { document.removeEventListener('mousedown', handleClickOutside); };
        }
        return undefined;
    }, [showModelDropdown, modelDropdownRef]);

    const handleFullModelSelect = useCallback((provider: string, model: string) => {
        setSelectedModel({ provider, model, displayName: model });
        if (onSelectModel) {
            onSelectModel(provider, model);
        }
    }, [setSelectedModel, onSelectModel]);

    const availableModels = useMemo(() => getAvailableModels(t, groupedModels), [groupedModels, t]);
    const hasFullModelSelector = !!(groupedModels && settings);

    const modelControlProps: ModelControlSectionProps = {
        hasFullModelSelector,
        groupedModels,
        selectedModel,
        selectedProvider,
        parentSelectedModel,
        settings,
        quotas,
        codexUsage,
        showModelDropdown,
        onToggleDropdown: () => setShowModelDropdown(!showModelDropdown),
        availableModels,
        onSelectModelFallback: (m: ModelOption) => {
            setSelectedModel(m);
            setShowModelDropdown(false);
        },
        onFullModelSelect: handleFullModelSelect,
        modelDropdownRef,
        isRunning,
        isLoading,
        hasTaskId,
        isPaused,
        onPause: onPauseTask,
        onStop: onStopTask,
        onSnapshot: onSaveSnapshot,
        t
    };

    return (
        <div className="flex flex-col gap-4 w-full">
            <FilePreview files={attachedFiles} onRemove={removeFile} />
            <TaskInputLayout
                userPrompt={userPrompt}
                setUserPrompt={setUserPrompt}
                onStartTask={onStartTask}
                onFileSelectClick={() => fileInputRef.current?.click()}
                isLoading={isLoading}
                isPaused={isPaused}
                isFailed={isFailed}
                isStuck={isStuck}
                selectedModel={selectedModel}
                onResumeTask={onResumeTask}
                t={t}
                modelControlProps={modelControlProps}
            />
            <input type="file" ref={fileInputRef} onChange={onFileSelect} className="hidden" multiple />
        </div>
    );
};
