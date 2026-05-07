/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState } from 'react';

export function useTerminalState() {
    const [isMaximizedLocal, setIsMaximizedLocal] = useState(false);
    const [isNewTerminalMenuOpen, setIsNewTerminalMenuOpen] = useState(false);
    const [terminalContextMenu, setTerminalContextMenu] = useState<{ x: number; y: number } | null>(
        null
    );
    const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
    const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isGalleryView, setIsGalleryView] = useState(false);
    const [isAppearanceMenuOpen, setIsAppearanceMenuOpen] = useState(false);
    const [isSemanticPanelOpen, setIsSemanticPanelOpen] = useState(false); 
    const [isRecordingPanelOpen, setIsRecordingPanelOpen] = useState(false);
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

    return {
        isMaximizedLocal,
        setIsMaximizedLocal,
        isNewTerminalMenuOpen,
        setIsNewTerminalMenuOpen,
        terminalContextMenu,
        setTerminalContextMenu,
        draggingTabId,
        setDraggingTabId,
        dragOverTabId,
        setDragOverTabId,
        isSearchOpen,
        setIsSearchOpen,
        isGalleryView,
        setIsGalleryView,
        isAppearanceMenuOpen,
        setIsAppearanceMenuOpen,
        isSemanticPanelOpen,
        setIsSemanticPanelOpen, 
        isRecordingPanelOpen,
        setIsRecordingPanelOpen,
        isAiPanelOpen,
        setIsAiPanelOpen,
    };
}

