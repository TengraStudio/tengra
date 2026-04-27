/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconFolderOpen, IconPlus, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Workspace } from '@/types';

interface WorkspaceSectionProps {
    workspace: Workspace
    onAddMount: () => void
    onRemoveMount: (id: string) => void
    onDelete?: () => void
    t: (key: string) => string
}

export const WorkspaceSection: React.FC<WorkspaceSectionProps> = ({
    workspace,
    onAddMount,
    onRemoveMount,
    onDelete,
    t,
}) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <IconFolderOpen className="w-6 h-6 text-primary" />
                    {t('workspaces.mounts')}
                </h2>
                <Button size="sm" variant="outline" onClick={onAddMount} className="gap-2">
                    <IconPlus className="w-4 h-4" />
                    {t('workspaces.addMount')}
                </Button>
            </div>
            <p className="text-muted-foreground">{t('workspaces.mountsDesc')}</p>
        </div>

        <div className="space-y-4">
            {workspace.mounts.map(mount => (
                <Card key={mount.id} className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 transition-all hover:border-primary/30 group">
                    <CardContent className="p-0">
                        <div className="flex items-center justify-between p-4 px-6">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-110">
                                    <IconFolderOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-foreground">{mount.name}</div>
                                    <div className="text-sm text-muted-foreground font-mono mt-0.5 truncate max-w-lg opacity-70 group-hover:opacity-100 transition-opacity">
                                        {mount.rootPath}
                                    </div>
                                </div>
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void onRemoveMount(mount.id)}
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                            >
                                <IconTrash className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {workspace.mounts.length === 0 && (
                <Card className="border-dashed border-2 bg-muted/5 py-12 flex flex-col items-center justify-center text-center">
                    <IconFolderOpen className="w-12 h-12 text-muted-foreground/20 mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">{t('workspaces.noMounts')}</p>
                    <Button onClick={onAddMount} variant="link" className="text-primary font-bold">
                        {t('workspace.addFirstMount')}
                    </Button>
                </Card>
            )}
        </div>

        <div className="pt-10">
            <h3 className="text-sm font-bold text-destructive uppercase mb-4 flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4" />
                {t('workspace.dangerZone')}
            </h3>
            <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
                <CardContent className="flex items-center justify-between p-6">
                    <div className="space-y-1">
                        <div className="text-sm font-bold text-foreground">
                            {t('workspaces.deleteWorkspace')}
                        </div>
                        <p className="text-sm text-muted-foreground max-w-md">
                            {t('workspaces.deleteWarning').trim()}
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        className="shadow-lg shadow-destructive/20 px-8 font-bold"
                        onClick={() => void onDelete?.()}
                    >
                        {t('common.delete')}
                    </Button>
                </CardContent>
            </Card>
        </div>
    </div>
);
