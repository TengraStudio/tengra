import { FolderTree, Plus, Trash2 } from 'lucide-react';
import React from 'react';

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
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-primary" />
                    {t('workspaces.mounts')}
                </h3>
                <p className="text-xs text-muted-foreground">{t('workspaces.mountsDesc')}</p>
            </div>
            <button
                onClick={onAddMount}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-muted/20 hover:bg-muted/30 border border-border/50 transition-all text-foreground"
            >
                <Plus className="w-4 h-4" />
                {t('workspaces.addMount')}
            </button>
        </div>

        <div className="space-y-3">
            {workspace.mounts.map(mount => (
                <div
                    key={mount.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <FolderTree className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-foreground">{mount.name}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate max-w-md">{mount.rootPath}</div>
                        </div>
                    </div>
                    <button
                        onClick={() => void onRemoveMount(mount.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}

            {workspace.mounts.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-muted/20 rounded-xl border border-dashed border-border/50 p-6">
                    <FolderTree className="w-12 h-12 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('workspaces.noMounts')}</p>
                    <button
                        onClick={onAddMount}
                        className="mt-4 text-primary text-sm hover:underline font-medium"
                    >
                        {t('workspace.addFirstMount')}
                    </button>
                </div>
            )}
        </div>

        <div className="pt-6 border-t border-destructive/20">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-destructive">
                <Trash2 className="h-4 w-4" />
                {t('workspace.dangerZone')}
            </h3>
            <div className="flex items-center justify-between rounded-xl border border-destructive/10 bg-destructive/5 p-4">
                <div>
                    <div className="text-sm font-semibold text-foreground">
                        {t('workspaces.deleteWorkspace')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {t('workspaces.deleteWarning').trim()}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        void onDelete?.();
                    }}
                    className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                    {t('common.delete')}
                </button>
            </div>
        </div>
    </section>
);
