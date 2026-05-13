/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * (at your option) any later version.
 */

import {
    CORE_IDENTITY,
    PROVIDER_INSTRUCTIONS,
    RESPONSE_CONTRACT,
    TOOL_AND_EVIDENCE_POLICY,
} from '@shared/prompts';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Select,
    SelectValue,
} from '@/components/ui/select';
import type { SettingsSharedProps } from '@/features/settings/types';
import type { GroupedModels, ModelInfo } from '@/types';
import type { AppSettings, PromptOverrideSettings } from '@/types/settings';

import {
    SettingsField,
    SettingsPanel,
    SettingsSelectContent,
    SettingsSelectItem,
    SettingsSelectTrigger,
    SettingsTabHeader,
    SettingsTabLayout,
    SettingsTextarea,
    SettingsToggleRow,
    SettingsSwitch,
} from './SettingsPrimitives';

interface AiInstructionsTabProps extends SettingsSharedProps {
    groupedModels?: GroupedModels;
}

const DEFAULT_OVERRIDE: Required<Pick<
    PromptOverrideSettings,
    'enabled' | 'systemInstructions' | 'userPromptPrefix' | 'userPromptSuffix'
>> = {
    enabled: false,
    systemInstructions: '',
    userPromptPrefix: '',
    userPromptSuffix: '',
};

function normalizeOverride(value?: PromptOverrideSettings): PromptOverrideSettings {
    return {
        ...DEFAULT_OVERRIDE,
        ...(value ?? {}),
    };
}

function flattenGroupedModels(groupedModels?: GroupedModels): ModelInfo[] {
    if (!groupedModels) {
        return [];
    }

    return Object.values(groupedModels)
        .flatMap(group => group.models)
        .filter(model => typeof model.id === 'string' && model.id.trim().length > 0);
}

function getModelLabel(model: ModelInfo): string {
    const name = typeof model.name === 'string' && model.name.trim().length > 0
        ? model.name
        : model.id ?? 'Unknown model';

    const provider = model.providerCategory || model.sourceProvider || model.provider;
    return provider ? `${name} (${provider})` : name;
}

function getProviderForModel(model?: ModelInfo): string | undefined {
    return model?.providerCategory || model?.sourceProvider || model?.provider;
}

function getModelOverrideKey(model: ModelInfo): string {
    const provider = model.providerCategory || model.sourceProvider || model.provider || 'unknown';
    return `${provider}:${model.id}`;
}

function buildDefaultPromptPreview(provider?: string): string {
    const providerInstructions = provider
        ? PROVIDER_INSTRUCTIONS[provider.toLowerCase()] ?? ''
        : '';

    return [
        CORE_IDENTITY,
        RESPONSE_CONTRACT,
        TOOL_AND_EVIDENCE_POLICY,
        providerInstructions,
    ].filter(Boolean).join('\n\n');
}

function buildPromptPartsPreview(provider?: string): string {
    const providerInstructions = provider
        ? PROVIDER_INSTRUCTIONS[provider.toLowerCase()] ?? ''
        : '';

    return [
        '# Core identity',
        CORE_IDENTITY.trim(),
        '',
        '# Response contract',
        RESPONSE_CONTRACT.trim(),
        '',
        '# Tool and evidence policy',
        TOOL_AND_EVIDENCE_POLICY.trim(),
        providerInstructions.trim()
            ? `\n# Provider instructions\n${providerInstructions.trim()}`
            : '',
    ].filter(Boolean).join('\n');
}

