/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';
import { createPortal } from 'react-dom';

interface EditorTabContextMenuProps {
    position: { x: number; y: number };
    isPinned: boolean;
    canCloseAll: boolean;
    canCloseOthers: boolean;
    canCloseToRight: boolean;
    onPinToggle: () => void;
    onCloseTab: () => void;
    onCloseAll: () => void;
    onCloseToRight: () => void;
    onCloseOthers: () => void;
    onRevertTab: () => void;
    onCopyPath: () => void;
    onCopyRelativePath: () => void;
    onRevealInExplorer: () => void;
    onClose: () => void;
    t: (key: string) => string;
}

const MENU_ITEM_CLASS =
    'w-full text-left px-3 py-2 typo-caption transition-colors text-foreground hover:bg-accent/50 disabled:opacity-40 disabled:cursor-not-allowed';

export const EditorTabContextMenu: React.FC<EditorTabContextMenuProps> = ({
    position,
    isPinned,
    canCloseAll,
    canCloseOthers,
    canCloseToRight,
    onPinToggle,
    onCloseTab,
    onCloseAll,
    onCloseToRight,
    onCloseOthers,
    onRevertTab,
    onCopyPath,
    onCopyRelativePath,
    onRevealInExplorer,
    onClose,
    t,
}) =>
    createPortal(
        <div
            className="fixed min-w-220 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-2xl py-1 z-99999"
            style={{ left: position.x, top: position.y }}
            onMouseDown={event => event.stopPropagation()}
            onContextMenu={event => event.preventDefault()}
        >
            <button onClick={onPinToggle} className={MENU_ITEM_CLASS}>
                {isPinned ? t('frontend.workspace.unpinTab') : t('frontend.workspace.pinTab')}
            </button>
            <button onClick={onCloseTab} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.closeTab')}
            </button>
            <button onClick={onCloseAll} disabled={!canCloseAll} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.closeAllTabs')}
            </button>
            <button onClick={onCloseToRight} disabled={!canCloseToRight} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.closeTabsToRight')}
            </button>
            <button onClick={onCloseOthers} disabled={!canCloseOthers} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.closeOtherTabs')}
            </button>
            <div className="h-px bg-border/50 my-1 mx-2" />
            <button onClick={onRevertTab} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.revertTab')}
            </button>
            <div className="h-px bg-border/50 my-1 mx-2" />
            <button onClick={onCopyPath} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.copyPath')}
            </button>
            <button onClick={onCopyRelativePath} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.copyRelativePath')}
            </button>
            <button onClick={onRevealInExplorer} className={MENU_ITEM_CLASS}>
                {t('frontend.workspace.revealInExplorer')}
            </button>
            <div className="h-px bg-border/50 my-1 mx-2" />
            <button onClick={onClose} className={MENU_ITEM_CLASS}>
                {t('common.close')}
            </button>
        </div>,
        document.body
    );

