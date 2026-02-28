import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { useProjectState } from '@/features/projects/hooks/useProjectState';
import { useWorkspaceManager } from '@/features/projects/hooks/useWorkspaceManager';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import type { WorkspaceEntry } from '@/types';

import { WorkspaceExplorer } from '../WorkspaceExplorer';

interface ProjectExplorerPanelProps {
    projectId: string;
    ps: ReturnType<typeof useProjectState>;
    wm: ReturnType<typeof useWorkspaceManager>;
    language: Language;
    onMove?: (entry: WorkspaceEntry, targetDirPath: string) => void;
}

/** Left-hand file explorer panel with drag-and-drop support. */
export function ProjectExplorerPanel({ projectId, ps, wm, language, onMove }: ProjectExplorerPanelProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
                delay: 250,
                tolerance: 5,
            },
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) {
            return;
        }

        const source = active.data.current as WorkspaceEntry;
        const target = over.data.current as { mountId: string; path: string; isDirectory: boolean };

        if (!source || !target?.isDirectory) {
            return;
        }
        if (source.mountId !== target.mountId) {
            return;
        }

        void onMove?.(source, target.path);
    };

    return (
        <div
            className={cn(
                'flex flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl shrink-0 transition-all duration-300 ease-smooth z-20',
                ps.sidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-72 opacity-100'
            )}
        >
            <div className="flex-1 overflow-hidden">
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <WorkspaceExplorer
                        projectId={projectId}
                        mounts={wm.mounts}
                        mountStatus={wm.mountStatus}
                        refreshSignal={wm.refreshSignal}
                        onOpenFile={(...args) => {
                            void wm.openFile(...args);
                        }}
                        onSelectEntry={(entry, e) => {
                            ps.setLastSelectedEntry(entry);

                            if (!e || (!e.ctrlKey && !e.metaKey && !e.shiftKey)) {
                                ps.setSelectedEntries([entry]);
                                return;
                            }

                            if (e.shiftKey && ps.lastSelectedEntry?.mountId === entry.mountId) {
                                ps.setSelectedEntries(prev => {
                                    const exists = prev.some(p => p.mountId === entry.mountId && p.path === entry.path);
                                    if (exists) {
                                        return prev;
                                    }
                                    return [...prev, entry];
                                });
                                return;
                            }

                            ps.setSelectedEntries(prev => {
                                const exists = prev.some(
                                    p => p.mountId === entry.mountId && p.path === entry.path
                                );
                                if (exists) {
                                    return prev.filter(
                                        p => !(p.mountId === entry.mountId && p.path === entry.path)
                                    );
                                }
                                return [...prev, entry];
                            });
                        }}
                        selectedEntries={ps.selectedEntries}
                        onAddMount={() => ps.setShowMountModal(true)}
                        onRemoveMount={(id: string) => {
                            void wm.persistMounts(wm.mounts.filter(m => m.id !== id));
                        }}
                        onEnsureMount={wm.ensureMountReady}
                        onContextAction={action => {
                            ps.setEntryModal({ type: action.type, entry: action.entry });
                            if (action.type !== 'delete') {
                                ps.setEntryName(action.entry.name);
                            }
                        }}
                        variant="panel"
                        language={language}
                        onMove={onMove}
                    />
                </DndContext>
            </div>
        </div>
    );
}
