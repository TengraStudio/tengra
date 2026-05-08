/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDeviceFloppy, IconRotate, IconSettings } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';

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
    <div className="px-6 py-4 border-b border-border/10 flex items-center justify-between shrink-0 bg-background/20">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/5 text-primary border border-primary/10">
                <IconSettings className="w-4 h-4" />
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground ">
                        {t('frontend.workspaces.workspaceSettings')}
                    </h2>
                    {isDirty && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" title={t('frontend.workspaces.unsavedChanges')} />
                    )}
                </div>
                <p className="text-sm text-muted-foreground/40 font-medium uppercase ">{workspaceTitle}</p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={!isDirty}
                className="h-8 text-sm font-medium text-muted-foreground/60 hover:text-foreground"
            >
                <IconRotate className="w-3.5 h-3.5 mr-1.5" />
                {t('common.reset')}
            </Button>
            <Button
                size="sm"
                onClick={onSave}
                disabled={!isDirty}
                className="h-8 px-4 text-sm font-semibold transition-all hover:bg-primary/90"
            >
                <IconDeviceFloppy className="w-3.5 h-3.5 mr-1.5" />
                {t('common.save')}
            </Button>
        </div>
    </div>
);

