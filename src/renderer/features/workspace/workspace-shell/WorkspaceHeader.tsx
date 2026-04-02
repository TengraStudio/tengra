import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Language } from '@renderer/i18n';
import {
    Archive,
    Download,
    LayoutGrid,
    List,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import React from 'react';

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
        <>
            <div className="flex items-end justify-between border-b border-border/40 pb-6">
                <div>
                    <h1 className="text-3xl font-light text-foreground flex items-center gap-4">
                        {title}
                    </h1>
                    <p className="text-muted-foreground mt-2 font-light">{subtitle}</p>
                </div>

                {selectedCount > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                        <span className="text-sm text-muted-foreground mr-2 font-light">
                            {t('common.itemsSelected', { count: selectedCount })}
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onBulkArchive}
                            className="flex items-center gap-2"
                        >
                            <Archive className="w-4 h-4" />
                            {t('workspaces.bulkArchive')}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={onBulkDelete}
                            className="flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('workspaces.bulkDelete')}
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <Button
                    onClick={onNewWorkspace}
                    className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 font-medium flex items-center gap-2 shadow-lg shadow-black/5"
                >
                    <Plus className="w-5 h-5" />
                    {newWorkspaceLabel}
                </Button>

                {totalCount > 0 && (
                    <div className="flex items-center gap-2 ml-2">
                        <Checkbox
                            id="select-all"
                            checked={selectedCount === totalCount && totalCount > 0}
                            onCheckedChange={() => onToggleSelectAll()}
                        />
                        <Label
                            htmlFor="select-all"
                            className="text-sm font-light text-muted-foreground select-none cursor-pointer"
                        >
                            {t('common.selectAll')}
                        </Label>
                    </div>
                )}

                <div className="flex-1 relative group max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors z-10" />
                    <Input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSearchQuery(e.target.value)
                        }
                        className="h-12 pl-11 shadow-none bg-muted/30 border-transparent focus-visible:ring-1 focus-visible:ring-foreground/20"
                    />
                </div>

                <div className="flex items-center gap-1 p-1 rounded-lg border border-border/40 bg-muted/20">
                    <Select value={listPreset} onValueChange={onListPresetChange}>
                        <SelectTrigger className="h-9 w-[140px] px-2 text-xs bg-background/70 border-border/40 text-muted-foreground focus:ring-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="recent">
                                {t('workspace.listPresetRecent')}
                            </SelectItem>
                            <SelectItem value="oldest">
                                {t('workspace.listPresetOldest')}
                            </SelectItem>
                            <SelectItem value="name-az">
                                {t('workspace.listPresetNameAz')}
                            </SelectItem>
                            <SelectItem value="name-za">
                                {t('workspace.listPresetNameZa')}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onExportList}
                        className="p-2 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        title={t('aria.exportList')}
                    >
                        <Download className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewModeChange('grid')}
                        className={`p-2 h-9 w-9 transition-colors ${
                            viewMode === 'grid'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title={t('aria.gridView')}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewModeChange('list')}
                        className={`p-2 h-9 w-9 transition-colors ${
                            viewMode === 'list'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title={t('aria.listView')}
                    >
                        <List className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </>
    );
};

// Workspace alias for the new naming convention
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


