import type { GroupedModels } from '@shared/types/model.types';
import type {
    CouncilRunConfig,
    WorkspaceAgentSession,
} from '@shared/types/workspace-agent-session';
import { Bot, Sparkles, Waypoints } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface WorkspaceAgentCouncilSetupProps {
    councilSetup: CouncilRunConfig;
    groupedModels: GroupedModels | null | undefined;
    selectedProvider: string;
    selectedModel: string;
    setCouncilSetup: React.Dispatch<React.SetStateAction<CouncilRunConfig>>;
    onApplyCouncilSetup: () => void;
    onClose: () => void;
    t: (key: string) => string;
}

const SUBAGENT_COUNT_OPTIONS = ['auto', '2', '4', '8', '12', '20', '30'] as const;

function toRequestedCount(value: string): CouncilRunConfig['requestedSubagentCount'] {
    return value === 'auto' ? 'auto' : Number.parseInt(value, 10);
}

function listProviders(groupedModels: GroupedModels | null | undefined): string[] {
    if (!groupedModels) {
        return [];
    }
    return Object.keys(groupedModels);
}

function listModelsForProvider(
    groupedModels: GroupedModels | null | undefined,
    provider: string
): string[] {
    if (!groupedModels?.[provider]) {
        return [];
    }
    return groupedModels[provider].models
        .map(model => model.id ?? model.name)
        .filter((model): model is string => typeof model === 'string' && model.length > 0);
}

