import { FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-react';
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
    t
}) => {
    return createPortal(
        <div
            className="fixed bg-card/95 border border-border/50 rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
            style={{
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 99999
            }}
            onClick={(e) => e.stopPropagation()}
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
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-destructive/10 text-destructive hover:text-red-300 transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('workspace.removeMount')}
                </button>
            )}

            {/* File/Folder context menu */}
            {contextMenu.entry && (
                <>
                    {contextMenu.entry.isDirectory && (
                        <>
                            <button
                                onClick={() => onContextAction('createFile')}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <FilePlus className="w-3.5 h-3.5" />
                                {t('workspace.newFile')}
                            </button>
                            <button
                                onClick={() => onContextAction('createFolder')}
                                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <FolderPlus className="w-3.5 h-3.5" />
                                {t('workspace.newFolder')}
                            </button>
                            <div className="h-px bg-border/50 my-1 mx-2" />
                        </>
                    )}
                    <button
                        onClick={() => onContextAction('rename')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        {t('workspace.rename')}
                    </button>
                    <button
                        onClick={() => onContextAction('delete')}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-destructive/10 text-destructive hover:text-red-300 transition-colors"
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
