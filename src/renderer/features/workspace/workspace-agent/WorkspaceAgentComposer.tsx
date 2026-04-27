/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    CouncilRunConfig,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import { IconCheck, IconMap, IconSend, IconSquare } from '@tabler/icons-react';
import React from 'react';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AppSettings, CodexUsage, GroupedModels, QuotaResponse } from '@/types';

import { WorkspaceAgentCouncilSetup } from './WorkspaceAgentCouncilSetup';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEAGENTCOMPOSER_1 = "min-h-44 h-11 flex-1 rounded-2xl border-border/30 bg-background/40 px-4 py-2.5 placeholder:text-muted-foreground/40 text-sm focus:border-border/20 transition-colors resize-none overflow-hidden";
const C_WORKSPACEAGENTCOMPOSER_2 = "h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border-border/10 bg-background/30 hover:bg-background/40 transition-colors p-0";
const C_WORKSPACEAGENTCOMPOSER_3 = "relative w-280 rounded-2xl border border-border/40 bg-background/95 p-1.5 shadow-none animate-in fade-in zoom-in-95 duration-200";


export type WorkspaceAgentComposerPreset = 'default-agent' | 'plan' | 'agent';

interface WorkspaceAgentComposerProps {
    currentSession: WorkspaceAgentSessionSummary | null;
    currentModes: WorkspaceAgentSessionModes;
    currentPermissionPolicy: WorkspaceAgentPermissionPolicy;
    composerValue: string;
    setComposerValue: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
    onToggleCouncil: () => void;
    onSelectPreset: (preset: WorkspaceAgentComposerPreset) => void;
    showCouncilSetup: boolean;
    councilSetup: CouncilRunConfig;
    setCouncilSetup: React.Dispatch<React.SetStateAction<CouncilRunConfig>>;
    onApplyCouncilSetup: () => void;
    onUpdatePermissionPolicy: (permissionPolicy: WorkspaceAgentPermissionPolicy) => Promise<void>;
    isLoading: boolean;
    selectedProvider: string;
    selectedModel: string;
    groupedModels: GroupedModels | null | undefined;
    setSelectedProvider: (provider: string) => void;
    setSelectedModel: (model: string) => void;
    persistLastSelection: (provider: string, model: string) => void;
    settings?: AppSettings;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    t: (key: string) => string;
}

interface ComposerPresetOption {
    description: string;
    title: string;
    value: WorkspaceAgentComposerPreset;
}

function getPresetValue(modes: WorkspaceAgentSessionModes): WorkspaceAgentComposerPreset {
    if (modes.plan) {
        return 'plan';
    }
    if (modes.agent) {
        return 'agent';
    }
    return 'default-agent';
}

function buildPresetOptions(t: (key: string) => string): ComposerPresetOption[] {
    return [
        {
            value: 'default-agent',
            title: t('workspaceAgent.defaultAgent'),
            description: t('workspaceAgent.defaultAgentDesc'),
        },
        {
            value: 'plan',
            title: t('workspaceAgent.planAction'),
            description: t('workspaceAgent.planning'),
        },
        {
            value: 'agent',
            title: t('workspaceAgent.executeAction'),
            description: t('workspaceAgent.executingTask'),
        },
    ];
}