export function AiInstructionsTab({
    settings,
    setSettings,
    handleSave,
    groupedModels,
    t,
}: AiInstructionsTabProps) {
    const [selectedModelId, setSelectedModelId] = useState<string>('');

    const models = useMemo(
        () => flattenGroupedModels(groupedModels),
        [groupedModels]
    );

    const selectedModel = useMemo(
        () => models.find(model => getModelOverrideKey(model) === selectedModelId),
        [models, selectedModelId]
    );

    const globalDefaultPrompt = useMemo(
        () => buildDefaultPromptPreview(),
        []
    );

    const selectedModelDefaultPrompt = useMemo(
        () => buildDefaultPromptPreview(getProviderForModel(selectedModel)),
        [selectedModel]
    );

    const selectedModelPromptParts = useMemo(
        () => buildPromptPartsPreview(getProviderForModel(selectedModel)),
        [selectedModel]
    );

    if (!settings) {
        return null;
    }

    const promptOverrides = settings.aiPromptOverrides ?? {};
    const globalOverride = normalizeOverride(promptOverrides.global);

    const selectedModelOverride = selectedModelId
        ? normalizeOverride(promptOverrides.byModel?.[selectedModelId])
        : normalizeOverride();

    const updateOverrides = async (
        nextOverrides: NonNullable<AppSettings['aiPromptOverrides']>
    ): Promise<void> => {
        const nextSettings: AppSettings = {
            ...settings,
            aiPromptOverrides: nextOverrides,
        };

        await setSettings(nextSettings);
        await handleSave(nextSettings);
    };

    const updateGlobalOverride = async (
        patch: Partial<PromptOverrideSettings>
    ): Promise<void> => {
        await updateOverrides({
            ...promptOverrides,
            global: {
                ...globalOverride,
                ...patch,
            },
            byModel: promptOverrides.byModel ?? {},
        });
    };

    const updateSelectedModelOverride = async (
        patch: Partial<PromptOverrideSettings>
    ): Promise<void> => {
        if (!selectedModelId) {
            return;
        }

        await updateOverrides({
            ...promptOverrides,
            global: promptOverrides.global ?? DEFAULT_OVERRIDE,
            byModel: {
                ...(promptOverrides.byModel ?? {}),
                [selectedModelId]: {
                    ...selectedModelOverride,
                    ...patch,
                },
            },
        });
    };

    const resetGlobalOverride = async (): Promise<void> => {
        await updateOverrides({
            ...promptOverrides,
            global: { ...DEFAULT_OVERRIDE },
            byModel: promptOverrides.byModel ?? {},
        });
    };

    const resetSelectedModelOverride = async (): Promise<void> => {
        if (!selectedModelId) {
            return;
        }

        const nextByModel = { ...(promptOverrides.byModel ?? {}) };
        delete nextByModel[selectedModelId];

        await updateOverrides({
            ...promptOverrides,
            global: promptOverrides.global ?? DEFAULT_OVERRIDE,
            byModel: nextByModel,
        });
    };

    const hasSelectedModelOverride = Boolean(
        selectedModelId && promptOverrides.byModel?.[selectedModelId]
    );

    return (
        <SettingsTabLayout> 
            <SettingsPanel
                title={t('frontend.settings.aiInstructions.globalTitle')}
                description={t('frontend.settings.aiInstructions.globalDescription')}
            >
                <div className="space-y-5 px-6 py-2">
                    <SettingsToggleRow
                        title={t('frontend.settings.aiInstructions.enableGlobal')}
                        description={t('frontend.settings.aiInstructions.globalDescription')}
                        control={(
                            <SettingsSwitch
                                checked={globalOverride.enabled === true}
                                onCheckedChange={checked => {
                                    void updateGlobalOverride({ enabled: checked });
                                }}
                            />
                        )}
                    />

                    <SettingsField label={t('frontend.settings.aiInstructions.currentDefaultInstructions')}>
                        <div className="flex flex-col gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 self-start rounded-2xl border-border/30 bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-muted/40"
                                onClick={() => {
                                    void updateGlobalOverride({
                                        systemInstructions: globalDefaultPrompt,
                                        enabled: true,
                                    });
                                }}
                            >
                                {t('frontend.settings.aiInstructions.copyDefaultToOverride')}
                            </Button>
                            <SettingsTextarea
                                value={globalDefaultPrompt}
                                readOnly
                                rows={10}
                            />
                        </div>
                    </SettingsField>

                    <SettingsField label={t('frontend.settings.aiInstructions.systemInstructions')}>
                        <SettingsTextarea
                            value={globalOverride.systemInstructions ?? ''}
                            onChange={event => {
                                void updateGlobalOverride({ systemInstructions: event.target.value });
                            }}
                            placeholder={t('frontend.settings.aiInstructions.systemPlaceholder')}
                            rows={8}
                        />
                    </SettingsField>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <SettingsField label={t('frontend.settings.aiInstructions.promptPrefix')}>
                            <SettingsTextarea
                                value={globalOverride.userPromptPrefix ?? ''}
                                onChange={event => {
                                    void updateGlobalOverride({ userPromptPrefix: event.target.value });
                                }}
                                placeholder={t('frontend.settings.aiInstructions.promptPrefixPlaceholder')}
                                rows={5}
                            />
                        </SettingsField>

                        <SettingsField label={t('frontend.settings.aiInstructions.promptSuffix')}>
                            <SettingsTextarea
                                value={globalOverride.userPromptSuffix ?? ''}
                                onChange={event => {
                                    void updateGlobalOverride({ userPromptSuffix: event.target.value });
                                }}
                                placeholder={t('frontend.settings.aiInstructions.promptSuffixPlaceholder')}
                                rows={5}
                            />
                        </SettingsField>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="h-10 self-start rounded-2xl border-border/30 bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-muted/40"
                        onClick={() => {
                            void resetGlobalOverride();
                        }}
                    >
                        {t('frontend.settings.aiInstructions.resetGlobal')}
                    </Button>
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('frontend.settings.aiInstructions.modelTitle')}
                description={t('frontend.settings.aiInstructions.modelDescription')}
            >
                <div className="space-y-5 px-6 py-2">
                    <SettingsField label={t('frontend.settings.aiInstructions.selectModel')}>
                        <Select
                            value={selectedModelId}
                            onValueChange={value => setSelectedModelId(value)}
                        >
                            <SettingsSelectTrigger>
                                <SelectValue placeholder={t('frontend.settings.aiInstructions.selectModelPlaceholder')} />
                            </SettingsSelectTrigger>
                            <SettingsSelectContent>
                                {models.map((model, index) => {
                                    const overrideKey = getModelOverrideKey(model);

                                    return (
                                        <SettingsSelectItem key={`${overrideKey}:${index}`} value={overrideKey}>
                                            {getModelLabel(model)}
                                        </SettingsSelectItem>
                                    );
                                })}
                            </SettingsSelectContent>
                        </Select>
                    </SettingsField>

                    {selectedModelId ? (
                        <div className="space-y-5">
                            <SettingsToggleRow
                                title={t('frontend.settings.aiInstructions.enableModel')}
                                description={t('frontend.settings.aiInstructions.modelDescription')}
                                control={(
                                    <SettingsSwitch
                                        checked={selectedModelOverride.enabled === true}
                                        onCheckedChange={checked => {
                                            void updateSelectedModelOverride({ enabled: checked });
                                        }}
                                    />
                                )}
                            />

                            <SettingsField label={t('frontend.settings.aiInstructions.currentModelInstructions')}>
                                <div className="flex flex-col gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 self-start rounded-2xl border-border/30 bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-muted/40"
                                        onClick={() => {
                                            void updateSelectedModelOverride({
                                                systemInstructions: selectedModelDefaultPrompt,
                                                enabled: true,
                                            });
                                        }}
                                    >
                                        {t('frontend.settings.aiInstructions.copyDefaultToOverride')}
                                    </Button>
                                    <SettingsTextarea
                                        value={selectedModelPromptParts}
                                        readOnly
                                        rows={10}
                                    />
                                </div>
                            </SettingsField>

                            <SettingsField label={t('frontend.settings.aiInstructions.systemInstructions')}>
                                <SettingsTextarea
                                    value={selectedModelOverride.systemInstructions ?? ''}
                                    onChange={event => {
                                        void updateSelectedModelOverride({ systemInstructions: event.target.value });
                                    }}
                                    placeholder={t('frontend.settings.aiInstructions.modelSystemPlaceholder')}
                                    rows={8}
                                />
                            </SettingsField>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <SettingsField label={t('frontend.settings.aiInstructions.promptPrefix')}>
                                    <SettingsTextarea
                                        value={selectedModelOverride.userPromptPrefix ?? ''}
                                        onChange={event => {
                                            void updateSelectedModelOverride({ userPromptPrefix: event.target.value });
                                        }}
                                        placeholder={t('frontend.settings.aiInstructions.promptPrefixPlaceholder')}
                                        rows={5}
                                    />
                                </SettingsField>

                                <SettingsField label={t('frontend.settings.aiInstructions.promptSuffix')}>
                                    <SettingsTextarea
                                        value={selectedModelOverride.userPromptSuffix ?? ''}
                                        onChange={event => {
                                            void updateSelectedModelOverride({ userPromptSuffix: event.target.value });
                                        }}
                                        placeholder={t('frontend.settings.aiInstructions.promptSuffixPlaceholder')}
                                        rows={5}
                                    />
                                </SettingsField>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 self-start rounded-2xl border-border/30 bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!hasSelectedModelOverride}
                                onClick={() => {
                                    void resetSelectedModelOverride();
                                }}
                            >
                                {t('frontend.settings.aiInstructions.resetModel')}
                            </Button>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border/50 bg-muted/5 px-4 py-5 text-sm text-muted-foreground">
                            {t('frontend.settings.aiInstructions.selectModelEmpty')}
                        </div>
                    )}
                </div>
            </SettingsPanel>
        </SettingsTabLayout>
    );
}
