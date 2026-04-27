import { IconSettings2, IconSparkles } from '@tabler/icons-react';
import React, { useCallback } from 'react';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ModelSelector } from '@/features/models/components/ModelSelector';

import { SettingsSectionProps } from './types';

export const IntelligenceSection: React.FC<SettingsSectionProps> = ({ 
    formData, 
    setFormData, 
    t, 
    models, 
    settings, 
    groupedModels 
}) => {
    const handleModelSelect = useCallback((provider: string, modelId: string) => {
        setFormData(prev => ({ ...prev, intelligenceModelId: modelId }));
    }, [setFormData]);

    const handleDiscussModelSelect = useCallback((provider: string, modelId: string) => {
        setFormData(prev => ({ ...prev, intelligenceDiscussModelId: modelId }));
    }, [setFormData]);

    const getProviderForModel = (modelId: string) => {
        return models.find(m => m.id === modelId)?.provider || '';
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Model Configuration */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/5 text-primary border border-primary/10">
                        <IconSparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">
                            {t('workspaces.intelligence.modelConfig')}
                        </h2>
                        <p className="text-sm text-muted-foreground/60">
                            {t('workspaces.intelligence.modelConfigDesc')}
                        </p>
                    </div>
                </div>

                <div className="space-y-8 pl-11">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <Label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                                {t('workspaces.intelligence.defaultModel')}
                            </Label>
                            <ModelSelector
                                selectedModel={formData.intelligenceModelId}
                                selectedProvider={getProviderForModel(formData.intelligenceModelId)}
                                onSelect={handleModelSelect}
                                settings={settings}
                                groupedModels={groupedModels || {}}
                            />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                                {t('workspaces.intelligence.discussModel')}
                            </Label>
                            <ModelSelector
                                selectedModel={formData.intelligenceDiscussModelId}
                                selectedProvider={getProviderForModel(formData.intelligenceDiscussModelId)}
                                onSelect={handleDiscussModelSelect}
                                settings={settings}
                                groupedModels={groupedModels || {}}
                            />
                        </div>
                    </div>

                    <div className="space-y-5 pt-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                                {t('workspaces.intelligence.temperature')}
                            </Label>
                            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                                {formData.intelligenceTemperature}
                            </span>
                        </div>
                        <Slider
                            value={[formData.intelligenceTemperature]}
                            min={0}
                            max={1}
                            step={0.1}
                            onValueChange={([val]) => setFormData(prev => ({ ...prev, intelligenceTemperature: val }))}
                            className="py-2"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground/40 font-medium uppercase tracking-tight">
                            <span>{t('workspaces.intelligence.precise')}</span>
                            <span>{t('workspaces.intelligence.creative')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-px bg-border/5 ml-11" />

            {/* System Prompt */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/5 text-warning border border-warning/10">
                        <IconSettings2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">
                            {t('workspaces.intelligence.systemPrompt')}
                        </h2>
                        <p className="text-sm text-muted-foreground/60">
                            {t('workspaces.intelligence.systemPromptDesc')}
                        </p>
                    </div>
                </div>

                <div className="pl-11">
                    <Textarea
                        placeholder={t('workspaces.intelligence.systemPromptPlaceholder')}
                        className="min-h-40 bg-muted/5 border-border/10 font-mono text-[13px] leading-relaxed resize-none p-4"
                        value={formData.intelligenceSystemPrompt}
                        onChange={(e) => setFormData(prev => ({ ...prev, intelligenceSystemPrompt: e.target.value }))}
                    />
                </div>
            </div>
        </div>
    );
};
