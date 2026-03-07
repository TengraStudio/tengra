import React from 'react';

import { TerminalTab } from '@/types';

import type { AiPanelMode, AiResult } from '../hooks/useTerminalAI';
import type { TaskRunnerEntry,TerminalHistoryEntry } from '../hooks/useTerminalCommandTools';
import type { TerminalRecording } from '../hooks/useTerminalRecording';
import type { MultiplexerMode, MultiplexerSession } from '../utils/terminal-panel-types';
import type { TerminalSemanticIssue } from '../utils/terminal-panel-types';
import type { TerminalSearchMatch } from '../utils/terminal-search';

import { TerminalOverlays } from './TerminalOverlays';

export interface TerminalPanelOverlaysConnectorProps {
    t: (path: string, options?: Record<string, string | number>) => string;
    terminalContextMenu: { x: number; y: number } | null;
    displayTabs: TerminalTab[];
    isGalleryView: boolean;
    hasActiveSession: boolean;
    isFloating: boolean;
    workspacePath?: string;
    splitView: { primaryId: string; secondaryId: string } | null;
    isSynchronizedInputEnabled: boolean;
    activeRecordingTabId: string | null;
    activeRecordingLabel: string | null;
    pasteHistory: string[];
    // Semantic
    isSemanticPanelOpen: boolean;
    activeSemanticIssues: TerminalSemanticIssue[];
    activeSemanticErrorCount: number;
    activeSemanticWarningCount: number;
    clearActiveSemanticIssues: () => void;
    revealSemanticIssue: (issue: TerminalSemanticIssue) => void;
    // AI
    isAiPanelOpen: boolean;
    aiPanelMode: AiPanelMode;
    aiSelectedIssue: TerminalSemanticIssue | null;
    aiIsLoading: boolean;
    aiResult: AiResult | null;
    closeAiPanel: () => void;
    handleAiApplyFix: (command: string) => Promise<void>;
    handleAiExplainError: (issue: TerminalSemanticIssue) => Promise<void>;
    handleAiFixError: (issue: TerminalSemanticIssue) => Promise<void>;
    // Actions
    handleCopySelection: () => Promise<void>;
    handleCopyWithFormatting: () => Promise<void>;
    handleCopyStripAnsi: () => Promise<void>;
    handlePasteClipboard: () => Promise<void>;
    handleTestPaste: () => Promise<void>;
    handleSelectAll: () => void;
    handleClearOutput: () => void;
    handlePasteFromHistory: (entry: string) => Promise<void>;
    openTerminalSearch: () => void;
    toggleSemanticPanel: () => void;
    toggleGalleryView: () => void;
    toggleFloatingMode: () => void;
    onFloatingChange?: (isFloating: boolean) => void;
    openCommandHistory: () => void;
    openTaskRunner: () => void;
    openMultiplexerPanel: () => void;
    toggleRecording: () => void;
    createDefaultTerminal: () => Promise<void>;
    hideTerminalPanel: () => void;
    handleSplitTerminal: () => void;
    handleDetachTerminal: () => Promise<void>;
    toggleSynchronizedInput: () => void;
    closeSplitView: () => void;
    toggleSplitOrientation: () => void;
    setTerminalContextMenu: (menu: { x: number; y: number } | null) => void;
    setIsSearchOpen: (open: boolean) => void;
    setIsGalleryView: (open: boolean) => void;
    setIsSemanticPanelOpen: (open: boolean) => void;
    setIsCommandHistoryOpen: (open: boolean) => void;
    setIsTaskRunnerOpen: (open: boolean) => void;
    setIsMultiplexerOpen: (open: boolean) => void;
    setIsRecordingPanelOpen: (open: boolean) => void;
    // Multiplexer
    isMultiplexerOpen: boolean;
    multiplexerMode: MultiplexerMode;
    multiplexerSessionName: string;
    multiplexerSessions: MultiplexerSession[];
    isMultiplexerLoading: boolean;
    multiplexerError: string | null;
    closeMultiplexerPanel: () => void;
    setMultiplexerMode: React.Dispatch<React.SetStateAction<MultiplexerMode>>;
    refreshMultiplexerSessions: (mode?: MultiplexerMode) => Promise<void>;
    setMultiplexerSessionName: (name: string) => void;
    createMultiplexerSession: () => Promise<void>;
    attachMultiplexerSession: (session: MultiplexerSession) => Promise<void>;
    // Recording
    isRecordingPanelOpen: boolean;
    recordings: TerminalRecording[];
    selectedRecordingId: string | null;
    selectedRecording: TerminalRecording | null;
    selectedRecordingText: string;
    replayText: string;
    isReplayRunning: boolean;
    toggleRecordingForPanel: () => void;
    startReplay: (recording: TerminalRecording) => void;
    stopReplay: () => void;
    exportRecording: (recording: TerminalRecording) => void;
    setSelectedRecordingId: (id: string | null) => void;
    setReplayText: (text: string) => void;
    // Search
    isSearchOpen: boolean;
    searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
    searchQuery: string;
    searchUseRegex: boolean;
    searchStatus: 'idle' | 'found' | 'not-found' | 'invalid-regex';
    searchMatches: TerminalSearchMatch[];
    searchActiveMatchIndex: number;
    searchHistory: string[];
    setSearchQuery: (query: string) => void;
    setSearchUseRegex: (useRegex: boolean | ((prev: boolean) => boolean)) => void;
    setSearchStatus: React.Dispatch<React.SetStateAction<'idle' | 'found' | 'not-found' | 'invalid-regex'>>;
    setSearchMatches: (matches: TerminalSearchMatch[]) => void;
    setSearchActiveMatchIndex: (index: number) => void;
    setSearchHistoryIndex: (index: number) => void;
    resetActiveSearchCursor: () => void;
    runTerminalSearch: (direction: 'next' | 'prev') => boolean;
    closeTerminalSearch: () => void;
    stepSearchHistory: (direction: 'older' | 'newer') => void;
    jumpToSearchMatch: (index: number, matchesOverride?: TerminalSearchMatch[]) => void;
    getSearchMatchLabel: (match: TerminalSearchMatch) => string;
    // Command
    isCommandHistoryOpen: boolean;
    isCommandHistoryLoading: boolean;
    commandHistoryQuery: string;
    commandHistoryItems: TerminalHistoryEntry[];
    setCommandHistoryQuery: (query: string) => void;
    closeCommandHistory: () => void;
    clearCommandHistory: () => Promise<void>;
    executeHistoryCommand: (entry: TerminalHistoryEntry) => Promise<void>;
    isTaskRunnerOpen: boolean;
    isTaskRunnerLoading: boolean;
    taskRunnerQuery: string;
    taskRunnerItems: TaskRunnerEntry[];
    setTaskRunnerQuery: (query: string) => void;
    closeTaskRunner: () => void;
    executeTaskRunnerEntry: (entry: TaskRunnerEntry) => Promise<void>;
}

