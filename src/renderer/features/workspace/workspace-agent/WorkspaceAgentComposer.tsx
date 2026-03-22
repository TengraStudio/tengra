import type {
    CouncilRunConfig,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import {
    Check,
    ChevronRight,
    Map,
    Send,
    SlidersHorizontal,
    Square,
} from 'lucide-react';
import React from 'react';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import type { AppSettings, CodexUsage, GroupedModels, QuotaResponse } from '@/types';

import { WorkspaceAgentCouncilSetup } from './WorkspaceAgentCouncilSetup';
import { WorkspaceAgentPermissionEditor } from './WorkspaceAgentPermissionEditor';

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

type SettingsSubmenu = 'commands' | 'paths' | 'profile' | null;

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
    const [submenu, setSubmenu] = React.useState<SettingsSubmenu>(null);

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
    
    const commandOptions = React.useMemo(() => [
        { value: 'blocked', title: t('workspaceAgent.permissions.policy.blocked') },
        { value: 'ask-every-time', title: t('workspaceAgent.permissions.policy.ask-every-time') },
        { value: 'allowlist', title: t('workspaceAgent.permissions.policy.allowlist') },
        { value: 'full-access', title: t('workspaceAgent.permissions.policy.full-access') },
    ], [t]);

    const pathOptions = React.useMemo(() => [
        { value: 'workspace-root-only', title: t('workspaceAgent.permissions.policy.workspace-root-only') },
        { value: 'allowlist', title: t('workspaceAgent.permissions.policy.allowlist') },
        { value: 'restricted-off-dangerous', title: t('workspaceAgent.permissions.policy.restricted-off-dangerous') },
    ], [t]);

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

    const selectedCommandPolicy = commandOptions.find(o => o.value === permissionPolicy.commandPolicy);
    const selectedPathPolicy = pathOptions.find(o => o.value === permissionPolicy.pathPolicy);

    return (
        <div className="border-t border-border/5 bg-black/5 p-3">
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
                    className="min-h-[44px] h-11 flex-1 rounded-2xl border-white/5 bg-black/10 px-4 py-2.5 placeholder:text-muted-foreground/40 text-sm focus:border-border/20 transition-colors resize-none overflow-hidden"
                    disabled={isLoading}
                />
                <Button
                    onClick={isLoading ? onStop : onSend}
                    className="h-11 w-11 rounded-2xl bg-primary/95 hover:bg-primary shrink-0"
                >
                    {isLoading ? (
                        <Square className="h-4 w-4 fill-current" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            title={`${t('workspaceAgent.permissions.title')}: ${selectedPreset.title} · ${selectedCommandPolicy?.title} · ${selectedPathPolicy?.title}`}
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border-border/10 bg-black/5 hover:bg-black/10 transition-colors p-0"
                        >
                            <SlidersHorizontal className="h-4 w-4 text-muted-foreground/60" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="relative w-[300px] rounded-2xl border border-white/10 bg-black/95 p-1.5 shadow-none"
                    >
                        <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 border-b border-white/5 mb-1.5">
                            {t('workspaceAgent.permissions.title')}
                        </div> 
                        <div className="space-y-0.5">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/5 group"
                                onMouseEnter={() => setSubmenu('profile')}
                                onFocus={() => setSubmenu('profile')}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-0.5">
                                        {t('workspaceAgent.permissions.profile')}
                                    </span>
                                    <span className="block truncate text-sm font-semibold text-foreground/90">
                                        {selectedPreset.title}
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                            </button>
                            <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/5 group"
                                onMouseEnter={() => setSubmenu('commands')}
                                onFocus={() => setSubmenu('commands')}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-0.5">
                                        {t('workspaceAgent.permissions.commands')}
                                    </span>
                                    <span className="block truncate text-sm font-semibold text-foreground/90">
                                        {selectedCommandPolicy?.title}
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                            </button>
                            <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/5 group"
                                onMouseEnter={() => setSubmenu('paths')}
                                onFocus={() => setSubmenu('paths')}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mb-0.5">
                                        {t('workspaceAgent.permissions.files')}
                                    </span>
                                    <span className="block truncate text-sm font-semibold text-foreground/90">
                                        {selectedPathPolicy?.title}
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                            </button>
                        </div>

                        {submenu ? (
                            <div
                                className="absolute right-[calc(100%+4px)] top-0 w-[280px] rounded-2xl border border-white/10 bg-black/95 p-1.5 shadow-none animate-in fade-in slide-in-from-right-1 duration-200"
                                onMouseLeave={() => setSubmenu(null)}
                            >
                                {submenu === 'profile' ? (
                                    <>
                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 border-b border-white/5 mb-1.5">
                                            {t('workspaceAgent.permissions.profile')}
                                        </div>
                                        <div className="space-y-0.5">
                                            {presetOptions.map(option => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className="flex w-full items-start justify-between rounded-xl px-3 py-2.5 text-left transition-all hover:bg-white/5 group"
                                                    onClick={() => void onSelectPreset(option.value)}
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-bold text-foreground/90 group-hover:text-foreground transition-colors">
                                                            {option.title}
                                                        </span>
                                                        <span className="block text-[10px] text-muted-foreground/50 leading-snug mt-0.5">
                                                            {option.description}
                                                        </span>
                                                    </span>
                                                    {selectedPreset.value === option.value && (
                                                        <Check className="ml-3 h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                                {submenu === 'commands' ? (
                                    <>
                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 border-b border-white/5 mb-1.5">
                                            {t('workspaceAgent.permissions.commands')}
                                        </div>
                                        <div className="space-y-0.5">
                                            {commandOptions.map(option => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white/5 group"
                                                    onClick={() =>
                                                        handlePermissionUpdate({
                                                            ...permissionPolicy,
                                                            commandPolicy: option.value as WorkspaceAgentPermissionPolicy['commandPolicy'],
                                                        })
                                                    }
                                                >
                                                    <span className="text-sm font-bold text-foreground/90 group-hover:text-foreground transition-colors">
                                                        {option.title}
                                                    </span>
                                                    {permissionPolicy.commandPolicy === option.value && (
                                                        <Check className="ml-3 h-3.5 w-3.5 text-primary shrink-0" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                                {submenu === 'paths' ? (
                                    <>
                                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30 border-b border-white/5 mb-1.5">
                                            {t('workspaceAgent.permissions.files')}
                                        </div>
                                        <div className="space-y-0.5">
                                            {pathOptions.map(option => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white/5 group"
                                                    onClick={() =>
                                                        handlePermissionUpdate({
                                                            ...permissionPolicy,
                                                            pathPolicy: option.value as WorkspaceAgentPermissionPolicy['pathPolicy'],
                                                        })
                                                    }
                                                >
                                                    <span className="text-sm font-bold text-foreground/90 group-hover:text-foreground transition-colors">
                                                        {option.title}
                                                    </span>
                                                    {permissionPolicy.pathPolicy === option.value && (
                                                        <Check className="ml-3 h-3.5 w-3.5 text-primary shrink-0" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                    </PopoverContent>
                </Popover>

                <Button
                    type="button"
                    variant={currentModes.council ? 'secondary' : 'outline'}
                    title={t('agents.council')}
                    className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border-border/10 transition-colors p-0 ${
                        currentModes.council 
                        ? 'bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary' 
                        : 'bg-black/5 hover:bg-black/10'
                    }`}
                    onClick={onToggleCouncil}
                >
                    <Map className="h-4 w-4 text-muted-foreground/60" />
                </Button>

                <div className="shrink-0 rounded-xl border border-border/10 bg-black/5 p-0.5 hover:bg-black/10 transition-colors">
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
                    />
                </div>
            </div>

            {permissionPolicy && (
                <WorkspaceAgentPermissionEditor
                    permissionPolicy={permissionPolicy}
                    onUpdatePermissions={handlePermissionUpdate}
                    t={t}
                />
            )}
        </div>
    );
};
