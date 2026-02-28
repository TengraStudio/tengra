import { TerminalPanelContentImpl } from './TerminalPanelImpl';

import type { TerminalTab } from '@/types';

import 'xterm/css/xterm.css';

export interface TerminalPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    isMaximized?: boolean;
    onMaximizeChange?: (isMaximized: boolean) => void;
    isFloating?: boolean;
    onFloatingChange?: (isFloating: boolean) => void;
    projectId?: string;
    projectPath?: string;
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