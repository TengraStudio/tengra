import type { TerminalTab } from '@/types';

import { TerminalPanelContentImpl } from './TerminalPanelImpl';

import '@xterm/xterm/css/xterm.css';

export interface TerminalPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    isMaximized?: boolean;
    onMaximizeChange?: (isMaximized: boolean) => void;
    workspaceId?: string;
    workspacePath?: string;
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