export const TerminalPanelOverlaysConnector: React.FC<TerminalPanelOverlaysConnectorProps> = (p) => {
    return (
        <TerminalOverlays
            terminalContextMenu={p.terminalContextMenu}
            canUseGallery={p.displayTabs.length > 1}
            isGalleryView={p.isGalleryView}
            contextMenuProps={{
                hasActiveSession: p.hasActiveSession,
                onCopy: () => { void p.handleCopySelection(); },
                onCopyWithFormatting: () => { void p.handleCopyWithFormatting(); },
                onCopyStripAnsi: () => { void p.handleCopyStripAnsi(); },
                onPaste: () => { void p.handlePasteClipboard(); },
                onTestPaste: () => { void p.handleTestPaste(); },
                onSelectAll: p.handleSelectAll,
                onSearch: p.openTerminalSearch,
                onSemanticToggle: p.toggleSemanticPanel,
                onGalleryToggle: p.toggleGalleryView,
                onFloatingToggle: p.onFloatingChange
                    ? () => { p.toggleFloatingMode(); p.setTerminalContextMenu(null); }
                    : undefined,
                onHistoryToggle: p.openCommandHistory,
                onTaskRunnerToggle: p.openTaskRunner,
                onMultiplexerToggle: p.openMultiplexerPanel,
                onRecordingToggle: () => { p.toggleRecording(); p.setTerminalContextMenu(null); },
                onOpenRecordings: () => {
                    p.setTerminalContextMenu(null);
                    p.setIsSearchOpen(false);
                    p.setIsGalleryView(false);
                    p.setIsSemanticPanelOpen(false);
                    p.setIsCommandHistoryOpen(false);
                    p.setIsTaskRunnerOpen(false);
                    p.setIsMultiplexerOpen(false);
                    p.setIsRecordingPanelOpen(true);
                },
                onNewTerminal: () => { void p.createDefaultTerminal(); p.setTerminalContextMenu(null); },
                onHidePanel: p.hideTerminalPanel,
                onClearOutput: p.handleClearOutput,
                onSplit: p.handleSplitTerminal,
                onDetach: () => { void p.handleDetachTerminal(); },
                onToggleSynchronizedInput: p.toggleSynchronizedInput,
                onCloseSplit: p.closeSplitView,
                onToggleSplitOrientation: p.toggleSplitOrientation,
                splitActive: Boolean(p.splitView),
                isSynchronizedInputEnabled: p.isSynchronizedInputEnabled,
                isRecordingActive: Boolean(p.activeRecordingTabId),
                semanticIssueCount: p.activeSemanticIssues.length,
                semanticErrorCount: p.activeSemanticErrorCount,
                semanticWarningCount: p.activeSemanticWarningCount,
                isFloating: p.isFloating,
                workspacePath: p.workspacePath,
                pasteHistory: p.pasteHistory,
                onPasteHistory: entry => { void p.handlePasteFromHistory(entry); },
                labels: {
                    copy: p.t('common.copy'),
                    copyWithFormatting: p.t('terminal.copyWithFormatting'),
                    copyStripAnsi: p.t('terminal.copyStripAnsi'),
                    paste: p.t('terminal.paste'),
                    pasteTest: 'Test Paste',
                    pasteHistory: 'Paste History',
                    selectAll: p.t('common.selectAll'),
                    search: p.t('common.search'),
                    semanticIssues: p.t('terminal.semanticIssues'),
                    galleryView: p.t('terminal.galleryView'),
                    exitGalleryView: p.t('terminal.exitGalleryView'),
                    floatTerminal: p.t('terminal.floatTerminal'),
                    dockTerminal: p.t('terminal.dockTerminal'),
                    commandHistory: p.t('terminal.commandHistory'),
                    runTask: p.t('terminal.runTask'),
                    multiplexer: 'Multiplexer (tmux/screen)',
                    startRecording: 'Start Recording',
                    stopRecording: 'Stop Recording',
                    sessionRecordings: 'Session Recordings',
                    clearOutput: p.t('terminal.clearOutput'),
                    split: p.t('terminal.split'),
                    synchronizedInputOn: 'Disable Synchronized Input',
                    synchronizedInputOff: 'Enable Synchronized Input',
                    detach: p.t('terminal.detach'),
                    toggleSplitOrientation: p.t('terminal.toggleSplitOrientation'),
                    closeSplit: p.t('terminal.closeSplit'),
                    newTerminal: p.t('terminal.new'),
                    hide: p.t('terminal.hide'),
                },
            }}
            semanticPanelProps={
                p.isSemanticPanelOpen
                    ? {
                        t: p.t,
                        activeSemanticIssues: p.activeSemanticIssues,
                        activeSemanticErrorCount: p.activeSemanticErrorCount,
                        activeSemanticWarningCount: p.activeSemanticWarningCount,
                        clearActiveSemanticIssues: p.clearActiveSemanticIssues,
                        revealSemanticIssue: p.revealSemanticIssue,
                        handleAiExplainError: p.handleAiExplainError,
                        handleAiFixError: p.handleAiFixError,
                    }
                    : null
            }
            t={p.t}
            isAiPanelOpen={p.isAiPanelOpen}
            aiPanelMode={p.aiPanelMode}
            aiSelectedIssue={p.aiSelectedIssue}
            aiIsLoading={p.aiIsLoading}
            aiResult={p.aiResult}
            closeAiPanel={p.closeAiPanel}
            handleAiApplyFix={p.handleAiApplyFix}
            multiplexerPanelProps={
                p.isMultiplexerOpen
                    ? {
                        t: p.t,
                        hasActiveSession: p.hasActiveSession,
                        multiplexerMode: p.multiplexerMode,
                        multiplexerSessionName: p.multiplexerSessionName,
                        multiplexerSessions: p.multiplexerSessions,
                        isMultiplexerLoading: p.isMultiplexerLoading,
                        multiplexerError: p.multiplexerError,
                        closeMultiplexerPanel: p.closeMultiplexerPanel,
                        setMultiplexerMode: p.setMultiplexerMode,
                        refreshMultiplexerSessions: p.refreshMultiplexerSessions,
                        setMultiplexerSessionName: p.setMultiplexerSessionName,
                        createMultiplexerSession: p.createMultiplexerSession,
                        attachMultiplexerSession: p.attachMultiplexerSession,
                    }
                    : null
            }
            recordingPanelProps={
                p.isRecordingPanelOpen
                    ? {
                        t: p.t,
                        hasActiveSession: p.hasActiveSession,
                        activeRecordingTabId: p.activeRecordingTabId,
                        activeRecordingLabel: p.activeRecordingLabel,
                        recordings: p.recordings,
                        selectedRecordingId: p.selectedRecordingId,
                        selectedRecording: p.selectedRecording,
                        selectedRecordingText: p.selectedRecordingText,
                        replayText: p.replayText,
                        isReplayRunning: p.isReplayRunning,
                        setIsRecordingPanelOpen: p.setIsRecordingPanelOpen,
                        toggleRecording: p.toggleRecordingForPanel,
                        startReplay: p.startReplay,
                        stopReplay: p.stopReplay,
                        exportRecording: p.exportRecording,
                        setSelectedRecordingId: p.setSelectedRecordingId,
                        setReplayText: p.setReplayText,
                    }
                    : null
            }
            searchOverlayProps={
                p.isSearchOpen
                    ? {
                        t: p.t,
                        searchInputRef: p.searchInputRef,
                        searchQuery: p.searchQuery,
                        searchUseRegex: p.searchUseRegex,
                        searchStatus: p.searchStatus,
                        searchMatches: p.searchMatches,
                        searchActiveMatchIndex: p.searchActiveMatchIndex,
                        searchHistory: p.searchHistory,
                        setSearchQuery: p.setSearchQuery,
                        setSearchUseRegex: p.setSearchUseRegex,
                        setSearchStatus: p.setSearchStatus,
                        setSearchMatches: p.setSearchMatches,
                        setSearchActiveMatchIndex: p.setSearchActiveMatchIndex,
                        setSearchHistoryIndex: p.setSearchHistoryIndex,
                        resetActiveSearchCursor: p.resetActiveSearchCursor,
                        runTerminalSearch: p.runTerminalSearch,
                        closeTerminalSearch: p.closeTerminalSearch,
                        stepSearchHistory: p.stepSearchHistory,
                        jumpToSearchMatch: p.jumpToSearchMatch,
                        getSearchMatchLabel: p.getSearchMatchLabel,
                    }
                    : null
            }
            commandPanelsProps={{
                t: p.t,
                isCommandHistoryOpen: p.isCommandHistoryOpen,
                isCommandHistoryLoading: p.isCommandHistoryLoading,
                commandHistoryQuery: p.commandHistoryQuery,
                commandHistoryItems: p.commandHistoryItems,
                setCommandHistoryQuery: p.setCommandHistoryQuery,
                closeCommandHistory: p.closeCommandHistory,
                clearCommandHistory: async () => { await p.clearCommandHistory(); },
                executeHistoryCommand: async entry => { await p.executeHistoryCommand(entry); },
                isTaskRunnerOpen: p.isTaskRunnerOpen,
                isTaskRunnerLoading: p.isTaskRunnerLoading,
                taskRunnerQuery: p.taskRunnerQuery,
                taskRunnerItems: p.taskRunnerItems,
                setTaskRunnerQuery: p.setTaskRunnerQuery,
                closeTaskRunner: p.closeTaskRunner,
                executeTaskRunnerEntry: async entry => { await p.executeTaskRunnerEntry(entry); },
            }}
        />
    );
};
