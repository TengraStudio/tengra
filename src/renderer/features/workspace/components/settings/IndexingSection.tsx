/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDatabase, IconEyeOff, IconFileSearch } from '@tabler/icons-react';
import React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { SettingsSectionProps } from './types';

export const IndexingSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <IconDatabase className="w-6 h-6 text-primary" />
                    {t('frontend.workspaces.indexingTitle')}
                </h2>
                <p className="text-muted-foreground">
                    {t('frontend.workspaces.indexingDesc')}
                </p>
            </div>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <IconFileSearch className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('frontend.workspaces.indexingControl')}</CardTitle>
                    </div>
                    <CardDescription>{t('frontend.workspaces.indexingControlDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-border/20">
                        <div className="space-y-1">
                            <Label className="text-sm font-semibold">{t('frontend.workspaces.semanticIndexing')}</Label>
                            <p className="text-sm text-muted-foreground">
                                {t('frontend.workspaces.semanticIndexingDesc')}
                            </p>
                        </div>
                        <Switch 
                            checked={formData.indexingEnabled}
                            onCheckedChange={(val) => setFormData(prev => ({ ...prev, indexingEnabled: val }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('frontend.workspaces.maxFileSize')}</Label>
                        <Input 
                            type="number"
                            className="bg-background/50 font-mono"
                            value={formData.indexingMaxFileSize}
                            onChange={(e) => setFormData(prev => ({ ...prev, indexingMaxFileSize: parseInt(e.target.value) || 0 }))}
                        />
                        <p className="text-sm text-muted-foreground">
                            {t('frontend.workspaces.maxFileSizeDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <IconEyeOff className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('frontend.workspaces.exclusionPatterns')}</CardTitle>
                    </div>
                    <CardDescription>{t('frontend.workspaces.exclusionPatternsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Textarea 
                        placeholder="e.g. *.log, temp/**, vendor/**" 
                        className="bg-background/50 font-mono min-h-24"
                        value={formData.indexingExclude}
                        onChange={(e) => setFormData(prev => ({ ...prev, indexingExclude: e.target.value }))}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                        {t('frontend.workspaces.globPatternsHint')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
