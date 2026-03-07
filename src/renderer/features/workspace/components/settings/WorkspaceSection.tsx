import { FolderTree, Plus, Trash2 } from 'lucide-react';
import React from 'react';

import { Project } from '@/types';

interface WorkspaceSectionProps {
    project: Project
    onAddMount: () => void
    onRemoveMount: (id: string) => void
    t: (key: string) => string
}

export const WorkspaceSection: React.FC<WorkspaceSectionProps> = ({ project, onAddMount, onRemoveMount, t }) => (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-primary" />
                    {t('workspaces.mounts') || 'Workspace Mounts'}
                </h3>
                <p className="text-xs text-muted-foreground">{t('workspaces.mountsDesc') || 'Manage folders and remote connections for this project.'}</p>
            </div>
            <button
                onClick={onAddMount}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-muted/20 hover:bg-muted/30 border border-border/50 transition-all text-foreground"
            >
                <Plus className="w-4 h-4" />
                {t('workspaces.addMount') || 'Add Mount'}
            </button>
        </div>

        <div className="space-y-3">
            {project.mounts.map(mount => (
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

            {project.mounts.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-muted/20 rounded-xl border border-dashed border-border/50 p-6">
                    <FolderTree className="w-12 h-12 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('workspaces.noMounts') || 'No mounts found for this project.'}</p>
                    <button
                        onClick={onAddMount}
                        className="mt-4 text-primary text-sm hover:underline font-medium"
                    >
                        Add the first mount
                    </button>
                </div>
            )}
        </div>
    </section>
);
