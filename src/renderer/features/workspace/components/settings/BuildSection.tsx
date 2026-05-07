/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCode, IconSearch, IconSettings2, IconShield } from '@tabler/icons-react';
import React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { SettingsSectionProps } from './types';

export const BuildSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <IconCode className="w-6 h-6 text-primary" />
                {t('frontend.workspaces.build')}
            </h2>
            <p className="text-muted-foreground">{t('frontend.workspaces.buildDesc')}</p>
        </div>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                    <IconSettings2 className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-semibold">{t('frontend.workspaces.buildPipelines')}</CardTitle>
                </div>
                <CardDescription>{t('frontend.workspaces.buildPipelinesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('frontend.workspaces.buildCommand')}</Label>
                    <div className="relative">
                        <IconCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                        <Input
                            type="text"
                            value={formData.buildCommand}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData(prev => ({ ...prev, buildCommand: e.target.value }))
                            }
                            className="pl-9 bg-background/50 font-mono"
                            placeholder={t('frontend.placeholder.buildCommand')}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('frontend.workspaces.testCommand')}</Label>
                        <div className="relative">
                            <IconShield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                            <Input
                                type="text"
                                value={formData.testCommand}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setFormData(prev => ({ ...prev, testCommand: e.target.value }))
                                }
                                className="pl-9 bg-background/50 font-mono"
                                placeholder={t('frontend.placeholder.testCommand')}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('frontend.workspaces.lintCommand')}</Label>
                        <div className="relative">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                            <Input
                                type="text"
                                value={formData.lintCommand}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setFormData(prev => ({ ...prev, lintCommand: e.target.value }))
                                }
                                className="pl-9 bg-background/50 font-mono"
                                placeholder={t('frontend.placeholder.lintCommand')}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold">{t('frontend.workspaces.envAndAssets')}</CardTitle>
                <CardDescription>{t('frontend.workspaces.envAndAssetsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('frontend.workspaces.outputDir')}</Label>
                    <Input
                        type="text"
                        value={formData.outputDir}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, outputDir: e.target.value }))
                        }
                        className="bg-background/50 font-mono"
                        placeholder={t('frontend.placeholder.outputDir')}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('frontend.workspaces.envFile')}</Label>
                    <Input
                        type="text"
                        value={formData.envFile}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, envFile: e.target.value }))
                        }
                        className="bg-background/50 font-mono"
                        placeholder={t('frontend.placeholder.envFile')}
                    />
                </div>
            </CardContent>
        </Card>
    </div>
);

