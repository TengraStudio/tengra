/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { TerminalTab } from '@/types';

import { TerminalPanelContentImpl } from './TerminalPanelImpl';


export interface TerminalPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    isMaximized?: boolean;
    onMaximizeChange?: (isMaximized: boolean) => void;
    workspaceId?: string;
    workspacePath?: string;
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: 'code' | 'image' | 'diff';
    tabs: TerminalTab[];
    activeTabId: string | null;
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
    onOpenFile?: (path: string, line?: number) => void;
}

/** Thin wrapper that delegates to TerminalPanelContentImpl */
export function TerminalPanel(props: TerminalPanelProps) {
    return <TerminalPanelContentImpl {...props} />;
}

