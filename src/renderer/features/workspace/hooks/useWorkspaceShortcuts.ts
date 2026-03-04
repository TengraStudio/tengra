import { useWorkspaceManager } from '@renderer/features/workspace/hooks/useWorkspaceManager';
import React from 'react';

const FLOATING_TERMINAL_DEFAULT_HEIGHT = 320;

interface UseWorkspaceShortcutsParams {
    wm: ReturnType<typeof useWorkspaceManager>;
    setShowShortcutHelp: React.Dispatch<React.SetStateAction<boolean>>;
    setShowQuickSwitch: React.Dispatch<React.SetStateAction<boolean>>;
    setQuickSwitchQuery: React.Dispatch<React.SetStateAction<string>>;
    setQuickSwitchIndex: React.Dispatch<React.SetStateAction<number>>;
    showTerminal: boolean;
    setShowTerminal: (show: boolean) => void;
    isFloatingTerminal: boolean;
    setIsFloatingTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setIsMaximizedTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setTerminalHeight: (height: number) => void;
    lastExpandedTerminalHeightRef: React.MutableRefObject<number>;
}

export function useWorkspaceShortcuts({
    wm,
    setShowShortcutHelp,
    setShowQuickSwitch,
    setQuickSwitchQuery,
    setQuickSwitchIndex,
    showTerminal,
    setShowTerminal,
    isFloatingTerminal,
    setIsFloatingTerminal,
    setIsMaximizedTerminal,
    setTerminalHeight,
    lastExpandedTerminalHeightRef,
}: UseWorkspaceShortcutsParams) {
    React.useEffect(() => {
        const onQuickTerminal = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            if (event.key !== '`' && event.code !== 'Backquote') {
                return;
            }
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            const isTypingTarget =
                target?.isContentEditable ||
                tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select';
            if (isTypingTarget) {
                return;
            }

            event.preventDefault();

            if (!showTerminal) {
                setIsFloatingTerminal(true);
                setIsMaximizedTerminal(false);
                setShowTerminal(true);
                const fallbackHeight = Math.max(
                    lastExpandedTerminalHeightRef.current,
                    FLOATING_TERMINAL_DEFAULT_HEIGHT
                );
                setTerminalHeight(fallbackHeight);
                return;
            }

            if (isFloatingTerminal) {
                setShowTerminal(false);
                setIsFloatingTerminal(false);
                return;
            }

            setIsFloatingTerminal(true);
        };

        window.addEventListener('keydown', onQuickTerminal);
        return () => {
            window.removeEventListener('keydown', onQuickTerminal);
        };
    }, [isFloatingTerminal, setShowTerminal, setTerminalHeight, showTerminal, lastExpandedTerminalHeightRef, setIsFloatingTerminal, setIsMaximizedTerminal]);

    React.useEffect(() => {
        const onWorkspaceShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) {
                return;
            }
            const key = event.key.toLowerCase();
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            const isTypingTarget =
                target?.isContentEditable || tagName === 'input' || tagName === 'textarea';
            if (isTypingTarget && key !== '/') {
                return;
            }
            if (key === '/') {
                event.preventDefault();
                setShowShortcutHelp(prev => !prev);
                return;
            }
            if (key === 'k') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('app:open-command-palette'));
                return;
            }
            if (key === 'p') {
                event.preventDefault();
                setShowQuickSwitch(true);
                setQuickSwitchQuery('');
                setQuickSwitchIndex(0);
                return;
            }
            if (key === 'w' && wm.activeTab) {
                event.preventDefault();
                wm.closeTab(wm.activeTab.id);
            }
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowShortcutHelp(false);
                setShowQuickSwitch(false);
            }
        };
        window.addEventListener('keydown', onWorkspaceShortcut);
        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('keydown', onWorkspaceShortcut);
            window.removeEventListener('keydown', onEscape);
        };
    }, [wm, setShowShortcutHelp, setShowQuickSwitch, setQuickSwitchQuery, setQuickSwitchIndex]);
}
