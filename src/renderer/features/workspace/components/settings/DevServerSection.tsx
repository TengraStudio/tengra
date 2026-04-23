/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';
import { Play, Power, Server } from 'lucide-react';
import React from 'react';

import { SettingsSectionProps } from './types';

export const DevServerSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Server className="w-6 h-6 text-primary" />
                {t('workspaces.devServer')}
            </h2>
            <p className="text-muted-foreground">{t('workspaces.devServerDesc')}</p>
        </div>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                <div className="flex items-center gap-2">
                    <Power className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base font-semibold">{t('workspaces.serverRuntime')}</CardTitle>
                </div>
                <CardDescription>{t('workspaces.devServerDescShort')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('workspaces.startCommand')}</Label>
                    <div className="relative">
                        <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                        <Input
                            type="text"
                            value={formData.devCommand}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData(prev => ({ ...prev, devCommand: e.target.value }))
                            }
                            className="pl-9 bg-background/50 font-mono"
                            placeholder={t('placeholder.devCommand')}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">{t('workspaces.port')}</Label>
                        <Input
                            type="number"
                            value={formData.devPort}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData(prev => ({
                                    ...prev,
                                    devPort: parseInt(e.target.value, 10) || 3000,
                                }))
                            }
                            className="bg-background/50 font-mono"
                            placeholder={t('placeholder.portNumber')}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 px-4 bg-background/40 rounded-xl border border-border/20 self-end h-40">
                        <Label className="text-sm font-medium translate-y-1px">{t('workspaces.autoStart')}</Label>
                        <Switch
                            checked={formData.devAutoStart}
                            onCheckedChange={(checked) =>
                                setFormData(prev => ({ ...prev, devAutoStart: checked }))
                            }
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
);
