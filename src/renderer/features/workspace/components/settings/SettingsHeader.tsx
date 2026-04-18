/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { RotateCcw, Save, Settings } from 'lucide-react';
import React from 'react';

/* Batch-02: Extracted Long Classes */
const C_SETTINGSHEADER_1 = "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted/40 transition-colors disabled:opacity-30";
const C_SETTINGSHEADER_2 = "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20";


interface SettingsHeaderProps {
    t: (key: string) => string;
    workspaceTitle: string;
    isDirty: boolean;
    onReset: () => void;
    onSave: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
    t,
    workspaceTitle,
    isDirty,
    onReset,
    onSave,
}) => (
    <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Settings className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-foreground">
                    {t('workspaces.workspaceSettings')}
                </h2>
                <p className="typo-caption text-muted-foreground">{workspaceTitle}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <button
                onClick={onReset}
                disabled={!isDirty}
                className={C_SETTINGSHEADER_1}
            >
                <RotateCcw className="w-4 h-4" />
                {t('common.reset')}
            </button>
            <button
                onClick={onSave}
                disabled={!isDirty}
                className={C_SETTINGSHEADER_2}
            >
                <Save className="w-4 h-4" />
                {t('common.save')}
            </button>
        </div>
    </div>
);
