/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';
import { Brain, Settings2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Label } from '@renderer/components/ui/label';
import { Textarea } from '@renderer/components/ui/textarea';
import { Slider } from '@renderer/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { SettingsSectionProps } from './types';

export const IntelligenceSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t, models }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Brain className="w-6 h-6 text-primary" />
                    {t('workspaces.intelligence.title')}
                </h2>
                <p className="text-muted-foreground">
                    {t('workspaces.intelligence.description')}
                </p>
            </div>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('workspaces.intelligence.modelConfig')}</CardTitle>
                    </div>
                    <CardDescription>{t('workspaces.intelligence.modelConfigDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('workspaces.intelligence.defaultModel')}</Label>
                            <Select 
                                value={formData.intelligenceModelId || 'inherit'} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, intelligenceModelId: val === 'inherit' ? '' : val }))}
                            >
                                <SelectTrigger className="bg-background/50">
                                    <SelectValue placeholder={t('workspaces.intelligence.inheritGlobal')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inherit">{t('workspaces.intelligence.inheritGlobal')}</SelectItem>
                                    {models.map(model => (
                                        <SelectItem key={model.id || 'unknown'} value={model.id || 'unknown'}>{model.name || model.id || t('common.unknown')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('workspaces.intelligence.discussModel')}</Label>
                            <Select 
                                value={formData.intelligenceDiscussModelId || 'inherit'} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, intelligenceDiscussModelId: val === 'inherit' ? '' : val }))}
                            >
                                <SelectTrigger className="bg-background/50">
                                    <SelectValue placeholder={t('workspaces.intelligence.inheritGlobal')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inherit">{t('workspaces.intelligence.inheritGlobal')}</SelectItem>
                                    {models.map(model => (
                                        <SelectItem key={model.id || 'unknown'} value={model.id || 'unknown'}>{model.name || model.id || 'Unknown'}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <Label>{t('workspaces.intelligence.temperature')} ({formData.intelligenceTemperature})</Label>
                        </div>
                        <Slider
                            value={[formData.intelligenceTemperature]}
                            min={0}
                            max={1}
                            step={0.1}
                            onValueChange={([val]) => setFormData(prev => ({ ...prev, intelligenceTemperature: val }))}
                            className="py-2"
                        />
                        <div className="flex justify-between text-xxs text-muted-foreground font-mono">
                            <span>{t('workspaces.intelligence.precise')}</span>
                            <span>{t('workspaces.intelligence.creative')}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('workspaces.intelligence.systemPrompt')}</CardTitle>
                    </div>
                    <CardDescription>{t('workspaces.intelligence.systemPromptDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Textarea
                        placeholder={t('workspaces.intelligence.systemPromptPlaceholder')}
                        className="min-h-32 bg-background/50 font-mono text-sm leading-relaxed"
                        value={formData.intelligenceSystemPrompt}
                        onChange={(e) => setFormData(prev => ({ ...prev, intelligenceSystemPrompt: e.target.value }))}
                    />
                </CardContent>
            </Card>
        </div>
    );
};
