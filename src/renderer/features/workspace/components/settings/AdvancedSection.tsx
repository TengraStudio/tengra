/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBolt,IconDatabase, IconEyeOff, IconFileSearch } from '@tabler/icons-react';
import React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { SettingsSectionProps } from './types';

export const AdvancedSection: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <IconDatabase className="w-6 h-6 text-primary" />
                {t('workspaces.advancedEngine')}
            </h2>
            <p className="text-muted-foreground">
                {t('workspaces.advancedEngineDesc')}
            </p>
        </div>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                    <IconFileSearch className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-semibold">{t('workspaces.indexingControl')}</CardTitle>
                </div>
                <CardDescription>{t('workspaces.indexingControlDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-border/20">
                    <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('workspaces.semanticIndexing')}</Label>
                        <p className="text-sm text-muted-foreground">
                            {t('workspaces.semanticIndexingDesc')}
                        </p>
                    </div>
                    <Switch
                        checked={formData.indexingEnabled}
                        onCheckedChange={checked =>
                            setFormData(prev => ({ ...prev, indexingEnabled: checked }))
                        }
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('workspaces.maxFileSize')}</Label>
                        <Input
                            type="number"
                            value={formData.indexingMaxFileSize}
                            className="bg-background/50 font-mono"
                            onChange={e =>
                                setFormData(prev => ({ ...prev, indexingMaxFileSize: parseInt(e.target.value) || 0 }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('workspaces.maxConcurrency')}</Label>
                        <Input
                            type="number"
                            min={1}
                            max={16}
                            value={formData.indexingMaxConcurrency}
                            className="bg-background/50 font-mono"
                            onChange={e =>
                                setFormData(prev => ({ ...prev, indexingMaxConcurrency: parseInt(e.target.value) || 4 }))
                            }
                        />
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                    <IconEyeOff className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-semibold">{t('workspaces.exclusionPatterns')}</CardTitle>
                </div>
                <CardDescription>{t('workspaces.exclusionPatternsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Textarea
                    placeholder={t('workspaces.exclusionPatternsPlaceholder')}
                    value={formData.indexingExclude}
                    className="min-h-24 bg-background/50 font-mono text-sm"
                    onChange={e =>
                        setFormData(prev => ({ ...prev, indexingExclude: e.target.value }))
                    }
                />
            </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                    <IconBolt className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-semibold">{t('workspaces.dynamicFeatures')}</CardTitle>
                </div>
                <CardDescription>{t('workspaces.dynamicFeaturesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-border/20">
                    <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('workspaces.fileWatcher')}</Label>
                        <p className="text-sm text-muted-foreground">{t('workspaces.fileWatcherDesc')}</p>
                    </div>
                    <Switch
                        checked={formData.fileWatchEnabled}
                        onCheckedChange={checked =>
                            setFormData(prev => ({ ...prev, fileWatchEnabled: checked }))
                        }
                    />
                </div>

                <div className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-border/20">
                    <div className="space-y-1">
                        <Label className="text-sm font-semibold">{t('workspaces.autoSaveLabel')}</Label>
                        <p className="text-sm text-muted-foreground">{t('workspaces.autoSaveDesc')}</p>
                    </div>
                    <Switch
                        checked={formData.autoSave}
                        onCheckedChange={checked =>
                            setFormData(prev => ({ ...prev, autoSave: checked }))
                        }
                    />
                </div>
            </CardContent>
        </Card>
    </div>
);
