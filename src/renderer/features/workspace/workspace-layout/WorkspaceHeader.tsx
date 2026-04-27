/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconArchive, IconDownload, IconLayoutGrid, IconList, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';

const C_WORKSPACEHEADER_1 = "h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold flex items-center gap-2 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-102 active:scale-98";
const C_WORKSPACEHEADER_2 = "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10";

interface WorkspacesHeaderProps {
    title: string;
    subtitle: string;
    newWorkspaceLabel: string;
    searchPlaceholder: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onNewWorkspace: () => void;
    // Selection props
    selectedCount: number;
    totalCount: number;
    onToggleSelectAll: () => void;
    onBulkDelete: () => void;
    onBulkArchive: () => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    listPreset: string;
    onListPresetChange: (preset: string) => void;
    onExportList: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    language: Language;
}

export const WorkspacesHeader: React.FC<WorkspacesHeaderProps> = ({
    title,
    subtitle,
    newWorkspaceLabel,
    searchPlaceholder,
    searchQuery,
    setSearchQuery,
    onNewWorkspace,
    selectedCount,
    totalCount,
    onToggleSelectAll,
    onBulkDelete,
    onBulkArchive,
    viewMode,
    onViewModeChange,
    listPreset,
    onListPresetChange,
    onExportList,
    t,
}) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-end justify-between border-b border-border/10 pb-8">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold text-foreground drop-shadow-sm">
                        {title}
                    </h1>
                    <p className="text-muted-foreground/60 text-lg font-medium max-w-2xl">{subtitle}</p>
                </div>

                {selectedCount > 0 && (
                    <div className="flex items-center gap-3 p-1.5 rounded-2xl bg-muted/30 border border-border/20 shadow-xl animate-in fade-in slide-in-from-right-4 duration-300">
                        <span className="text-sm font-bold text-muted-foreground px-3">
                            {t('common.itemsSelected', { count: selectedCount })}
                        </span>
                        <div className="w-px h-6 bg-border/20" />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onBulkArchive}
                            className="flex items-center gap-2 hover:bg-success/10 hover:text-success rounded-xl font-bold"
                        >
                            <IconArchive className="w-4 h-4" />
                            {t('workspaces.bulkArchive')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onBulkDelete}
                            className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive rounded-xl font-bold"
                        >
                            <IconTrash className="w-4 h-4" />
                            {t('workspaces.bulkDelete')}
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <Button
                    onClick={onNewWorkspace}
                    className={C_WORKSPACEHEADER_1}
                >
                    <IconPlus className="w-5 h-5 stroke-2.5" />
                    {newWorkspaceLabel}
                </Button>

                <div className="flex-1 relative group">
                    <IconSearch className={C_WORKSPACEHEADER_2} />
                    <Input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSearchQuery(e.target.value)
                        }
                        className="h-11 pl-11 shadow-sm bg-muted/10 border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/40 focus:bg-background/80 transition-all"
                    />
                </div>

                <div className="flex items-center gap-1.5 p-1.5 rounded-xl border border-border/40 bg-muted/20">
                    {totalCount > 0 && (
                        <div className="flex items-center gap-2 px-3 mr-1 hover:bg-muted/30 transition-colors rounded-lg py-1 cursor-pointer">
                            <Checkbox
                                id="select-all"
                                checked={selectedCount === totalCount && totalCount > 0}
                                onCheckedChange={() => onToggleSelectAll()}
                                className="w-4 h-4 rounded shadow-none"
                            />
                            <Label
                                htmlFor="select-all"
                                className="text-sm font-bold text-muted-foreground/80 select-none cursor-pointer uppercase "
                            >
                                {t('common.selectAll')}
                            </Label>
                        </div>
                    )}
                    
                    <div className="w-px h-6 bg-border/20 mx-1" />

                    <Select value={listPreset} onValueChange={onListPresetChange}>
                        <SelectTrigger className="h-8 w-140 px-2 text-sm font-bold bg-background/50 border-none text-muted-foreground focus:ring-0 rounded-lg">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/40 shadow-2xl">
                            <SelectItem value="recent" className="text-sm font-medium focus:bg-primary/10">
                                {t('workspace.listPresetRecent')}
                            </SelectItem>
                            <SelectItem value="oldest" className="text-sm font-medium focus:bg-primary/10">
                                {t('workspace.listPresetOldest')}
                            </SelectItem>
                            <SelectItem value="name-az" className="text-sm font-medium focus:bg-primary/10">
                                {t('workspace.listPresetNameAz')}
                            </SelectItem>
                            <SelectItem value="name-za" className="text-sm font-medium focus:bg-primary/10">
                                {t('workspace.listPresetNameZa')}
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onExportList}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-all"
                        title={t('aria.exportList')}
                    >
                        <IconDownload className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-4 bg-border/20 mx-0.5" />

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewModeChange('grid')}
                        className={cn(
                            'h-8 w-8 transition-all rounded-lg',
                            viewMode === 'grid'
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background'
                        )}
                        title={t('aria.gridView')}
                    >
                        <IconLayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewModeChange('list')}
                        className={cn(
                            'h-8 w-8 transition-all rounded-lg',
                            viewMode === 'list'
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background'
                        )}
                        title={t('aria.listView')}
                    >
                        <IconList className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const WorkspaceHeader: React.FC<{
    title: string;
    subtitle: string;
    newWorkspaceLabel: string;
    searchPlaceholder: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onNewWorkspace: () => void;
    selectedCount: number;
    totalCount: number;
    onToggleSelectAll: () => void;
    onBulkDelete: () => void;
    onBulkArchive: () => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    listPreset: string;
    onListPresetChange: (preset: string) => void;
    onExportList: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    language: Language;
}> = ({ onNewWorkspace, ...props }) => (
    <WorkspacesHeader {...props} onNewWorkspace={onNewWorkspace} />
);
