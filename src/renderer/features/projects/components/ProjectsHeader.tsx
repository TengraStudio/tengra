import { Archive, Plus, Search, Trash2 } from 'lucide-react';
import React from 'react';

interface ProjectsHeaderProps {
    title: string
    subtitle: string
    newProjectLabel: string
    searchPlaceholder: string
    searchQuery: string
    setSearchQuery: (query: string) => void
    onNewProject: () => void
    // Selection props
    selectedCount: number
    totalCount: number
    onToggleSelectAll: () => void
    onBulkDelete: () => void
    onBulkArchive: () => void
    t: (key: string) => string
}

export const ProjectsHeader: React.FC<ProjectsHeaderProps> = ({
    title, subtitle, newProjectLabel, searchPlaceholder, searchQuery, setSearchQuery, onNewProject,
    selectedCount, totalCount, onToggleSelectAll, onBulkDelete, onBulkArchive, t
}) => {
    return (
        <>
            <div className="flex items-end justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-3xl font-light tracking-tight text-foreground">
                        {title}
                    </h1>
                    <p className="text-muted-foreground mt-2 font-light">
                        {subtitle}
                    </p>
                </div>

                {selectedCount > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                        <span className="text-sm text-muted-foreground mr-2 font-light">
                            {t('common.itemsSelected').replace('{{count}}', selectedCount.toString())}
                        </span>
                        <button
                            onClick={onBulkArchive}
                            className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted text-foreground rounded-lg transition-all text-sm font-medium border border-border/40"
                        >
                            <Archive className="w-4 h-4" />
                            {t('projects.bulkArchive')}
                        </button>
                        <button
                            onClick={onBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive text-destructive rounded-lg transition-all text-sm font-medium border border-destructive/20"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('projects.bulkDelete')}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={onNewProject}
                    className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-black/5"
                >
                    <Plus className="w-5 h-5" />
                    {newProjectLabel}
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
            </div>
        </>
    );
};
