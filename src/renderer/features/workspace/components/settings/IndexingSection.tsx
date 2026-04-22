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
import { Database, EyeOff, FileSearch } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Label } from '@renderer/components/ui/label';
import { Input } from '@renderer/components/ui/input';
import { Switch } from '@renderer/components/ui/switch';
import { Textarea } from '@renderer/components/ui/textarea';
import { SettingsSectionProps } from './types';

export const IndexingSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Database className="w-6 h-6 text-primary" />
                    {t('workspaces.indexingTitle')}
                </h2>
                <p className="text-muted-foreground">
                    {t('workspaces.indexingDesc')}
                </p>
            </div>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <FileSearch className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('workspaces.indexingControl')}</CardTitle>
                    </div>
                    <CardDescription>{t('workspaces.indexingControlDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-border/20">
                        <div className="space-y-1">
                            <Label className="text-sm font-semibold">{t('workspaces.semanticIndexing')}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t('workspaces.semanticIndexingDesc')}
                            </p>
                        </div>
                        <Switch 
                            checked={formData.indexingEnabled}
                            onCheckedChange={(val) => setFormData(prev => ({ ...prev, indexingEnabled: val }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('workspaces.maxFileSize')}</Label>
                        <Input 
                            type="number"
                            className="bg-background/50 font-mono"
                            value={formData.indexingMaxFileSize}
                            onChange={(e) => setFormData(prev => ({ ...prev, indexingMaxFileSize: parseInt(e.target.value) || 0 }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('workspaces.maxFileSizeDesc')}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('workspaces.exclusionPatterns')}</CardTitle>
                    </div>
                    <CardDescription>{t('workspaces.exclusionPatternsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Textarea 
                        placeholder="e.g. *.log, temp/**, vendor/**" 
                        className="bg-background/50 font-mono min-h-24"
                        value={formData.indexingExclude}
                        onChange={(e) => setFormData(prev => ({ ...prev, indexingExclude: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        {t('workspaces.globPatternsHint')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