export const WorkspaceAgentComposer: React.FC<WorkspaceAgentComposerProps> = ({
    currentSession,
    currentModes,
    currentPermissionPolicy,
    composerValue,
    setComposerValue,
    onSend,
    onStop,
    onToggleCouncil,
    onSelectPreset,
    showCouncilSetup,
    councilSetup,
    setCouncilSetup,
    onApplyCouncilSetup,
    onUpdatePermissionPolicy,
    isLoading,
    selectedProvider,
    selectedModel,
    groupedModels,
    setSelectedProvider,
    setSelectedModel,
    persistLastSelection,
    settings,
    quotas,
    codexUsage,
    t,
}) => {
    const handleEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (isLoading) {
                void Promise.resolve(onStop());
                return;
            }
            void Promise.resolve(onSend());
        }
    };

    const permissionPolicy = currentSession?.permissionPolicy ?? currentPermissionPolicy;
    const presetOptions = React.useMemo(() => buildPresetOptions(t), [t]);

    const selectedPreset = React.useMemo(
        () =>
            presetOptions.find(option => option.value === getPresetValue(currentModes)) ??
            presetOptions[0],
        [currentModes, presetOptions]
    );

    const handlePermissionUpdate = React.useCallback(
        (nextPermissionPolicy: WorkspaceAgentPermissionPolicy) => {
            void onUpdatePermissionPolicy(nextPermissionPolicy);
        },
        [onUpdatePermissionPolicy]
    );

    return (
        <div className="border-t border-border/5 bg-background/30 p-3">
            <Modal
                isOpen={showCouncilSetup}
                onClose={onToggleCouncil}
                title={t('council.setupTitle')}
                size="3xl"
            >
                <WorkspaceAgentCouncilSetup
                    councilSetup={councilSetup}
                    groupedModels={groupedModels}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    setCouncilSetup={setCouncilSetup}
                    onApplyCouncilSetup={onApplyCouncilSetup}
                    onClose={onToggleCouncil}
                    t={t}
                />
            </Modal>

            <div className="flex items-end gap-2">
                <Textarea
                    value={composerValue}
                    onChange={event => setComposerValue(event.target.value)}
                    onKeyDown={handleEnter}
                    placeholder={t('workspace.writeSomething')}
                    className={C_WORKSPACEAGENTCOMPOSER_1}
                    disabled={isLoading}
                />
                <Button
                    onClick={isLoading ? onStop : onSend}
                    className="h-11 w-11 rounded-2xl bg-primary/95 hover:bg-primary shrink-0"
                >
                    {isLoading ? (
                        <IconSquare className="h-4 w-4 fill-current" />
                    ) : (
                        <IconSend className="h-4 w-4" />
                    )}
                </Button>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            title={t('workspaceAgent.permissions.profile')}
                            className={C_WORKSPACEAGENTCOMPOSER_2}
                        >
                            <span className="typo-caption font-bold text-muted-foreground/60">
                                {selectedPreset.value === 'default-agent' ? 'A' : selectedPreset.value === 'plan' ? 'P' : 'E'}
                            </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className={C_WORKSPACEAGENTCOMPOSER_3}
                    >
                        <div className="px-3 py-1.5 typo-overline font-bold uppercase text-muted-foreground/30 border-b border-border/30 mb-1.5">
                            {t('workspaceAgent.permissions.profile')}
                        </div>
                        <div className="space-y-0.5">
                            {presetOptions.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className="flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-muted/40 group"
                                    onClick={() => void onSelectPreset(option.value)}
                                >
                                    <span className="min-w-0">
                                        <span className="block text-sm font-bold text-foreground/90 group-hover:text-foreground transition-colors">
                                            {option.title}
                                        </span>
                                        <span className="block typo-overline text-muted-foreground/50 leading-snug mt-0.5">
                                            {option.description}
                                        </span>
                                    </span>
                                    {selectedPreset.value === option.value && (
                                        <IconCheck className="ml-3 h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <Button
                    type="button"
                    variant={currentModes.council ? 'secondary' : 'outline'}
                    title={t('agents.council')}
                    className={cn(
                        'h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border-border/10 transition-colors p-0',
                        currentModes.council
                            ? 'bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary'
                            : 'bg-background/30 hover:bg-background/40'
                    )}
                    onClick={onToggleCouncil}
                >
                    <IconMap className="h-4 w-4 text-muted-foreground/60" />
                </Button>

                <div className="shrink-0 rounded-xl border border-border/10 bg-background/30 p-0.5 hover:bg-background/40 transition-colors">
                    <ModelSelector
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSelect={(provider, model) => {
                            setSelectedProvider(provider);
                            setSelectedModel(model);
                            void persistLastSelection(provider, model);
                        }}
                        settings={settings}
                        groupedModels={groupedModels ?? undefined}
                        quotas={quotas}
                        codexUsage={codexUsage}
                        isIconOnly
                        permissionPolicy={permissionPolicy}
                        onUpdatePermissionPolicy={handlePermissionUpdate}
                    />
                </div>
            </div>
        </div>
    );
};
