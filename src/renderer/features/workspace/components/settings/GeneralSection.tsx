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
import { Info } from 'lucide-react';
import React from 'react';

import { Workspace } from '@/types';

import { SettingsSectionProps } from './types';

export const GeneralSection: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div>
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                {t('workspaces.basicInfo')}
            </h3>
            <p className="typo-caption text-muted-foreground">{t('workspaces.basicInfoDesc')}</p>
        </div>

        <div className="space-y-4">
            <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('workspaces.workspaceTitle')}</Label>
                <Input
                    type="text"
                    value={formData.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData(prev => ({ ...prev, title: e.target.value }))
                    }
                />
            </div>
            <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('workspaces.description')}</Label>
                <Textarea
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFormData(prev => ({ ...prev, description: e.target.value }))
                    }
                    rows={4}
                    className="resize-none"
                />
            </div>
            <div className="grid gap-2">
                <Label className="text-muted-foreground">{t('workspaces.status')}</Label>
                <Select
                    value={formData.status}
                    onValueChange={(val: string) =>
                        setFormData(prev => ({ ...prev, status: val as Workspace['status'] }))
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">{t('workspaces.statusActive')}</SelectItem>
                        <SelectItem value="archived">{t('workspaces.statusArchived')}</SelectItem>
                        <SelectItem value="draft">{t('workspaces.statusDraft')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    </section>
);



