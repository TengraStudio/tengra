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
import { GitBranch, RefreshCw, Type } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Label } from '@renderer/components/ui/label';
import { Input } from '@renderer/components/ui/input';
import { Switch } from '@renderer/components/ui/switch';
import { SettingsSectionProps } from './types';

export const GitSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <GitBranch className="w-6 h-6 text-primary" />
                    {t('workspaces.gitConfig')}
                </h2>
                <p className="text-muted-foreground">
                    {t('workspaces.gitConfigDesc')}
                </p>
            </div>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <Type className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('workspaces.commitSettings')}</CardTitle>
                    </div>
                    <CardDescription>{t('workspaces.commitSettingsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('workspaces.commitPrefix')}</Label>
                            <Input 
                                placeholder="e.g. [FEAT]" 
                                className="bg-background/50 font-mono"
                                value={formData.gitCommitPrefix}
                                onChange={(e) => setFormData(prev => ({ ...prev, gitCommitPrefix: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('workspaces.branchPrefix')}</Label>
                            <Input 
                                placeholder="e.g. feature/" 
                                className="bg-background/50 font-mono"
                                value={formData.gitBranchPrefix}
                                onChange={(e) => setFormData(prev => ({ ...prev, gitBranchPrefix: e.target.value }))}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('workspaces.gitHint')}
                    </p>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('workspaces.automation')}</CardTitle>
                    </div>
                    <CardDescription>{t('workspaces.automationDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between p-4 bg-background/40 rounded-xl border border-border/20">
                        <div className="space-y-1">
                            <Label className="text-sm font-semibold">{t('workspaces.autoFetch')}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t('workspaces.autoFetchDesc')}
                            </p>
                        </div>
                        <Switch 
                            checked={formData.gitAutoFetch}
                            onCheckedChange={(val) => setFormData(prev => ({ ...prev, gitAutoFetch: val }))}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
