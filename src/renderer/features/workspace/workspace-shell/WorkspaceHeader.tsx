import { Archive, Download, LayoutGrid, List, Plus, Search, Trash2 } from 'lucide-react';
import React from 'react';

import { Language } from '@/i18n';

interface WorkspacesHeaderProps {
    title: string
    subtitle: string
    newWorkspaceLabel: string
    searchPlaceholder: string
    searchQuery: string
    setSearchQuery: (query: string) => void
    onNewWorkspace: () => void
    // Selection props
    selectedCount: number
    totalCount: number
    onToggleSelectAll: () => void
    onBulkDelete: () => void
    onBulkArchive: () => void
    viewMode: 'grid' | 'list'
    onViewModeChange: (mode: 'grid' | 'list') => void
    listPreset: string
    onListPresetChange: (preset: string) => void
    onExportList: () => void
    t: (key: string, options?: Record<string, string | number>) => string
    language: Language
}

export const WorkspacesHeader: React.FC<WorkspacesHeaderProps> = ({
    title, subtitle, newWorkspaceLabel, searchPlaceholder, searchQuery, setSearchQuery, onNewWorkspace,
    selectedCount, totalCount, onToggleSelectAll, onBulkDelete, onBulkArchive,
    viewMode, onViewModeChange, listPreset, onListPresetChange, onExportList, t
}) => {
    return (
        <>
            <div className="flex items-end justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-3xl font-light tracking-tight text-foreground flex items-center gap-4">
                        {title}
                    </h1>
                    <p className="text-muted-foreground mt-2 font-light">
                        {subtitle}
                    </p>
                </div>

                {selectedCount > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                        <span className="text-sm text-muted-foreground mr-2 font-light">
                            {t('common.itemsSelected', { count: selectedCount })}
                        </span>
                        <button
                            onClick={onBulkArchive}
                            className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted text-foreground rounded-lg transition-all text-sm font-medium border border-border/40"
                        >
                            <Archive className="w-4 h-4" />
                            {t('workspaces.bulkArchive')}
                        </button>
                        <button
                            onClick={onBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive text-destructive rounded-lg transition-all text-sm font-medium border border-destructive/20"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('workspaces.bulkDelete')}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onNewWorkspace}
                    className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-black/5"
                >
                    <Plus className="w-5 h-5" />
                    {newWorkspaceLabel}
                </button>

                {totalCount > 0 && (
                    <div className="flex items-center gap-2 ml-2">
                        <input
                            type="checkbox"
                            checked={selectedCount === totalCount && totalCount > 0}
                            onChange={onToggleSelectAll}
                            className="w-4 h-4 rounded border-border/40 bg-muted/30 text-foreground focus:ring-foreground/20 cursor-pointer"
                        />
                        <span className="text-sm font-light text-muted-foreground select-none cursor-pointer" onClick={onToggleSelectAll}>
                            {t('common.selectAll')}
                        </span>
                    </div>
                )}

                <div className="flex-1 relative group max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/30 border-none rounded-lg h-12 pl-11 pr-4 text-foreground focus:ring-1 focus:ring-foreground/20 transition-all placeholder:text-muted-foreground/40"
                    />
                </div>

                <div className="flex items-center gap-1 p-1 rounded-lg border border-border/40 bg-muted/20">
                    <select
                        value={listPreset}
                        onChange={e => onListPresetChange(e.target.value)}
                        className="h-9 rounded-md border border-border/40 bg-background/70 px-2 text-xs text-muted-foreground outline-none focus:border-primary/50"
                        title={t('workspace.listPresetTitle')}
                    >
                        <option value="recent">{t('workspace.listPresetRecent')}</option>
                        <option value="oldest">{t('workspace.listPresetOldest')}</option>
                        <option value="name-az">{t('workspace.listPresetNameAz')}</option>
                        <option value="name-za">{t('workspace.listPresetNameZa')}</option>
                    </select>
                    <button
                        onClick={onExportList}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        title={t('aria.exportList')}
                        aria-label={t('aria.exportList')}
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onViewModeChange('grid')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        title={t('aria.gridView')}
                        aria-label={t('aria.gridView')}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        title={t('aria.listView')}
                        aria-label={t('aria.listView')}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </>
    );
};

// Workspace alias for the new naming convention
export const WorkspaceHeader: React.FC<{
    title: string
    subtitle: string
    newWorkspaceLabel: string
    searchPlaceholder: string
    searchQuery: string
    setSearchQuery: (query: string) => void
    onNewWorkspace: () => void
    selectedCount: number
    totalCount: number
    onToggleSelectAll: () => void
    onBulkDelete: () => void
    onBulkArchive: () => void
    viewMode: 'grid' | 'list'
    onViewModeChange: (mode: 'grid' | 'list') => void
    listPreset: string
    onListPresetChange: (preset: string) => void
    onExportList: () => void
    t: (key: string, options?: Record<string, string | number>) => string
    language: Language
}> = ({ onNewWorkspace, ...props }) => (
    <WorkspacesHeader
        {...props}
        onNewWorkspace={onNewWorkspace}
    />
);
