/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Label } from '@renderer/components/ui/label';
import { Slider } from '@renderer/components/ui/slider';
import { Switch } from '@renderer/components/ui/switch';
import { cn } from '@renderer/lib/utils';
import { Bot, Save, Shield } from 'lucide-react';
import React from 'react';

import { AgentDefinition } from '@/types';

import { SettingsSectionProps } from './types';

interface CouncilSectionProps extends SettingsSectionProps {
    availableAgents: AgentDefinition[];
    toggleMember: (id: string) => void;
}

export const CouncilSection: React.FC<CouncilSectionProps> = ({
    formData,
    setFormData,
    availableAgents,
    toggleMember,
    t,
}) => (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    {t('workspaces.councilAI')}
                </h3>
                <p className="typo-caption text-muted-foreground">{t('workspaces.councilAIDesc')}</p>
            </div>
            <div className="flex items-center gap-3 bg-muted/40 p-1 rounded-full border border-border/40 px-3 py-1">
                <Label
                    htmlFor="council-enabled"
                    className="typo-caption font-medium text-muted-foreground cursor-pointer"
                >
                    {t('workspaces.councilEnabledLabel')}
                </Label>
                <Switch
                    id="council-enabled"
                    checked={formData.councilEnabled}
                    onCheckedChange={(checked: boolean) =>
                        setFormData(prev => ({ ...prev, councilEnabled: checked }))
                    }
                />
            </div>
        </div>

        <div
            className={cn(
                'space-y-6 transition-opacity',
                !formData.councilEnabled && 'opacity-50 pointer-events-none'
            )}
        >
            <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('workspaces.consensusThreshold')} ({t('common.percentage', { value: Math.round(formData.consensusThreshold * 100) })})
                </Label>
                <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={[formData.consensusThreshold]}
                    onValueChange={(values: number[]) =>
                        setFormData(prev => ({ ...prev, consensusThreshold: values[0] }))
                    }
                    className="w-full"
                />
                <p className="text-xxs text-muted-foreground">
                    {t('workspaces.councilThresholdHint')}
                </p>
            </div>

            <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground">
                    {t('workspaces.selectedAgents')}
                </Label>
                <div className="grid gap-2">
                    {availableAgents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => toggleMember(agent.id)}
                            className={cn(
                                'flex items-center justify-between p-3 rounded-lg border transition-all group',
                                formData.councilMembers.includes(agent.id)
                                    ? 'bg-primary/10 border-primary/40 text-primary'
                                    : 'bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/30'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center font-bold typo-caption  transition-colors',
                                        formData.councilMembers.includes(agent.id)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/30'
                                    )}
                                >
                                    {agent.name.charAt(0)}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                        {agent.name}
                                    </div>
                                    <div className="text-xxs opacity-60">
                                        {agent.description ?? t('workspaces.generalAI')}
                                    </div>
                                </div>
                            </div>
                            <div
                                className={cn(
                                    'w-5 h-5 rounded-md border flex items-center justify-center transition-all',
                                    formData.councilMembers.includes(agent.id)
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'border-border/50'
                                )}
                            >
                                {formData.councilMembers.includes(agent.id) && (
                                    <Save className="w-3 h-3" />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </section>
);