export const WorkspaceAgentCouncilSetup: React.FC<WorkspaceAgentCouncilSetupProps> = ({
    councilSetup,
    groupedModels,
    selectedProvider,
    selectedModel,
    setCouncilSetup,
    onApplyCouncilSetup,
    onClose,
    t,
}) => {
    const providerOptions = React.useMemo(
        () => listProviders(groupedModels),
        [groupedModels]
    );
    const selectedChairmanProvider =
        councilSetup.chairman.provider ?? selectedProvider;
    const modelOptions = React.useMemo(
        () => listModelsForProvider(groupedModels, selectedChairmanProvider),
        [groupedModels, selectedChairmanProvider]
    );
    const selectedChairmanModel =
        councilSetup.chairman.model ?? selectedModel;
    const requestedSubagentLabel =
        councilSetup.requestedSubagentCount === 'auto'
            ? t('common.auto')
            : `${councilSetup.requestedSubagentCount}`;

    return (
        <div className="space-y-6">
            <div className="mb-2">
                <p className="text-sm text-muted-foreground/60 leading-relaxed font-medium">
                    {t('council.setupSubtitle')}
                </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/30 bg-muted/40 p-4 transition-all hover:bg-muted/50">
                    <div className="flex items-center gap-2 tw-text-10 font-black uppercase tw-tracking-25 text-muted-foreground/30 mb-3">
                        <Bot className="h-3.5 w-3.5" />
                        <span>{t('council.chairman')}</span>
                    </div>
                    <div className="text-lg font-bold text-foreground/90">
                        {councilSetup.chairman.mode === 'manual'
                            ? t('common.manual')
                            : t('common.auto')}
                    </div>
                    <div className="mt-1 truncate text-xs font-medium text-muted-foreground/40">
                        {councilSetup.chairman.mode === 'manual'
                            ? `${selectedChairmanProvider} · ${selectedChairmanModel}`
                            : t('agents.strategy')}
                    </div>
                </div>
                <div className="rounded-2xl border border-border/30 bg-muted/40 p-4 transition-all hover:bg-muted/50">
                    <div className="flex items-center gap-2 tw-text-10 font-black uppercase tw-tracking-25 text-muted-foreground/30 mb-3">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{t('agents.strategy')}</span>
                    </div>
                    <div className="text-lg font-bold text-foreground/90">
                        {t(`council.strategies.${councilSetup.strategy}`)}
                    </div>
                    <div className="mt-1 truncate text-xs font-medium text-muted-foreground/40">
                        {selectedChairmanProvider} · {selectedChairmanModel}
                    </div>
                </div>
                <div className="rounded-2xl border border-border/30 bg-muted/40 p-4 transition-all hover:bg-muted/50">
                    <div className="flex items-center gap-2 tw-text-10 font-black uppercase tw-tracking-25 text-muted-foreground/30 mb-3">
                        <Waypoints className="h-3.5 w-3.5" />
                        <span>{t('council.requestedSubagents')}</span>
                    </div>
                    <div className="text-lg font-bold text-foreground/90">
                        {requestedSubagentLabel}
                    </div>
                    <div className="mt-1 text-xs font-medium text-muted-foreground/40 italic">
                        {t('common.active')}
                    </div>
                </div>
            </div>

            <div className="space-y-6 rounded-3xl border border-border/30 bg-muted/30 p-6">
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2.5">
                        <label className="tw-text-10 font-black text-muted-foreground/40 px-1 uppercase tracking-widest">
                            {t('council.chairman')}
                        </label>
                        <Select
                            value={councilSetup.chairman.mode}
                            onValueChange={value =>
                                setCouncilSetup(previous => ({
                                    ...previous,
                                    chairman:
                                        value === 'manual'
                                            ? {
                                                  mode: 'manual',
                                                  provider: selectedProvider,
                                                  model: selectedModel,
                                                }
                                            : { mode: 'auto' },
                                }))
                            }
                        >
                            <SelectTrigger className="h-11 rounded-2xl border-border/40 bg-background/70 text-sm hover:bg-background/80 transition-all">
                                <SelectValue placeholder={t('common.select')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                <SelectItem value="auto" className="rounded-xl">{t('common.auto')}</SelectItem>
                                <SelectItem value="manual" className="rounded-xl">{t('common.manual')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2.5">
                        <label className="tw-text-10 font-black text-muted-foreground/40 px-1 uppercase tracking-widest">
                            {t('agents.strategy')}
                        </label>
                        <Select
                            value={councilSetup.strategy}
                            onValueChange={value =>
                                setCouncilSetup(previous => ({
                                    ...previous,
                                    strategy: value as WorkspaceAgentSession['strategy'],
                                }))
                            }
                        >
                            <SelectTrigger className="h-11 rounded-2xl border-border/40 bg-background/70 text-sm hover:bg-background/80 transition-all">
                                <SelectValue placeholder={t('agents.strategy')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                <SelectItem value="reasoning-first" className="rounded-xl">{t('council.strategies.reasoning-first')}</SelectItem>
                                <SelectItem value="balanced" className="rounded-xl">{t('council.strategies.balanced')}</SelectItem>
                                <SelectItem value="local-first-simple" className="rounded-xl">{t('council.strategies.local-first-simple')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2.5">
                        <label className="tw-text-10 font-black text-muted-foreground/40 px-1 uppercase tracking-widest">
                            {t('council.requestedSubagents')}
                        </label>
                        <Select
                            value={`${councilSetup.requestedSubagentCount}`}
                            onValueChange={value =>
                                setCouncilSetup(previous => ({
                                    ...previous,
                                    requestedSubagentCount: toRequestedCount(value),
                                }))
                            }
                        >
                            <SelectTrigger className="h-11 rounded-2xl border-border/40 bg-background/70 text-sm hover:bg-background/80 transition-all">
                                <SelectValue placeholder={t('common.select')} />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                {SUBAGENT_COUNT_OPTIONS.map(option => (
                                    <SelectItem key={option} value={option} className="rounded-xl">
                                        {option === 'auto' ? t('common.auto') : option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="rounded-2xl bg-primary/5 p-4 border border-primary/10">
                    <p className="text-xs leading-relaxed text-primary/80 font-medium">
                        {t(`council.strategiesDesc.${councilSetup.strategy}`)}
                    </p>
                </div>

                {councilSetup.chairman.mode === 'manual' && (
                    <div className="pt-6 border-t border-border/30 grid gap-6 md:grid-cols-2">
                        <div className="space-y-2.5">
                            <label className="tw-text-10 font-black text-muted-foreground/40 px-1 uppercase tracking-widest">
                                {t('agent.aiProvider')}
                            </label>
                            <Select
                                value={selectedChairmanProvider}
                                onValueChange={value =>
                                    setCouncilSetup(previous => ({
                                        ...previous,
                                        chairman: {
                                            ...previous.chairman,
                                            mode: 'manual',
                                            provider: value,
                                            model:
                                                listModelsForProvider(groupedModels, value)[0] ??
                                                previous.chairman.model ??
                                                selectedModel,
                                        },
                                    }))
                                }
                            >
                                <SelectTrigger className="h-11 rounded-2xl border-border/40 bg-background/70 text-sm hover:bg-background/80 transition-all">
                                    <SelectValue placeholder={t('common.select')} />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                    {providerOptions.map(provider => (
                                        <SelectItem key={provider} value={provider} className="rounded-xl">
                                            {provider}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2.5">
                            <label className="tw-text-10 font-black text-muted-foreground/40 px-1 uppercase tracking-widest">
                                {t('agent.modelAssignment')}
                            </label>
                            <Select
                                value={selectedChairmanModel}
                                onValueChange={value =>
                                    setCouncilSetup(previous => ({
                                        ...previous,
                                        chairman: {
                                            ...previous.chairman,
                                            mode: 'manual',
                                            provider: selectedChairmanProvider,
                                            model: value,
                                        },
                                    }))
                                }
                            >
                                <SelectTrigger className="h-11 rounded-2xl border-border/40 bg-background/70 text-sm hover:bg-background/80 transition-all">
                                    <SelectValue placeholder={t('common.select')} />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-border/40 bg-background/95">
                                    {modelOptions.map(model => (
                                        <SelectItem key={model} value={model} className="rounded-xl">
                                            {model}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
                <Button 
                    variant="ghost" 
                    onClick={onClose} 
                    className="rounded-2xl px-6 tw-text-10 font-black uppercase tracking-widest text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-all"
                >
                    {t('common.cancel')}
                </Button>
                <Button 
                    onClick={onApplyCouncilSetup} 
                    className="rounded-2xl px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tw-tracking-20 tw-shadow-primary-medium tw-hover-shadow-primary-glow transition-all"
                >
                    <Waypoints className="mr-2 h-4 w-4" />
                    {t('council.runCouncil')}
                </Button>
            </div>
        </div>
    );
};
