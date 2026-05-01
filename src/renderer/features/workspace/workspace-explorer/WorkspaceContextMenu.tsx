/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconFilePlus, IconFolderPlus, IconHistory, IconPencil, IconSquareArrowDown, IconSquareArrowUp, IconTrash } from '@tabler/icons-react';
import React from 'react';
import { createPortal } from 'react-dom';

import { ContextMenuAction, ContextMenuState } from './types';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACECONTEXTMENU_1 = "fixed bg-card/95 border border-border/50 rounded-xl shadow-2xl py-1.5 min-w-180 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl";
const C_WORKSPACECONTEXTMENU_2 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors";
const C_WORKSPACECONTEXTMENU_3 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors";
const C_WORKSPACECONTEXTMENU_4 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors";
const C_WORKSPACECONTEXTMENU_5 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors";
const C_WORKSPACECONTEXTMENU_6 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors";
const C_WORKSPACECONTEXTMENU_7 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors";
const C_WORKSPACECONTEXTMENU_8 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors";
const C_WORKSPACECONTEXTMENU_9 = "w-full flex items-center gap-3 px-3 py-2 typo-caption font-medium hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors";


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
            className={C_WORKSPACECONTEXTMENU_1}
            style={{
                left: contextMenu.x,
                top: contextMenu.y,
                zIndex: 'var(--tengra-z-99999)',
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
                    className={C_WORKSPACECONTEXTMENU_2}
                >
                    <IconTrash className="w-3.5 h-3.5" />
                    {t('frontend.workspace.removeMount')}
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
                                    className={C_WORKSPACECONTEXTMENU_3}
                                >
                                    <IconSquareArrowUp className="w-3.5 h-3.5" />
                                    {t('frontend.workspaceDashboard.stage')}
                                </button>
                            )}
                            {hasStagedChanges && (
                                <button
                                    onClick={() => onContextAction('unstage')}
                                    className={C_WORKSPACECONTEXTMENU_4}
                                >
                                    <IconSquareArrowDown className="w-3.5 h-3.5" />
                                    {t('frontend.workspaceDashboard.unstage')}
                                </button>
                            )}
                            <button
                                onClick={() => onContextAction('gitHistory')}
                                className={C_WORKSPACECONTEXTMENU_5}
                            >
                                <IconHistory className="w-3.5 h-3.5" />
                                {t('frontend.agent.history')}
                            </button>
                            <div className="h-px bg-border/50 my-1 mx-2" />
                        </>
                    )}
                    {contextMenu.entry.isDirectory && (
                        <>
                            <button
                                onClick={() => onContextAction('createFile')}
                                className={C_WORKSPACECONTEXTMENU_6}
                            >
                                <IconFilePlus className="w-3.5 h-3.5" />
                                {t('frontend.workspace.newFile')}
                            </button>
                            <button
                                onClick={() => onContextAction('createFolder')}
                                className={C_WORKSPACECONTEXTMENU_7}
                            >
                                <IconFolderPlus className="w-3.5 h-3.5" />
                                {t('frontend.workspace.newFolder')}
                            </button>
                            <div className="h-px bg-border/50 my-1 mx-2" />
                        </>
                    )}
                    <button
                        onClick={() => onContextAction('rename')}
                        className={C_WORKSPACECONTEXTMENU_8}
                    >
                        <IconPencil className="w-3.5 h-3.5" />
                        {t('frontend.workspace.rename')}
                    </button>
                    <button
                        onClick={() => onContextAction('delete')}
                        className={C_WORKSPACECONTEXTMENU_9}
                    >
                        <IconTrash className="w-3.5 h-3.5" />
                        {t('common.delete')}
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};
