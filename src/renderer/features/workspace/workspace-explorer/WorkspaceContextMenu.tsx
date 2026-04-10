import { FilePlus, FolderPlus, History, Pencil, SquareArrowDown, SquareArrowUp, Trash2 } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';

import { ContextMenuAction, ContextMenuState } from './types';

interface WorkspaceContextMenuProps {
    contextMenu: ContextMenuState;
    onClose: () => void;
    onRemoveMount: (id: string) => void;
    onContextAction: (type: ContextMenuAction['type']) => void;
    t: (key: string) => string;
}

export const WorkspaceContextMenu: React.FC<WorkspaceContextMenuProps> = ({
    contextMenu,
    onClose,
    onRemoveMount,
    onContextAction,
    t,
}) => {
    const hasGitEntryContext =
        contextMenu.entry &&
        contextMenu.entryMountType === 'local' &&
        typeof contextMenu.entryGitStatus === 'string';
    const rawGitStatus = contextMenu.entryGitRawStatus ?? '';
    const hasStagedChanges =
        rawGitStatus.length >= 1 &&
        rawGitStatus[0] !== ' ' &&
        rawGitStatus[0] !== '?';
    const hasUnstagedChanges =
        rawGitStatus === '??' ||
        (rawGitStatus.length >= 2 && rawGitStatus[1] !== ' ');

    return createPortal(
        <div
            className="fixed bg-card/95 border border-border/50 rounded-xl shadow-2xl py-1.5 tw-min-w-180 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
            style={{
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 99999,
            }}
            onClick={e => e.stopPropagation()}
        >
            {/* Mount-level context menu */}
            {contextMenu.mountId && !contextMenu.entry && (
                <button
                    onClick={() => {
                        if (contextMenu.mountId) {
                            onRemoveMount(contextMenu.mountId);
                        }
                        onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('workspace.removeMount')}
                </button>
            )}

            {/* File/Folder context menu */}
            {contextMenu.entry && (
                <>
                    {hasGitEntryContext && (
                        <>
                            {(hasUnstagedChanges || !hasStagedChanges) && (
                                <button
                                    onClick={() => onContextAction('stage')}
                                    className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <SquareArrowUp className="w-3.5 h-3.5" />
                                    {t('workspaceDashboard.stage')}
                                </button>
                            )}
                            {hasStagedChanges && (
                                <button
                                    onClick={() => onContextAction('unstage')}
                                    className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <SquareArrowDown className="w-3.5 h-3.5" />
                                    {t('workspaceDashboard.unstage')}
                                </button>
                            )}
                            <button
                                onClick={() => onContextAction('gitHistory')}
                                className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <History className="w-3.5 h-3.5" />
                                {t('agent.history')}
                            </button>
                            <div className="h-px bg-border/50 my-1 mx-2" />
                        </>
                    )}
                    {contextMenu.entry.isDirectory && (
                        <>
                            <button
                                onClick={() => onContextAction('createFile')}
                                className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <FilePlus className="w-3.5 h-3.5" />
                                {t('workspace.newFile')}
                            </button>
                            <button
                                onClick={() => onContextAction('createFolder')}
                                className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <FolderPlus className="w-3.5 h-3.5" />
                                {t('workspace.newFolder')}
                            </button>
                            <div className="h-px bg-border/50 my-1 mx-2" />
                        </>
                    )}
                    <button
                        onClick={() => onContextAction('rename')}
                        className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        {t('workspace.rename')}
                    </button>
                    <button
                        onClick={() => onContextAction('delete')}
                        className="w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete')}
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};
