/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { RotateCcw, Save, Settings } from 'lucide-react';
import React from 'react';

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
    <div className="px-8 py-5 border-b border-border/40 flex items-center justify-between shrink-0 bg-background/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground tracking-tight">
                        {t('workspaces.workspaceSettings')}
                    </h2>
                    {isDirty && (
                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-10 py-0 px-2 animate-pulse">
                            {t('workspaces.unsavedChanges')}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{workspaceTitle}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={!isDirty}
                className="gap-2 text-muted-foreground hover:text-foreground"
            >
                <RotateCcw className="w-4 h-4" />
                {t('common.reset')}
            </Button>
            <Button
                size="sm"
                onClick={onSave}
                disabled={!isDirty}
                className="gap-2 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            >
                <Save className="w-4 h-4" />
                {t('common.save')}
            </Button>
        </div>
    </div>
);
