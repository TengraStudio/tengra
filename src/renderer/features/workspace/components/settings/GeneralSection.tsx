/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Info } from 'lucide-react';
import React from 'react';

import { Workspace } from '@/types';

import { SettingsSectionProps } from './types';

export const GeneralSection: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Info className="w-6 h-6 text-primary" />
                {t('workspaces.basicInfo')}
            </h2>
            <p className="text-muted-foreground">{t('workspaces.basicInfoDesc')}</p>
        </div>

        <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold">{t('workspaces.workspaceDetails')}</CardTitle>
                <CardDescription>{t('workspaces.workspaceDetailsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('workspaces.workspaceTitle')}</Label>
                    <Input
                        type="text"
                        value={formData.title}
                        className="bg-background/50 focus-visible:ring-primary/30"
                        placeholder={t('workspaces.namePlaceholder')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, title: e.target.value }))
                        }
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('workspaces.description')}</Label>
                    <Textarea
                        value={formData.description}
                        className="min-h-24 bg-background/50 resize-none focus-visible:ring-primary/30"
                        placeholder={t('workspaces.descPlaceholder')}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setFormData(prev => ({ ...prev, description: e.target.value }))
                        }
                        rows={4}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('workspaces.status')}</Label>
                    <Select
                        value={formData.status}
                        onValueChange={(val: string) =>
                            setFormData(prev => ({ ...prev, status: val as Workspace['status'] }))
                        }
                    >
                        <SelectTrigger className="bg-background/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">{t('workspaces.statusActive')}</SelectItem>
                            <SelectItem value="archived">{t('workspaces.statusArchived')}</SelectItem>
                            <SelectItem value="draft">{t('workspaces.statusDraft')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    </div>
);
