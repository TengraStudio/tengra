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
import { IconMap, IconPlayerStop, IconPlus, IconSend } from '@tabler/icons-react';
import React from 'react';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioButtonGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import type { AppSettings, CodexUsage, GroupedModels, QuotaResponse } from '@/types';

import { WorkspaceAgentCouncilSetup } from './WorkspaceAgentCouncilSetup';

export type WorkspaceAgentComposerPreset = 'default-agent' | 'plan' | 'agent';
export type WorkspaceAgentDeliveryMode = 'send' | 'queue' | 'steer';

interface WorkspaceAgentComposerProps {
    currentSession: WorkspaceAgentSessionSummary | null;
    currentModes: WorkspaceAgentSessionModes;
    currentPermissionPolicy: WorkspaceAgentPermissionPolicy;
    composerValue: string;
    setComposerValue: (value: string) => void;
    deliveryMode: WorkspaceAgentDeliveryMode;
    setDeliveryMode: (value: WorkspaceAgentDeliveryMode) => void;
    queuedMessageCount: number;
    onSend: (mode?: WorkspaceAgentDeliveryMode) => void;
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

function getPresetValue(modes: WorkspaceAgentSessionModes): WorkspaceAgentComposerPreset {
    if (modes.plan) {
        return 'plan';
    }
    if (modes.agent) {
        return 'agent';
    }
    return 'default-agent';
}

function modeLabel(value: WorkspaceAgentComposerPreset): string {
    switch (value) {
        case 'plan':
            return 'Plan';
        case 'agent':
            return 'Agent';
        default:
            return 'Ask';
    }
}

function deliveryModeLabel(value: WorkspaceAgentDeliveryMode): string {
    switch (value) {
        case 'queue':
            return 'Queue';
        case 'steer':
            return 'Steer';
        default:
            return 'Send';
    }
}

export const WorkspaceAgentComposer: React.FC<WorkspaceAgentComposerProps> = ({
    currentSession,
    currentModes,
    currentPermissionPolicy,
    composerValue,
    setComposerValue,
    deliveryMode,
    setDeliveryMode,
    queuedMessageCount,
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
    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (event.ctrlKey || event.metaKey) {
                onSend('queue');
            } else {
                onSend(isLoading ? 'steer' : 'send');
            }
        }
    };

    const selectedPreset = getPresetValue(currentModes);
    const permissionPolicy = currentSession?.permissionPolicy ?? currentPermissionPolicy;
    const handlePermissionUpdate = React.useCallback(
        (nextPermissionPolicy: WorkspaceAgentPermissionPolicy) => {
            void onUpdatePermissionPolicy(nextPermissionPolicy);
        },
        [onUpdatePermissionPolicy]
    );

    return (
        <div className="border-t border-border bg-background px-3 py-2">
            <Modal
                isOpen={showCouncilSetup}
                onClose={onToggleCouncil}
                title="Council setup"
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

            <Textarea
                value={composerValue}
                onChange={event => setComposerValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the workspace or give the agent a task"
                className="min-h-14 resize-none rounded-md border-border/60 bg-background px-3 py-2 text-sm"
            />

            <div className="mt-2 flex w-full items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="h-8 w-8 rounded-md p-0">
                            <IconPlus className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 border-border/60">
                        <DropdownMenuLabel>Agent mode</DropdownMenuLabel>
                        <DropdownMenuRadioButtonGroup
                            value={selectedPreset}
                            onValueChange={value => void onSelectPreset(value as WorkspaceAgentComposerPreset)}
                        >
                            <DropdownMenuRadioItem value="default-agent">Ask</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="plan">Plan</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="agent">Agent</DropdownMenuRadioItem>
                        </DropdownMenuRadioButtonGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onToggleCouncil}>
                            <IconMap className="mr-2 h-4 w-4" />
                            {currentModes.council ? 'Disable council' : 'Council setup'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Command permissions</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56">
                                <DropdownMenuRadioButtonGroup
                                    value={permissionPolicy.commandPolicy}
                                    onValueChange={value =>
                                        handlePermissionUpdate({
                                            ...permissionPolicy,
                                            commandPolicy: value as WorkspaceAgentPermissionPolicy['commandPolicy'],
                                        })
                                    }
                                >
                                    <DropdownMenuRadioItem value="ask-every-time">Ask before commands</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="blocked">Block commands</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="allowlist">Allowlist only</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="full-access">Full access</DropdownMenuRadioItem>
                                </DropdownMenuRadioButtonGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>File permissions</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56">
                                <DropdownMenuRadioButtonGroup
                                    value={permissionPolicy.pathPolicy}
                                    onValueChange={value =>
                                        handlePermissionUpdate({
                                            ...permissionPolicy,
                                            pathPolicy: value as WorkspaceAgentPermissionPolicy['pathPolicy'],
                                        })
                                    }
                                >
                                    <DropdownMenuRadioItem value="workspace-root-only">Workspace only</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="allowlist">Allowlist only</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="restricted-off-dangerous">Restricted</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="full-access">Full access</DropdownMenuRadioItem>
                                </DropdownMenuRadioButtonGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="min-w-0 max-w-[280px] flex-1">
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
                        permissionPolicy={permissionPolicy}
                        onUpdatePermissionPolicy={handlePermissionUpdate}
                        showChatModeControls={false}
                        showModeBadge={false}
                        triggerVariant="compact"
                    />
                </div>

                {isLoading ? (
                    <Button type="button" variant="outline" className="ml-auto h-8 gap-2 rounded-md px-3" onClick={onStop}>
                        <IconPlayerStop className="h-4 w-4" />
                        Stop
                    </Button>
                ) : null}

                <div className="flex items-center gap-1">
                    <Tooltip
                        delay={300}
                        side="top"
                        content={
                            <div className="space-y-1.5 min-w-[180px]">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Queue message</span>
                                    <kbd className="rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-foreground border border-border/50">Ctrl+Enter</kbd>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Steer current stream</span>
                                    <kbd className="rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-foreground border border-border/50">Enter</kbd>
                                </div>
                            </div>
                        }
                    >
                        <Button
                            type="button"
                            className={cn(
                                'h-8 gap-2 rounded-md px-3',
                                !isLoading && 'ml-auto'
                            )}
                            onClick={() => onSend()}
                        >
                            <IconSend className="h-4 w-4" />
                            {isLoading ? 'Steer' : 'Send'}
                            {queuedMessageCount > 0 ? ` (${queuedMessageCount})` : ''}
                        </Button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};
