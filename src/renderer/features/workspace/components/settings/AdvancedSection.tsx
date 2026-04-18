/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CheckedState } from '@radix-ui/react-checkbox';
import { Checkbox } from '@renderer/components/ui/checkbox';
import React from 'react';

import { SettingsSectionProps } from './types';

export const AdvancedSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('workspaces.advanced')}</h3>
            <p className="text-sm text-muted-foreground">{t('workspaces.advancedDesc')}</p>
        </div>

        <div className="space-y-4">
            <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-foreground">
                            {t('workspaces.fileWatching')}
                        </div>
                        <div className="typo-caption text-muted-foreground">
                            {t('workspaces.fileWatchingDesc')}
                        </div>
                    </div>
                    <Checkbox
                        checked={formData.fileWatchEnabled}
                        onCheckedChange={(checked: CheckedState) =>
                            setFormData(prev => ({ ...prev, fileWatchEnabled: checked === true }))
                        }
                    />
                </div>
            </div>

            <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-foreground">
                            {t('workspaces.indexing')}
                        </div>
                        <div className="typo-caption text-muted-foreground">
                            {t('workspaces.indexingDesc')}
                        </div>
                    </div>
                    <Checkbox
                        checked={formData.indexingEnabled}
                        onCheckedChange={(checked: CheckedState) =>
                            setFormData(prev => ({ ...prev, indexingEnabled: checked === true }))
                        }
                    />
                </div>
            </div>

            <div className="p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-foreground">
                            {t('workspaces.autoSave')}
                        </div>
                        <div className="typo-caption text-muted-foreground">
                            {t('workspaces.autoSaveDesc')}
                        </div>
                    </div>
                    <Checkbox
                        checked={formData.autoSave}
                        onCheckedChange={(checked: CheckedState) =>
                            setFormData(prev => ({ ...prev, autoSave: checked === true }))
                        }
                    />
                </div>
            </div>
        </div>
    </div>
);


