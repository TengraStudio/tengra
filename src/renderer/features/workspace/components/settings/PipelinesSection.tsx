/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconPlayerPlay,IconTerminal } from '@tabler/icons-react';
import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { SettingsSectionProps } from './types';

export const PipelinesSection: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t
}) => {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Build Configuration */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <IconTerminal className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground ">
                            {t('frontend.workspaces.navigation.build')}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {t('frontend.workspace.buildDescription')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-11">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground/70 uppercase ">
                            {t('frontend.workspace.buildCommand')}
                        </Label>
                        <Input
                            value={formData.buildCommand}
                            onChange={(e) => setFormData({ ...formData, buildCommand: e.target.value })}
                            placeholder="npm run build"
                            className="bg-muted/10 border-border/10 focus:border-primary/30 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground/70 uppercase ">
                            {t('frontend.workspace.testCommand')}
                        </Label>
                        <Input
                            value={formData.testCommand}
                            onChange={(e) => setFormData({ ...formData, testCommand: e.target.value })}
                            placeholder="npm test"
                            className="bg-muted/10 border-border/10 focus:border-primary/30 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground/70 uppercase ">
                            {t('frontend.workspace.lintCommand')}
                        </Label>
                        <Input
                            value={formData.lintCommand}
                            onChange={(e) => setFormData({ ...formData, lintCommand: e.target.value })}
                            placeholder="npm run lint"
                            className="bg-muted/10 border-border/10 focus:border-primary/30 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground/70 uppercase ">
                            {t('frontend.workspace.outputDir')}
                        </Label>
                        <Input
                            value={formData.outputDir}
                            onChange={(e) => setFormData({ ...formData, outputDir: e.target.value })}
                            placeholder="dist"
                            className="bg-muted/10 border-border/10 focus:border-primary/30 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="h-px bg-border/5 ml-11" />

            {/* Dev Server Configuration */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10 text-success">
                        <IconPlayerPlay className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground ">
                            {t('frontend.workspaces.navigation.devServer')}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {t('frontend.workspace.devDescription')}
                        </p>
                    </div>
                </div>

                <div className="space-y-6 pl-11">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground/70 uppercase ">
                                {t('frontend.workspace.devCommand')}
                            </Label>
                            <Input
                                value={formData.devCommand}
                                onChange={(e) => setFormData({ ...formData, devCommand: e.target.value })}
                                placeholder="npm run dev"
                                className="bg-muted/10 border-border/10 focus:border-primary/30 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground/70 uppercase ">
                                {t('frontend.workspace.devPort')}
                            </Label>
                            <Input
                                type="number"
                                value={formData.devPort}
                                onChange={(e) => setFormData({ ...formData, devPort: parseInt(e.target.value) || 0 })}
                                placeholder="3000"
                                className="bg-muted/10 border-border/10 focus:border-primary/30 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/5 bg-muted/5 group hover:bg-muted/10 transition-all">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-medium text-foreground">
                                {t('frontend.workspace.devAutoStart')}
                            </Label>
                            <p className="text-sm text-muted-foreground/60">
                                {t('frontend.workspace.devAutoStartDescription')}
                            </p>
                        </div>
                        <Switch
                            checked={formData.devAutoStart}
                            onCheckedChange={(checked) => setFormData({ ...formData, devAutoStart: checked })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
