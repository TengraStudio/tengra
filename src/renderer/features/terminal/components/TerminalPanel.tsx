/* eslint-disable max-lines-per-function */
import { useTranslation } from '@renderer/i18n';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { type ITheme, Terminal as XTerm } from 'xterm';
import { z } from 'zod';

import { useTheme } from '@/hooks/useTheme';
import { motion } from '@/lib/framer-motion-compat';
import { invokeTypedIpc } from '@/lib/ipc-client';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { useTerminalAI } from '../hooks/useTerminalAI';
import { useTerminalAppearance } from '../hooks/useTerminalAppearance';
import { useTerminalBackendsAndRemote } from '../hooks/useTerminalBackendsAndRemote';
import { useTerminalBootstrapEffects } from '../hooks/useTerminalBootstrapEffects';
import { useTerminalCommandTools } from '../hooks/useTerminalCommandTools';
import { useTerminalLifecycle } from '../hooks/useTerminalLifecycle';
import { useTerminalMultiplexer } from '../hooks/useTerminalMultiplexer';
import { useTerminalPasteHistory } from '../hooks/useTerminalPasteHistory';
import { useTerminalRecording } from '../hooks/useTerminalRecording';
import { useTerminalSearch } from '../hooks/useTerminalSearch';
import { useTerminalSemanticAnalysis } from '../hooks/useTerminalSemanticAnalysis';
import { useTerminalShortcuts } from '../hooks/useTerminalShortcuts';
import { useTerminalSplitLayout } from '../hooks/useTerminalSplitLayout';
import { useTerminalState } from '../hooks/useTerminalState';
import type {
    ResolvedTerminalAppearance,
    TerminalAppearancePreferences,
    TerminalCursorStyle,
} from '../types/terminal-appearance';
import { alertDialog, confirmDialog, promptDialog } from '../utils/dialog';
import { serializeTerminalModuleVersion } from '../utils/module-version';
import { clearTerminalSessionFlags } from '../utils/session-registry';
import {
    createShortcutShareCode,
    parseShortcutShareCode,
    parseShortcutStorage,
    sanitizeShortcutBindings,
    serializeShortcutStorage,
    TERMINAL_SHORTCUT_PRESETS,
    type TerminalShortcutBindings,
    type TerminalShortcutPresetId,
} from '../utils/shortcut-config';
import {
    createCustomSplitPreset,
    DEFAULT_SPLIT_ANALYTICS,
    DEFAULT_SPLIT_PRESETS,
    incrementSplitAnalytics,
    type SplitAnalytics,
    type SplitPreset,
    TERMINAL_SPLIT_PRESET_LIMIT,
} from '../utils/split-config';
import { createTerminalShortcutEventHandler } from '../utils/terminal-event-handlers';
import {
    explainErrorResultSchema,
    fixErrorResultSchema,
    terminalCommandHistoryEntrySchema,
    type TerminalIpcContract} from '../utils/terminal-ipc';
import {
    buildDockerBootstrapCommand,
    buildFormattedClipboardHtml,
    buildSshBootstrapCommand,
    resolveSecondarySplitTabId,
    summarizePasteText,
    validateTerminalAppearanceImport,
} from '../utils/terminal-panel-helpers';
import { TerminalSemanticIssue } from '../utils/terminal-panel-types';
import {
    collectTerminalSearchMatches,
    type TerminalSearchMatch,
} from '../utils/terminal-search';

import { TerminalOverlays } from './TerminalOverlays';
import { TerminalProjectIssuesTab } from './TerminalProjectIssuesTab';
import { TerminalSplitView } from './TerminalSplitView';
import { TerminalToolbar } from './TerminalToolbar';

import 'xterm/css/xterm.css';

const useTrackedEffect = useEffect;
const useTrackedCallback = useCallback;

const TERMINAL_SEARCH_HISTORY_STORAGE_KEY = 'terminal.search-history.v1';
const TERMINAL_SEARCH_HISTORY_LIMIT = 12;
const TERMINAL_PREFERRED_BACKEND_STORAGE_KEY = 'terminal.preferred-backend.v1';
const TERMINAL_APPEARANCE_STORAGE_KEY = 'terminal.appearance.v1';
const TERMINAL_SHORTCUTS_STORAGE_KEY = 'terminal.shortcuts.v1';
const TERMINAL_PASTE_HISTORY_STORAGE_KEY = 'terminal.paste-history.v1';
const TERMINAL_PASTE_HISTORY_LIMIT = 10;
const TERMINAL_SYNC_INPUT_STORAGE_KEY = 'terminal.sync-input.v1';
const TERMINAL_SPLIT_PRESETS_STORAGE_KEY = 'terminal.split-presets.v1';
const TERMINAL_SPLIT_LAYOUT_STORAGE_KEY = 'terminal.split-layout.v1';
const TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY = 'terminal.split-analytics.v1';
const TERMINAL_PROJECT_ISSUES_TAB_ID = '__project-issues-tab__';
const TERMINAL_MANAGER_MODULE_VERSION = serializeTerminalModuleVersion();
const ANSI_ESCAPE_SEQUENCE_REGEX = new RegExp(
    String.raw`\x1B(?:\[[0-?]*[ -/]*[@-~]|[@-Z\\-_]|\][^\x07]*(?:\x07|\x1B\\))`,
    'g'
);

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

type RemoteConnectionTarget =
    | {
        kind: 'ssh';
        profile: import('../utils/terminal-panel-types').RemoteSshProfile;
    }
    | {
        kind: 'docker';
        container: import('../utils/terminal-panel-types').RemoteDockerContainer;
    };

type TerminalAppearancePreset = {
    id: string;
    name: string;
    category: 'default' | 'community';
    theme: Partial<ITheme>;
};

type TerminalFontPreset = {
    id: string;
    name: string;
    fontFamily: string;
};

const TERMINAL_THEME_PRESETS: TerminalAppearancePreset[] = [
    { id: 'system', name: 'System', category: 'default', theme: {} },
    {
        id: 'dracula',
        name: 'Dracula',
        category: 'community',
        theme: {
            background: '#282a36',
            foreground: '#f8f8f2',
            cursor: '#f8f8f2',
            selectionBackground: '#44475a',
            black: '#21222c',
            red: '#ff5555',
            green: '#50fa7b',
            yellow: '#f1fa8c',
            blue: '#bd93f9',
            magenta: '#ff79c6',
            cyan: '#8be9fd',
            white: '#f8f8f2',
            brightBlack: '#6272a4',
            brightRed: '#ff6e6e',
            brightGreen: '#69ff94',
            brightYellow: '#ffffa5',
            brightBlue: '#d6acff',
            brightMagenta: '#ff92df',
            brightCyan: '#a4ffff',
            brightWhite: '#ffffff',
        },
    },
    {
        id: 'gruvbox-dark',
        name: 'Gruvbox Dark',
        category: 'community',
        theme: {
            background: '#282828',
            foreground: '#ebdbb2',
            cursor: '#ebdbb2',
            selectionBackground: '#504945',
            black: '#282828',
            red: '#cc241d',
            green: '#98971a',
            yellow: '#d79921',
            blue: '#458588',
            magenta: '#b16286',
            cyan: '#689d6a',
            white: '#a89984',
            brightBlack: '#928374',
            brightRed: '#fb4934',
            brightGreen: '#b8bb26',
            brightYellow: '#fabd2f',
            brightBlue: '#83a598',
            brightMagenta: '#d3869b',
            brightCyan: '#8ec07c',
            brightWhite: '#ebdbb2',
        },
    },
    {
        id: 'tokyo-night',
        name: 'Tokyo Night',
        category: 'community',
        theme: {
            background: '#1a1b26',
            foreground: '#c0caf5',
            cursor: '#c0caf5',
            selectionBackground: '#33467c',
            black: '#15161e',
            red: '#f7768e',
            green: '#9ece6a',
            yellow: '#e0af68',
            blue: '#7aa2f7',
            magenta: '#bb9af7',
            cyan: '#7dcfff',
            white: '#a9b1d6',
            brightBlack: '#414868',
            brightRed: '#f7768e',
            brightGreen: '#9ece6a',
            brightYellow: '#e0af68',
            brightBlue: '#7aa2f7',
            brightMagenta: '#bb9af7',
            brightCyan: '#7dcfff',
            brightWhite: '#c0caf5',
        },
    },
];

const TERMINAL_FONT_PRESETS: TerminalFontPreset[] = [
    {
        id: 'jetbrains',
        name: 'JetBrains Mono',
        fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    },
    {
        id: 'fira',
        name: 'Fira Code',
        fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
    },
    {
        id: 'cascadia',
        name: 'Cascadia Code',
        fontFamily: "'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
    },
];

const TERMINAL_CURSOR_STYLES: { id: TerminalCursorStyle; name: string }[] = [
    { id: 'block', name: 'Block' },
    { id: 'underline', name: 'Underline' },
    { id: 'bar', name: 'Bar' },
];

const DEFAULT_TERMINAL_APPEARANCE: TerminalAppearancePreferences = {
    themePresetId: 'system',
    fontPresetId: 'jetbrains',
    ligatures: true,
    surfaceOpacity: 0.92,
    surfaceBlur: 14,
    cursorStyle: 'block',
    cursorBlink: true,
    fontSize: 13,
    lineHeight: 1.2,
    customTheme: null,
};

function stripAnsiControlSequences(value: string): string {
    return value.replace(ANSI_ESCAPE_SEQUENCE_REGEX, '').replace(/\r/g, '');
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function resolveTerminalAppearance(
    baseTheme: ITheme,
    appearance: TerminalAppearancePreferences
): ResolvedTerminalAppearance {
    const themePreset =
        TERMINAL_THEME_PRESETS.find(item => item.id === appearance.themePresetId) ??
        TERMINAL_THEME_PRESETS[0];
    const fontPreset =
        TERMINAL_FONT_PRESETS.find(item => item.id === appearance.fontPresetId) ??
        TERMINAL_FONT_PRESETS[0];

    // Merge base theme, preset theme, and custom theme (custom takes highest priority)
    const mergedTheme: ITheme = {
        ...baseTheme,
        ...themePreset.theme,
        ...(appearance.customTheme ?? {}),
    };

    return {
        theme: mergedTheme,
        fontFamily: fontPreset.fontFamily,
        cursorStyle: appearance.cursorStyle,
        cursorBlink: appearance.cursorBlink,
        fontSize: appearance.fontSize,
        lineHeight: appearance.lineHeight,
    };
}

function TerminalPanelContentImpl({
    isOpen,
    onToggle,
    isMaximized: isMaximizedProp = false,
    onMaximizeChange: onMaximizeChangeProp,
    isFloating = false,
    onFloatingChange,
    projectId,
    projectPath,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    onOpenFile,
}: TerminalPanelProps) {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const {
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
        isMultiplexerOpen,
        setIsMultiplexerOpen,
        isRecordingPanelOpen,
        setIsRecordingPanelOpen,
        isAiPanelOpen,
        setIsAiPanelOpen,
    } = useTerminalState();

    const isMaximized = onMaximizeChangeProp ? isMaximizedProp : isMaximizedLocal;
    const setIsMaximized = onMaximizeChangeProp ?? setIsMaximizedLocal;
    const {
        splitView,
        setSplitView,
        splitFocusedPane,
        setSplitFocusedPane,
        isSynchronizedInputEnabled,
        setIsSynchronizedInputEnabled,
        isSplitPresetMenuOpen,
        setIsSplitPresetMenuOpen,
        splitPresets,
        setSplitPresets,
        splitAnalytics,
        setSplitAnalytics,
    } = useTerminalSplitLayout({
        tabs,
        syncInputStorageKey: TERMINAL_SYNC_INPUT_STORAGE_KEY,
        splitPresetsStorageKey: TERMINAL_SPLIT_PRESETS_STORAGE_KEY,
        splitLayoutStorageKey: TERMINAL_SPLIT_LAYOUT_STORAGE_KEY,
        splitAnalyticsStorageKey: TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY,
        splitPresetLimit: TERMINAL_SPLIT_PRESET_LIMIT,
    });

    // Semantic analysis hook
    const { semanticIssuesByTab, parseSemanticChunk, clearSemanticIssues } =
        useTerminalSemanticAnalysis({ tabs });

    const {
        searchQuery,
        setSearchQuery,
        searchUseRegex,
        setSearchUseRegex,
        searchStatus,
        setSearchStatus,
        searchMatches,
        setSearchMatches,
        searchActiveMatchIndex,
        setSearchActiveMatchIndex,
        searchHistory,
        setSearchHistory,
        searchHistoryIndex,
        setSearchHistoryIndex,
        searchInputRef,
        searchCursorRef,
    } = useTerminalSearch({
        storageKey: TERMINAL_SEARCH_HISTORY_STORAGE_KEY,
        historyLimit: TERMINAL_SEARCH_HISTORY_LIMIT,
    });

    // Backend and remote connections hook
    const {
        isLoadingShells,
        isLoadingBackends,
        availableShells,
        availableBackends,
        isLoadingRemoteConnections,
        remoteSshProfiles,
        remoteDockerContainers,
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
        resolveDefaultBackendId,
        persistPreferredBackendId,
    } = useTerminalBackendsAndRemote({
        preferredBackendStorageKey: TERMINAL_PREFERRED_BACKEND_STORAGE_KEY,
    });

    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });

    const { pasteHistory, setPasteHistory } = useTerminalPasteHistory({
        storageKey: TERMINAL_PASTE_HISTORY_STORAGE_KEY,
        historyLimit: TERMINAL_PASTE_HISTORY_LIMIT,
    });
    const { shortcutPreset, setShortcutPreset, shortcutBindings, setShortcutBindings } =
        useTerminalShortcuts({ storageKey: TERMINAL_SHORTCUTS_STORAGE_KEY });

    // AI assistant hook
    const {
        aiPanelMode,
        setAiPanelMode,
        aiSelectedIssue,
        setAiSelectedIssue,
        aiIsLoading,
        setAiIsLoading,
        aiResult,
        setAiResult,
    } = useTerminalAI();

    const tabsRef = useRef<TerminalTab[]>(tabs);
    const activeTabIdRef = useRef<string | null>(activeTabId);
    const terminalInstancesRef = useRef<Record<string, XTerm | null>>({});
    const appearanceImportInputRef = useRef<HTMLInputElement | null>(null);
    const shortcutImportInputRef = useRef<HTMLInputElement | null>(null);
    const projectIssuesTab = useMemo<TerminalTab | null>(() => {
        if (!projectPath) {
            return null;
        }
        return {
            id: TERMINAL_PROJECT_ISSUES_TAB_ID,
            name: t('terminal.projectIssuesTabTitle'),
            type: 'panel',
            status: 'idle',
            history: [],
            command: '',
            metadata: {
                panelType: 'project-issues',
                closable: false,
            },
        };
    }, [projectPath, t]);
    const displayTabs = useMemo(
        () => (projectIssuesTab ? [projectIssuesTab, ...tabs] : tabs),
        [projectIssuesTab, tabs]
    );
    const hasActiveSession = Boolean(activeTabId && tabs.some(tab => tab.id === activeTabId));
    const {
        recordings,
        activeRecordingTabId,
        selectedRecordingId,
        selectedRecording,
        isReplayRunning,
        replayText,
        recordingCaptureRef,
        completeRecording,
        setSelectedRecordingId,
        setReplayText,
        toggleRecording,
        startReplay,
        stopReplay,
        exportRecording,
    } = useTerminalRecording({
        tabs,
        activeTabId,
        setIsRecordingPanelOpen,
    });

    useTrackedEffect(() => {
        tabsRef.current = tabs;
    }, [tabs]);

    useTrackedEffect(() => {
        activeTabIdRef.current =
            activeTabId && tabs.some(tab => tab.id === activeTabId) ? activeTabId : null;
    }, [activeTabId, tabs]);

    const tabById = useMemo(() => {
        const lookup = new Map<string, TerminalTab>();
        for (const tab of tabs) {
            lookup.set(tab.id, tab);
        }
        return lookup;
    }, [tabs]);

    const shellNameById = useMemo(() => {
        const lookup = new Map<string, string>();
        for (const shell of availableShells) {
            lookup.set(shell.id, shell.name);
        }
        return lookup;
    }, [availableShells]);

    const backendNameById = useMemo(() => {
        const lookup = new Map<string, string>();
        for (const backend of availableBackends) {
            lookup.set(backend.id, backend.name);
        }
        return lookup;
    }, [availableBackends]);

    const setTerminalInstance = useTrackedCallback((id: string, terminal: XTerm | null) => {
        if (terminal) {
            terminalInstancesRef.current[id] = terminal;
            return;
        }
        delete terminalInstancesRef.current[id];
    }, []);

    const getActiveTerminalInstance = useTrackedCallback(() => {
        if (!activeTabIdRef.current) {
            return null;
        }
        return terminalInstancesRef.current[activeTabIdRef.current] ?? null;
    }, []);

    const createTerminal = useTrackedCallback(
        (
            type: string,
            backendId?: string,
            options?: {
                name?: string;
                metadata?: Record<string, unknown>;
                bootstrapCommand?: string;
            }
        ) => {
            const id = Math.random().toString(36).substring(2, 9);
            const effectiveBackendId =
                backendId ?? resolveDefaultBackendId(availableBackends) ?? 'node-pty';
            const shellName = shellNameById.get(type) ?? type;
            const backendName = backendNameById.get(effectiveBackendId);
            const similarCount =
                tabs.filter(
                    tab => tab.type === type && (tab.backendId ?? 'node-pty') === effectiveBackendId
                ).length + 1;
            const generatedName =
                effectiveBackendId === 'node-pty'
                    ? `${shellName} ${similarCount}`
                    : `${shellName} (${backendName ?? effectiveBackendId}) ${similarCount}`;
            const name = options?.name?.trim() || generatedName;

            setTabs(prev => [
                ...prev,
                {
                    id,
                    name,
                    type,
                    backendId: effectiveBackendId,
                    cwd: projectPath ?? '',
                    isRunning: true,
                    status: 'idle',
                    history: [],
                    command: '',
                    metadata: options?.metadata,
                    bootstrapCommand: options?.bootstrapCommand,
                },
            ]);
            setActiveTabId(id);
            setIsNewTerminalMenuOpen(false);
            return id;
        },
        [
            availableBackends,
            backendNameById,
            projectPath,
            setTabs,
            setActiveTabId,
            shellNameById,
            tabs,
            resolveDefaultBackendId,
        ]
    );

    const createDefaultTerminal = useTrackedCallback(async () => {
        let shells = availableShells;
        if (shells.length === 0) {
            shells = await fetchAvailableShells();
        }

        let backends = availableBackends;
        if (backends.length === 0) {
            backends = await fetchAvailableBackends();
        }

        const backendId = resolveDefaultBackendId(backends);
        const shellId = shells[0]?.id ?? tabs[0]?.type ?? 'powershell';
        createTerminal(shellId, backendId);
    }, [
        availableBackends,
        availableShells,
        createTerminal,
        fetchAvailableBackends,
        fetchAvailableShells,
        resolveDefaultBackendId,
        tabs,
    ]);

    const resolvePreferredShellId = useTrackedCallback(() => {
        const currentTabs = tabsRef.current;
        const active = currentTabs.find(tab => tab.id === activeTabIdRef.current);
        return active?.type ?? availableShells[0]?.id;
    }, [availableShells]);

    const createRemoteTerminal = useTrackedCallback(
        (target: RemoteConnectionTarget) => {
            const shellId =
                resolvePreferredShellId() ??
                availableShells[0]?.id ??
                tabsRef.current[0]?.type ??
                'powershell';
            const backendId =
                availableBackends.find(backend => backend.id === 'node-pty' && backend.available)
                    ?.id ??
                resolveDefaultBackendId(availableBackends) ??
                'node-pty';

            if (target.kind === 'ssh') {
                const { profile } = target;
                const bootstrapCommand = buildSshBootstrapCommand(profile);

                createTerminal(shellId, backendId, {
                    name: `SSH ${profile.username}@${profile.host}`,
                    metadata: {
                        remote: {
                            kind: 'ssh',
                            id: profile.id,
                            host: profile.host,
                            port: profile.port,
                            username: profile.username,
                        },
                    },
                    bootstrapCommand,
                });
                return;
            }

            const { container } = target;
            const bootstrapCommand = buildDockerBootstrapCommand(container);

            createTerminal(shellId, backendId, {
                name: `Docker ${container.name}`,
                metadata: {
                    remote: {
                        kind: 'docker',
                        id: container.id,
                        status: container.status,
                    },
                },
                bootstrapCommand,
            });
        },
        [
            availableBackends,
            availableShells,
            createTerminal,
            resolveDefaultBackendId,
            resolvePreferredShellId,
        ]
    );

    const resolveInputTargetSessionIds = useTrackedCallback((): string[] => {
        const activeId = activeTabIdRef.current;
        if (!activeId) {
            return [];
        }

        if (!isSynchronizedInputEnabled || !splitView) {
            return [activeId];
        }

        const targets = new Set<string>([activeId]);
        if (splitView.primaryId === activeId && splitView.secondaryId) {
            targets.add(splitView.secondaryId);
        } else if (splitView.secondaryId === activeId && splitView.primaryId) {
            targets.add(splitView.primaryId);
        }
        return Array.from(targets);
    }, [isSynchronizedInputEnabled, splitView]);

    const writeInputToTargetSessions = useTrackedCallback(
        async (value: string) => {
            const targets = resolveInputTargetSessionIds();
            if (targets.length === 0 || !value) {
                return;
            }
            await Promise.all(
                targets.map(sessionId =>
                    invokeTypedIpc<TerminalIpcContract, 'terminal:write'>(
                        'terminal:write',
                        [sessionId, value],
                        { responseSchema: z.boolean() }
                    )
                )
            );
        },
        [resolveInputTargetSessionIds]
    );

    const writeCommandToActiveTerminal = useTrackedCallback(
        async (command: string) => {
            if (!command) {
                return;
            }
            await writeInputToTargetSessions(`${command}\r`);
        },
        [writeInputToTargetSessions]
    );

    const {
        multiplexerMode,
        setMultiplexerMode,
        multiplexerSessionName,
        setMultiplexerSessionName,
        isMultiplexerLoading,
        multiplexerSessions,
        multiplexerError,
        refreshMultiplexerSessions,
        attachMultiplexerSession: attachMultiplexerSessionCommand,
        createMultiplexerSession: createMultiplexerSessionCommand,
    } = useTerminalMultiplexer({
        projectPath,
        activeTabIdRef,
        writeCommandToActiveTerminal,
    });

    const {
        isCommandHistoryOpen,
        setIsCommandHistoryOpen,
        isCommandHistoryLoading,
        commandHistoryQuery,
        setCommandHistoryQuery,
        commandHistoryItems,
        openCommandHistory,
        closeCommandHistory,
        executeHistoryCommand,
        clearCommandHistory,
        isTaskRunnerOpen,
        setIsTaskRunnerOpen,
        isTaskRunnerLoading,
        taskRunnerQuery,
        setTaskRunnerQuery,
        taskRunnerItems,
        openTaskRunner,
        closeTaskRunner,
        executeTaskRunnerEntry,
    } = useTerminalCommandTools({
        hasActiveSession,
        activeTabIdRef,
        projectPath,
        writeCommandToActiveTerminal,
        onBeforeOpen: () => {
            setTerminalContextMenu(null);
            setIsSearchOpen(false);
            setIsGalleryView(false);
            setIsSemanticPanelOpen(false);
            setIsMultiplexerOpen(false);
            setIsRecordingPanelOpen(false);
        },
    });

    const openMultiplexerPanel = useTrackedCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsGalleryView(false);
        setIsSemanticPanelOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsMultiplexerOpen(true);
        void refreshMultiplexerSessions();
    }, [refreshMultiplexerSessions, setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    const closeMultiplexerPanel = useTrackedCallback(() => {
        setIsMultiplexerOpen(false);
    }, []);

    const attachMultiplexerSession = useTrackedCallback(
        async (session: Parameters<typeof attachMultiplexerSessionCommand>[0]) => {
            await attachMultiplexerSessionCommand(session);
            setIsMultiplexerOpen(false);
        },
        [attachMultiplexerSessionCommand]
    );

    const createMultiplexerSession = useTrackedCallback(async () => {
        await createMultiplexerSessionCommand();
        setIsMultiplexerOpen(false);
    }, [createMultiplexerSessionCommand]);

    const isCreatingRef = useRef(false);
    const hasAutoCreatedRef = useRef(false);

    useTrackedEffect(() => {
        if (!isOpen) {
            hasAutoCreatedRef.current = false;
            isCreatingRef.current = false;
            setIsSearchOpen(false);
            setIsGalleryView(false);
            setIsAppearanceMenuOpen(false);
            setIsSemanticPanelOpen(false);
            setIsCommandHistoryOpen(false);
            setIsTaskRunnerOpen(false);
            setIsMultiplexerOpen(false);
            setIsRecordingPanelOpen(false);
            setSearchStatus('idle');
            setSplitView(null);
            completeRecording();
            stopReplay();
        }
    }, [completeRecording, isOpen, stopReplay, setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    useTerminalBootstrapEffects({
        isOpen,
        tabsLength: tabs.length,
        tabsRef,
        availableShells,
        availableBackends,
        isLoadingShells,
        isLoadingBackends,
        isLoadingRemoteConnections,
        isNewTerminalMenuOpen,
        isCreatingRef,
        hasAutoCreatedRef,
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
        resolveDefaultBackendId,
        createTerminal,
    });

    const closeTab = useTrackedCallback(
        (id: string) => {
            const currentTabs = tabsRef.current;
            const currentActiveTabId = activeTabIdRef.current;
            const isExistingTab = currentTabs.some(tab => tab.id === id);

            if (!isExistingTab) {
                return;
            }

            const remainingTabs = currentTabs.filter(tab => tab.id !== id);
            const shouldMoveActiveTab =
                currentActiveTabId === id ||
                !currentActiveTabId ||
                !currentTabs.some(tab => tab.id === currentActiveTabId);
            const nextActiveTabId =
                remainingTabs.length === 0
                    ? null
                    : shouldMoveActiveTab
                        ? (remainingTabs[remainingTabs.length - 1]?.id ?? null)
                        : currentActiveTabId;

            clearTerminalSessionFlags(id);
            clearSemanticIssues(id);
            if (recordingCaptureRef.current?.tabId === id) {
                completeRecording();
            }
            void invokeTypedIpc<TerminalIpcContract, 'terminal:kill'>(
                'terminal:kill',
                [id],
                { responseSchema: z.boolean() }
            );

            setTabs(prev => prev.filter(tab => tab.id !== id));
            setActiveTabId(nextActiveTabId);
            activeTabIdRef.current = nextActiveTabId;

            if (remainingTabs.length === 0 && !projectIssuesTab) {
                setIsNewTerminalMenuOpen(false);
                onToggle();
            }
        },
        [clearSemanticIssues, completeRecording, onToggle, projectIssuesTab, setTabs, setActiveTabId]
    );

    useTrackedEffect(() => {
        if (displayTabs.length === 0) {
            if (activeTabId !== null) {
                setActiveTabId(null);
            }
            setIsGalleryView(false);
            setIsSemanticPanelOpen(false);
            return;
        }

        if (!activeTabId || !displayTabs.some(tab => tab.id === activeTabId)) {
            if (tabs.length > 0) {
                setActiveTabId(tabs[tabs.length - 1]?.id ?? null);
                return;
            }
            if (projectIssuesTab) {
                setActiveTabId(projectIssuesTab.id);
                return;
            }
            setActiveTabId(tabs[tabs.length - 1]?.id ?? null);
        }
    }, [activeTabId, displayTabs, projectIssuesTab, setActiveTabId, tabs]);

    useTrackedEffect(() => {
        if (!splitView) {
            return;
        }

        const tabIds = new Set(tabs.map(tab => tab.id));
        if (tabs.length < 2) {
            setSplitView(null);
            return;
        }

        let nextPrimaryId = splitView.primaryId;
        if (!tabIds.has(nextPrimaryId)) {
            nextPrimaryId =
                activeTabId && tabIds.has(activeTabId) ? activeTabId : (tabs[0]?.id ?? '');
        }

        let nextSecondaryId = splitView.secondaryId;
        if (!tabIds.has(nextSecondaryId) || nextSecondaryId === nextPrimaryId) {
            const fallbackSecondary = tabs.find(tab => tab.id !== nextPrimaryId)?.id;
            if (!fallbackSecondary) {
                setSplitView(null);
                return;
            }
            nextSecondaryId = fallbackSecondary;
        }

        if (nextPrimaryId !== splitView.primaryId || nextSecondaryId !== splitView.secondaryId) {
            setSplitView({
                primaryId: nextPrimaryId,
                secondaryId: nextSecondaryId,
                orientation: splitView.orientation,
            });
        }
    }, [activeTabId, splitView, tabs]);

    useTerminalLifecycle({
        parseSemanticChunk,
        recordingCaptureRef,
        completeRecording,
        createDefaultTerminal,
    });

    useTrackedEffect(() => {
        if (!terminalContextMenu) {
            return;
        }

        const closeContextMenu = () => {
            setTerminalContextMenu(null);
        };
        const onEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeContextMenu();
            }
        };

        window.addEventListener('mousedown', closeContextMenu);
        window.addEventListener('resize', closeContextMenu);
        window.addEventListener('keydown', onEsc);
        return () => {
            window.removeEventListener('mousedown', closeContextMenu);
            window.removeEventListener('resize', closeContextMenu);
            window.removeEventListener('keydown', onEsc);
        };
    }, [terminalContextMenu]);

    const openTerminalContextMenu = useTrackedCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setTerminalContextMenu({
            x: Math.min(event.clientX, window.innerWidth - 220),
            y: Math.min(event.clientY, window.innerHeight - 260),
        });
    }, []);

    const hideTerminalPanel = useTrackedCallback(() => {
        setTerminalContextMenu(null);
        setIsNewTerminalMenuOpen(false);
        setIsSearchOpen(false);
        setIsGalleryView(false);
        setIsAppearanceMenuOpen(false);
        setIsSemanticPanelOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        completeRecording();
        stopReplay();
        onToggle();
    }, [completeRecording, onToggle, stopReplay, setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    const handleCopySelection = useTrackedCallback(async (options?: { stripAnsi?: boolean; trimWhitespace?: boolean }) => {
        try {
            const terminal = getActiveTerminalInstance();
            let selectedText = terminal?.hasSelection()
                ? terminal.getSelection()
                : (window.getSelection()?.toString() ?? '');

            if (!selectedText) {
                return;
            }

            // Apply copy filters
            if (options?.stripAnsi) {
                selectedText = stripAnsiControlSequences(selectedText);
            }
            if (options?.trimWhitespace) {
                selectedText = selectedText.trim();
            }

            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy terminal selection', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [getActiveTerminalInstance]);

    const handleCopyWithFormatting = useTrackedCallback(async () => {
        try {
            const terminal = getActiveTerminalInstance();
            const selectedText = terminal?.hasSelection()
                ? terminal.getSelection()
                : (window.getSelection()?.toString() ?? '');

            if (!selectedText) {
                return;
            }

            const htmlContent = buildFormattedClipboardHtml(selectedText);

            // Write both plain text and HTML to clipboard
            const clipboardItem = new ClipboardItem({
                'text/plain': new Blob([selectedText], { type: 'text/plain' }),
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
            });
            await navigator.clipboard.write([clipboardItem]);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy with formatting', error as Error);
            // Fallback to plain text copy
            await handleCopySelection();
        } finally {
            setTerminalContextMenu(null);
        }
    }, [getActiveTerminalInstance, handleCopySelection]);

    const handleCopyStripAnsi = useTrackedCallback(async () => {
        await handleCopySelection({ stripAnsi: true });
    }, [handleCopySelection]);

    const handlePasteClipboard = useTrackedCallback(async () => {
        try {
            if (!activeTabIdRef.current) {
                return;
            }
            const text = await navigator.clipboard.readText();
            if (text) {
                const hasMultipleLines = /\r?\n/.test(text);
                if (hasMultipleLines) {
                    const preview = text
                        .split(/\r?\n/)
                        .slice(0, 3)
                        .join('\n')
                        .slice(0, 240);
                    const confirmed = confirmDialog(
                        `Paste ${text.split(/\r?\n/).length} lines?\n\n${preview}`
                    );
                    if (!confirmed) {
                        return;
                    }
                }
                await writeInputToTargetSessions(text);
                setPasteHistory(prev => {
                    const normalized = text.trim();
                    if (!normalized) {
                        return prev;
                    }
                    const next = [normalized, ...prev.filter(item => item !== normalized)];
                    return next.slice(0, TERMINAL_PASTE_HISTORY_LIMIT);
                });
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to paste into terminal', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [writeInputToTargetSessions]);

    const handlePasteFromHistory = useTrackedCallback(async (entry: string) => {
        try {
            if (!activeTabIdRef.current) {
                return;
            }
            await writeInputToTargetSessions(entry);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to paste from history', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [writeInputToTargetSessions]);

    const handleTestPaste = useTrackedCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                return;
            }

            const hasAnsi = ANSI_ESCAPE_SEQUENCE_REGEX.test(text);
            alertDialog(summarizePasteText(text, hasAnsi));
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to test paste', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, []);

    const handleSelectAll = useTrackedCallback(() => {
        getActiveTerminalInstance()?.selectAll();
        setTerminalContextMenu(null);
    }, [getActiveTerminalInstance]);

    const handleClearOutput = useTrackedCallback(() => {
        const terminal = getActiveTerminalInstance();
        terminal?.clearSelection();
        terminal?.clear();
        setTerminalContextMenu(null);
    }, [getActiveTerminalInstance]);

    const updateSplitAnalytics = useTrackedCallback(
        (kind: keyof Omit<SplitAnalytics, 'lastSplitActionAt'>) => {
            setSplitAnalytics(prev => incrementSplitAnalytics(prev, kind));
        },
        []
    );

    const applySplitPreset = useTrackedCallback(
        (preset: SplitPreset) => {
            const currentTabs = tabsRef.current;
            if (currentTabs.length === 0) {
                return;
            }

            const activeId = activeTabIdRef.current ?? currentTabs[0]?.id;
            if (!activeId) {
                return;
            }

            let secondaryId = resolveSecondarySplitTabId(currentTabs, activeId);
            if (!secondaryId) {
                const activeTab = currentTabs.find(tab => tab.id === activeId);
                const shellId = activeTab?.type ?? availableShells[0]?.id;
                const backendId = activeTab?.backendId ?? resolveDefaultBackendId(availableBackends);
                if (!shellId) {
                    return;
                }
                secondaryId = createTerminal(shellId, backendId);
            }

            setSplitView({
                primaryId: activeId,
                secondaryId,
                orientation: preset.orientation,
            });
            setSplitFocusedPane('primary');
            updateSplitAnalytics('splitPresetApplyCount');

            if (preset.source === 'custom') {
                setSplitPresets(prev =>
                    prev.map(item =>
                        item.id === preset.id ? { ...item, updatedAt: Date.now() } : item
                    )
                );
            }
        },
        [
            availableBackends,
            availableShells,
            createTerminal,
            resolveDefaultBackendId,
            updateSplitAnalytics,
        ]
    );

    const saveCurrentSplitAsPreset = useTrackedCallback(() => {
        if (!splitView) {
            return;
        }
        const name = promptDialog('Preset name', `Split ${splitPresets.length + 1}`)?.trim();
        if (!name) {
            return;
        }
        const preset = createCustomSplitPreset(name, splitView.orientation);
        setSplitPresets(prev => [preset, ...prev].slice(0, TERMINAL_SPLIT_PRESET_LIMIT));
    }, [splitPresets.length, splitView]);

    const renameSplitPreset = useTrackedCallback((presetId: string) => {
        setSplitPresets(prev => {
            const target = prev.find(item => item.id === presetId && item.source === 'custom');
            if (!target) {
                return prev;
            }
            const nextName = promptDialog('Rename preset', target.name)?.trim();
            if (!nextName || nextName === target.name) {
                return prev;
            }
            return prev.map(item =>
                item.id === presetId ? { ...item, name: nextName, updatedAt: Date.now() } : item
            );
        });
    }, []);

    const deleteSplitPreset = useTrackedCallback((presetId: string) => {
        setSplitPresets(prev => prev.filter(item => item.id !== presetId));
    }, []);

    const handleSplitTerminal = useTrackedCallback(() => {
        const currentTabs = tabsRef.current;
        if (currentTabs.length === 0) {
            setTerminalContextMenu(null);
            return;
        }

        const activeId = activeTabIdRef.current ?? currentTabs[0]?.id;
        if (!activeId) {
            setTerminalContextMenu(null);
            return;
        }

        let secondaryId = resolveSecondarySplitTabId(currentTabs, activeId);
        if (!secondaryId) {
            const activeTab = currentTabs.find(tab => tab.id === activeId);
            const shellId = activeTab?.type ?? availableShells[0]?.id;
            const backendId = activeTab?.backendId ?? resolveDefaultBackendId(availableBackends);
            if (!shellId) {
                setTerminalContextMenu(null);
                return;
            }
            secondaryId = createTerminal(shellId, backendId);
        }

        setSplitView(prev => ({
            primaryId: activeId,
            secondaryId,
            orientation: prev?.orientation ?? 'vertical',
        }));
        setSplitFocusedPane('primary');
        updateSplitAnalytics('splitCreatedCount');
        setTerminalContextMenu(null);
    }, [
        availableBackends,
        availableShells,
        createTerminal,
        resolveDefaultBackendId,
        updateSplitAnalytics,
    ]);

    const handleDetachTerminal = useTrackedCallback(async () => {
        const currentTabs = tabsRef.current;
        const currentActiveTabId = activeTabIdRef.current;
        const activeId = currentActiveTabId ?? currentTabs[0]?.id;
        if (!activeId) {
            setTerminalContextMenu(null);
            return;
        }

        const tabToDetach = currentTabs.find(tab => tab.id === activeId);
        if (!tabToDetach) {
            setTerminalContextMenu(null);
            return;
        }

        try {
            const detached = await invokeTypedIpc<TerminalIpcContract, 'terminal:detach'>(
                'terminal:detach',
                [{ sessionId: tabToDetach.id }],
                { responseSchema: z.boolean() }
            );
            if (!detached) {
                return;
            }

            if (recordingCaptureRef.current?.tabId === tabToDetach.id) {
                completeRecording();
            }

            const remainingTabs = currentTabs.filter(tab => tab.id !== tabToDetach.id);
            const nextActiveTabId =
                remainingTabs.length === 0
                    ? null
                    : (remainingTabs[remainingTabs.length - 1]?.id ?? null);

            setTabs(prev => prev.filter(tab => tab.id !== tabToDetach.id));
            setActiveTabId(nextActiveTabId);
            activeTabIdRef.current = nextActiveTabId;

            if (remainingTabs.length === 0 && !projectIssuesTab) {
                setIsNewTerminalMenuOpen(false);
                onToggle();
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to detach terminal tab', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [completeRecording, onToggle, projectIssuesTab, setActiveTabId, setTabs]);

    const closeSplitView = useTrackedCallback(() => {
        setSplitView(null);
        updateSplitAnalytics('splitClosedCount');
        setTerminalContextMenu(null);
    }, [updateSplitAnalytics]);

    const toggleSplitOrientation = useTrackedCallback(() => {
        setSplitView(prev => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                orientation: prev.orientation === 'vertical' ? 'horizontal' : 'vertical',
            };
        });
        updateSplitAnalytics('splitOrientationToggleCount');
        setTerminalContextMenu(null);
    }, [updateSplitAnalytics]);

    const toggleSynchronizedInput = useTrackedCallback(() => {
        setIsSynchronizedInputEnabled(prev => !prev);
        setTerminalContextMenu(null);
    }, []);

    const activeSemanticIssues = activeTabId ? (semanticIssuesByTab[activeTabId] ?? []) : [];
    const activeSemanticErrorCount = activeSemanticIssues.filter(
        issue => issue.severity === 'error'
    ).length;
    const activeSemanticWarningCount = activeSemanticIssues.filter(
        issue => issue.severity === 'warning'
    ).length;

    const applyAppearancePatch = useTrackedCallback((patch: Partial<TerminalAppearancePreferences>) => {
        setTerminalAppearance(prev => ({
            themePresetId: patch.themePresetId ?? prev.themePresetId,
            fontPresetId: patch.fontPresetId ?? prev.fontPresetId,
            ligatures: patch.ligatures ?? prev.ligatures,
            surfaceOpacity: clamp(patch.surfaceOpacity ?? prev.surfaceOpacity, 0.6, 1),
            surfaceBlur: clamp(patch.surfaceBlur ?? prev.surfaceBlur, 0, 24),
            cursorStyle: patch.cursorStyle ?? prev.cursorStyle,
            cursorBlink: patch.cursorBlink ?? prev.cursorBlink,
            fontSize: clamp(patch.fontSize ?? prev.fontSize, 8, 32),
            lineHeight: clamp(patch.lineHeight ?? prev.lineHeight, 1, 2),
            customTheme: patch.customTheme !== undefined ? patch.customTheme : prev.customTheme,
        }));
    }, []);

    const exportAppearancePreferences = useTrackedCallback(() => {
        const payload = JSON.stringify(terminalAppearance, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'terminal-theme.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, [terminalAppearance]);

    const importAppearancePreferences = useTrackedCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) {
                return;
            }
            try {
                const raw = await file.text();
                const parsed = JSON.parse(raw);

                // Validate the imported theme
                const validation = validateTerminalAppearanceImport(parsed);
                if (!validation.valid) {
                    appLogger.error(
                        'TerminalPanel',
                        `Theme validation failed: ${validation.errors.join(', ')}`
                    );
                    alertDialog(`Invalid theme file:\n${validation.errors.join('\n')}`);
                    return;
                }

                applyAppearancePatch(parsed as Partial<TerminalAppearancePreferences>);
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to import terminal appearance preset',
                    error as Error
                );
                alertDialog(t('terminal.failedImportThemeInvalidJson'));
            }
        },
        [applyAppearancePatch, t]
    );

    const toggleGalleryView = useTrackedCallback(() => {
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsSemanticPanelOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsGalleryView(prev => !prev);
    }, [setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    const toggleFloatingMode = useTrackedCallback(() => {
        if (!onFloatingChange) {
            return;
        }
        onFloatingChange(!isFloating);
    }, [isFloating, onFloatingChange]);

    const toggleSemanticPanel = useTrackedCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsSemanticPanelOpen(prev => !prev);
    }, [hasActiveSession, setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    const clearActiveSemanticIssues = useTrackedCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        clearSemanticIssues(activeTabIdRef.current);
    }, [clearSemanticIssues]);

    const resetActiveSearchCursor = useTrackedCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        delete searchCursorRef.current[activeTabIdRef.current];
        setSearchActiveMatchIndex(-1);
    }, []);

    const pushSearchHistory = useTrackedCallback((query: string) => {
        const normalized = query.trim();
        if (!normalized) {
            return;
        }
        setSearchHistory(prev => {
            const next = [normalized, ...prev.filter(item => item !== normalized)];
            return next.slice(0, TERMINAL_SEARCH_HISTORY_LIMIT);
        });
        setSearchHistoryIndex(-1);
    }, []);

    const applySearchHistoryAt = useTrackedCallback(
        (index: number) => {
            const candidate = searchHistory[index];
            if (!candidate) {
                return;
            }
            setSearchQuery(candidate);
            setSearchStatus('idle');
            setSearchMatches([]);
            setSearchActiveMatchIndex(-1);
            resetActiveSearchCursor();
            setSearchHistoryIndex(index);
        },
        [resetActiveSearchCursor, searchHistory]
    );

    const stepSearchHistory = useTrackedCallback(
        (direction: 'older' | 'newer') => {
            if (searchHistory.length === 0) {
                return;
            }

            if (direction === 'older') {
                const nextIndex = Math.min(searchHistoryIndex + 1, searchHistory.length - 1);
                applySearchHistoryAt(nextIndex);
                return;
            }

            const nextIndex = searchHistoryIndex - 1;
            if (nextIndex < 0) {
                setSearchHistoryIndex(-1);
                return;
            }
            applySearchHistoryAt(nextIndex);
        },
        [applySearchHistoryAt, searchHistory.length, searchHistoryIndex]
    );

    const collectActiveSearchMatches = useTrackedCallback(() => {
        const terminal = getActiveTerminalInstance();
        const rawQuery = searchQuery.trim();
        if (!terminal || !rawQuery) {
            return { terminal, matches: [], invalidRegex: false as const };
        }

        const buffer = terminal.buffer.active;
        const lines: string[] = [];
        for (let row = 0; row < buffer.length; row += 1) {
            lines.push(buffer.getLine(row)?.translateToString(true) ?? '');
        }

        const collected = collectTerminalSearchMatches(lines, rawQuery, {
            useRegex: searchUseRegex,
            caseSensitive: false,
            maxMatches: 400,
        });
        return {
            terminal,
            matches: collected.matches,
            invalidRegex: collected.invalidRegex,
        };
    }, [getActiveTerminalInstance, searchQuery, searchUseRegex]);

    const jumpToSearchMatch = useTrackedCallback(
        (index: number, matchesOverride?: TerminalSearchMatch[]) => {
            const terminal = getActiveTerminalInstance();
            const matches = matchesOverride ?? searchMatches;
            if (!terminal || matches.length === 0) {
                return;
            }
            const safeIndex = Math.max(0, Math.min(matches.length - 1, index));
            const target = matches[safeIndex];
            if (!target) {
                return;
            }
            terminal.select(target.col, target.row, target.length);
            terminal.scrollToLine(Math.max(0, target.row - Math.floor(terminal.rows / 2)));
            if (activeTabIdRef.current) {
                searchCursorRef.current[activeTabIdRef.current] = { row: target.row, col: target.col };
            }
            setSearchStatus('found');
            setSearchActiveMatchIndex(safeIndex);
        },
        [getActiveTerminalInstance, searchMatches]
    );

    const runTerminalSearch = useTrackedCallback(
        (direction: 'next' | 'prev') => {
            const activeId = activeTabIdRef.current;
            if (!activeId) {
                setSearchStatus('idle');
                return false;
            }
            const rawQuery = searchQuery.trim();
            if (!rawQuery) {
                setSearchStatus('idle');
                setSearchMatches([]);
                setSearchActiveMatchIndex(-1);
                return false;
            }

            pushSearchHistory(rawQuery);
            const { terminal, matches, invalidRegex } = collectActiveSearchMatches();
            if (!terminal) {
                setSearchStatus('idle');
                return false;
            }
            if (invalidRegex) {
                setSearchStatus('invalid-regex');
                setSearchMatches([]);
                setSearchActiveMatchIndex(-1);
                return false;
            }

            setSearchMatches(matches);
            if (matches.length === 0) {
                setSearchStatus('not-found');
                setSearchActiveMatchIndex(-1);
                return false;
            }

            const nextIndex =
                searchActiveMatchIndex < 0
                    ? direction === 'next'
                        ? 0
                        : matches.length - 1
                    : direction === 'next'
                        ? (searchActiveMatchIndex + 1) % matches.length
                        : (searchActiveMatchIndex - 1 + matches.length) % matches.length;

            jumpToSearchMatch(nextIndex, matches);
            return true;
        },
        [
            collectActiveSearchMatches,
            jumpToSearchMatch,
            pushSearchHistory,
            searchActiveMatchIndex,
            searchQuery,
        ]
    );

    const getSearchMatchLabel = useTrackedCallback(
        (match: TerminalSearchMatch): string => {
            const terminal = getActiveTerminalInstance();
            const line =
                terminal?.buffer.active.getLine(match.row)?.translateToString(true)?.trim() ?? '';
            if (!line) {
                return `Line ${match.row + 1}`;
            }
            return line.length > 72 ? `${line.slice(0, 72)}...` : line;
        },
        [getActiveTerminalInstance]
    );

    const revealSemanticIssue = useTrackedCallback(
        (issue: TerminalSemanticIssue) => {
            setIsSemanticPanelOpen(false);
            setSearchQuery(issue.message);
            setSearchStatus('idle');
            setSearchHistoryIndex(-1);
            setIsSearchOpen(true);
            resetActiveSearchCursor();
            window.setTimeout(() => {
                runTerminalSearch('next');
            }, 0);
        },
        [resetActiveSearchCursor, runTerminalSearch]
    );

    // AI Assistant handlers
    const getActiveShellType = useTrackedCallback(() => {
        if (!activeTabId) {
            return 'bash';
        }
        const tab = tabById.get(activeTabId);
        return tab?.type ?? 'bash';
    }, [activeTabId, tabById]);

    const handleAiExplainError = useTrackedCallback(
        async (issue: TerminalSemanticIssue) => {
            setAiSelectedIssue(issue);
            setAiPanelMode('explain-error');
            setIsAiPanelOpen(true);
            setAiIsLoading(true);
            setAiResult(null);

            try {
                const result = await invokeTypedIpc<TerminalIpcContract, 'terminal:explainError'>(
                    'terminal:explainError',
                    [{
                        errorOutput: issue.message,
                        shell: getActiveShellType(),
                        cwd: projectPath ?? undefined,
                    }],
                    { responseSchema: explainErrorResultSchema }
                );
                setAiResult({ type: 'explain-error', data: result });
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to explain error', err as Error);
                setAiResult({
                    type: 'explain-error',
                    data: {
                        summary: 'Failed to analyze error',
                        cause: 'Service error',
                        solution: 'Please try again.',
                    },
                });
            } finally {
                setAiIsLoading(false);
            }
        },
        [getActiveShellType, projectPath]
    );

    const handleAiFixError = useTrackedCallback(
        async (issue: TerminalSemanticIssue) => {
            setAiSelectedIssue(issue);
            setAiPanelMode('fix-error');
            setIsAiPanelOpen(true);
            setAiIsLoading(true);
            setAiResult(null);

            // Try to get the last command from history
            let lastCommand = '';
            try {
                const history = await invokeTypedIpc<TerminalIpcContract, 'terminal:getCommandHistory'>(
                    'terminal:getCommandHistory',
                    ['', 1],
                    { responseSchema: z.array(terminalCommandHistoryEntrySchema) }
                );
                if (history.length > 0) {
                    lastCommand = history[0]?.command ?? '';
                }
            } catch {
                // Ignore history fetch errors
            }

            try {
                const result = await invokeTypedIpc<TerminalIpcContract, 'terminal:fixError'>(
                    'terminal:fixError',
                    [{
                        errorOutput: issue.message,
                        command: lastCommand,
                        shell: getActiveShellType(),
                        cwd: projectPath ?? undefined,
                    }],
                    { responseSchema: fixErrorResultSchema }
                );
                setAiResult({ type: 'fix-error', data: result });
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to suggest fix', err as Error);
                setAiResult({
                    type: 'fix-error',
                    data: {
                        suggestedCommand: '',
                        explanation: 'Failed to suggest fix. Please try again.',
                        confidence: 'low',
                    },
                });
            } finally {
                setAiIsLoading(false);
            }
        },
        [getActiveShellType, projectPath]
    );

    const handleAiApplyFix = useTrackedCallback(
        async (command: string) => {
            if (!activeTabId || !command) {
                return;
            }

            try {
                await writeCommandToActiveTerminal(command);
                setIsAiPanelOpen(false);
                setAiResult(null);
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to apply fix command', err as Error);
            }
        },
        [activeTabId, writeCommandToActiveTerminal]
    );

    const closeAiPanel = useTrackedCallback(() => {
        setIsAiPanelOpen(false);
        setAiResult(null);
        setAiSelectedIssue(null);
    }, []);

    const openTerminalSearch = useTrackedCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        setTerminalContextMenu(null);
        setIsGalleryView(false);
        setIsSemanticPanelOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsSearchOpen(true);
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        setSearchHistoryIndex(-1);
        resetActiveSearchCursor();
    }, [hasActiveSession, resetActiveSearchCursor, setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    const closeTerminalSearch = useTrackedCallback(() => {
        setIsSearchOpen(false);
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        setSearchHistoryIndex(-1);
        const terminal = getActiveTerminalInstance();
        terminal?.clearSelection();
        resetActiveSearchCursor();
    }, [getActiveTerminalInstance, resetActiveSearchCursor]);

    const applyShortcutPreset = useTrackedCallback((presetId: TerminalShortcutPresetId) => {
        setShortcutPreset(presetId);
        setShortcutBindings(TERMINAL_SHORTCUT_PRESETS[presetId]);
    }, []);

    const applyShortcutPayload = useTrackedCallback(
        (
            payload: {
                preset: TerminalShortcutPresetId | null;
                bindings: Partial<TerminalShortcutBindings>;
            },
            source: 'file' | 'share-code'
        ) => {
            if (payload.preset) {
                setShortcutPreset(payload.preset);
            }
            if (Object.keys(payload.bindings).length > 0) {
                setShortcutBindings(prev => ({
                    ...prev,
                    ...sanitizeShortcutBindings(payload.bindings),
                }));
            }
            if (!payload.preset && Object.keys(payload.bindings).length === 0) {
                appLogger.warn('TerminalPanel', `Ignored empty shortcut payload from ${source}`);
            }
        },
        []
    );

    const exportShortcutPreferences = useTrackedCallback(() => {
        const payload = serializeShortcutStorage(shortcutPreset, shortcutBindings);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'terminal-shortcuts.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, [shortcutBindings, shortcutPreset]);

    const importShortcutPreferences = useTrackedCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) {
                return;
            }
            try {
                const raw = await file.text();
                const parsed = parseShortcutStorage(raw);
                applyShortcutPayload(parsed, 'file');
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to import terminal shortcut settings',
                    error as Error
                );
            }
        },
        [applyShortcutPayload]
    );

    const shareShortcutPreferences = useTrackedCallback(async () => {
        try {
            const shareCode = createShortcutShareCode(shortcutPreset, shortcutBindings);
            await navigator.clipboard.writeText(shareCode);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy shortcut share code', error as Error);
        }
    }, [shortcutBindings, shortcutPreset]);

    const importShortcutShareCode = useTrackedCallback(() => {
        const raw = promptDialog('Paste shortcut share code');
        if (!raw?.trim()) {
            return;
        }
        const parsed = parseShortcutShareCode(raw);
        applyShortcutPayload(parsed, 'share-code');
    }, [applyShortcutPayload]);

    useTrackedEffect(() => {
        if (!isSearchOpen) {
            return;
        }
        const timer = window.setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
        }, 0);
        return () => {
            window.clearTimeout(timer);
        };
    }, [isSearchOpen]);

    useTrackedEffect(() => {
        if (!isSearchOpen) {
            return;
        }
        const rawQuery = searchQuery.trim();
        if (!rawQuery) {
            setSearchMatches([]);
            setSearchStatus('idle');
            setSearchActiveMatchIndex(-1);
            return;
        }
        const { matches, invalidRegex } = collectActiveSearchMatches();
        if (invalidRegex) {
            setSearchStatus('invalid-regex');
            setSearchMatches([]);
            setSearchActiveMatchIndex(-1);
            return;
        }
        setSearchMatches(matches);
        if (matches.length === 0) {
            setSearchStatus('not-found');
            setSearchActiveMatchIndex(-1);
            return;
        }
        if (searchStatus !== 'found') {
            setSearchStatus('idle');
        }
        if (searchActiveMatchIndex >= matches.length) {
            setSearchActiveMatchIndex(-1);
        }
    }, [
        collectActiveSearchMatches,
        isSearchOpen,
        searchActiveMatchIndex,
        searchQuery,
        searchStatus,
    ]);

    useTrackedEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [activeTabId, resetActiveSearchCursor]);

    useTrackedEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [resetActiveSearchCursor, searchUseRegex]);

    useTrackedEffect(() => {
        const handleShortcut = createTerminalShortcutEventHandler({
            isOpen,
            isSearchOpen,
            shortcutBindings,
            activeTabIdRef,
            hideTerminalPanel,
            createDefaultTerminal,
            closeTab,
            closeTerminalSearch,
            openTerminalSearch,
            handleSplitTerminal,
            handleDetachTerminal,
        });

        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, [
        closeTab,
        closeTerminalSearch,
        createDefaultTerminal,
        handleDetachTerminal,
        handleSplitTerminal,
        hideTerminalPanel,
        isOpen,
        isSearchOpen,
        openTerminalSearch,
        shortcutBindings,
    ]);

    const reorderTabs = useTrackedCallback(
        (sourceId: string, targetId: string) => {
            if (sourceId === targetId) {
                return;
            }

            setTabs(prev => {
                const sourceIndex = prev.findIndex(tab => tab.id === sourceId);
                const targetIndex = prev.findIndex(tab => tab.id === targetId);

                if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
                    return prev;
                }

                const next = [...prev];
                const [moved] = next.splice(sourceIndex, 1);
                next.splice(targetIndex, 0, moved);
                return next;
            });
        },
        [setTabs]
    );

    const handleTabDragStart = useTrackedCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            setDraggingTabId(tabId);
            setDragOverTabId(tabId);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', tabId);
        },
        []
    );

    const handleTabDragOver = useTrackedCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            if (!draggingTabId || draggingTabId === tabId) {
                return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDragOverTabId(tabId);
        },
        [draggingTabId]
    );

    const resetTabDragState = useTrackedCallback(() => {
        setDraggingTabId(null);
        setDragOverTabId(null);
    }, []);

    const handleTabDrop = useTrackedCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            event.preventDefault();
            const sourceId = draggingTabId || event.dataTransfer.getData('text/plain');
            if (!sourceId || sourceId === tabId) {
                resetTabDragState();
                return;
            }

            reorderTabs(sourceId, tabId);
            resetTabDragState();
        },
        [draggingTabId, reorderTabs, resetTabDragState]
    );

    const handleTabSelect = useTrackedCallback(
        (tabId: string) => {
            if (tabId === TERMINAL_PROJECT_ISSUES_TAB_ID) {
                setActiveTabId(tabId);
                setSplitView(null);
                setIsGalleryView(false);
                setIsSearchOpen(false);
                setIsSemanticPanelOpen(false);
                setIsCommandHistoryOpen(false);
                setIsTaskRunnerOpen(false);
                setIsMultiplexerOpen(false);
                setIsRecordingPanelOpen(false);
                return;
            }
            setActiveTabId(tabId);
            if (!splitView) {
                return;
            }
            if (splitView.primaryId === tabId) {
                setSplitFocusedPane('primary');
                return;
            }
            if (splitView.secondaryId === tabId) {
                setSplitFocusedPane('secondary');
                return;
            }
            setSplitView(prev => {
                if (!prev) {
                    return prev;
                }
                return splitFocusedPane === 'primary'
                    ? { ...prev, primaryId: tabId }
                    : { ...prev, secondaryId: tabId };
            });
        },
        [
            setActiveTabId,
            setIsCommandHistoryOpen,
            setIsGalleryView,
            setIsMultiplexerOpen,
            setIsRecordingPanelOpen,
            setIsSearchOpen,
            setIsSemanticPanelOpen,
            setIsTaskRunnerOpen,
            setSplitFocusedPane,
            setSplitView,
            splitFocusedPane,
            splitView,
        ]
    );

    const handlePaneActivate = useTrackedCallback(
        (tabId: string) => {
            setActiveTabId(tabId);
            if (!splitView) {
                return;
            }
            setSplitFocusedPane(splitView.primaryId === tabId ? 'primary' : 'secondary');
        },
        [setActiveTabId, splitView]
    );

    const getTabLayoutClass = useTrackedCallback(
        (tabId: string) => {
            if (!splitView) {
                return tabId === activeTabId ? 'absolute inset-0' : 'absolute inset-0';
            }

            if (tabId === splitView.primaryId) {
                if (splitView.orientation === 'vertical') {
                    return cn(
                        'absolute inset-y-0 left-0 w-1/2 border-r border-border/60',
                        activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                    );
                }
                return cn(
                    'absolute inset-x-0 top-0 h-1/2 border-b border-border/60',
                    activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                );
            }

            if (tabId === splitView.secondaryId) {
                if (splitView.orientation === 'vertical') {
                    return cn(
                        'absolute inset-y-0 right-0 w-1/2',
                        activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                    );
                }
                return cn(
                    'absolute inset-x-0 bottom-0 h-1/2',
                    activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                );
            }

            return 'absolute inset-0';
        },
        [activeTabId, splitView]
    );

    const resolvedDefaultBackendId = resolveDefaultBackendId(availableBackends);
    const {
        selectableBackends,
        integratedBackend,
        launchableExternalBackends,
        defaultBackendName,
    } = useMemo(() => {
        const selectable: typeof availableBackends = [];
        const launchable: typeof availableBackends = [];
        let integrated: (typeof availableBackends)[number] | undefined;
        let defaultName = 'Unknown';

        for (const backend of availableBackends) {
            if (!backend.available) {
                continue;
            }
            selectable.push(backend);
            if (backend.id === 'node-pty') {
                integrated = backend;
            } else {
                launchable.push(backend);
            }
            if (backend.id === resolvedDefaultBackendId) {
                defaultName = backend.name;
            }
        }

        return {
            selectableBackends: selectable,
            integratedBackend: integrated,
            launchableExternalBackends: launchable,
            defaultBackendName: defaultName,
        };
    }, [availableBackends, resolvedDefaultBackendId]);
    const isLoadingLaunchOptions = isLoadingShells || isLoadingBackends;
    const hasRemoteConnections = remoteSshProfiles.length > 0 || remoteDockerContainers.length > 0;
    const splitPresetOptions = useMemo(
        () => [...DEFAULT_SPLIT_PRESETS, ...splitPresets],
        [splitPresets]
    );
    const themeCategoryLabel = (preset: TerminalAppearancePreset) =>
        preset.category === 'community' ? t('terminal.communityTheme') : t('terminal.defaultTheme');
    const resolvedTerminalAppearance = useMemo(() => {
        void theme;
        return resolveTerminalAppearance(getTerminalTheme(), terminalAppearance);
    }, [terminalAppearance, theme]);
    const terminalChromeStyle = {
        backgroundColor: `hsl(var(--background) / ${terminalAppearance.surfaceOpacity})`,
        backdropFilter: `blur(${terminalAppearance.surfaceBlur}px)`,
    };
    const selectedRecordingText = selectedRecording
        ? selectedRecording.events
            .filter(event => event.type === 'data')
            .map(event => event.data)
            .join('')
            .slice(-24000)
        : '';
    const activeRecordingLabel = activeRecordingTabId
        ? tabById.get(activeRecordingTabId)?.name ?? activeRecordingTabId
        : null;

    return (
        <motion.div
            className="flex flex-col h-full w-full overflow-hidden border border-border/60"
            style={terminalChromeStyle}
            data-terminal-module="terminal-manager"
            data-terminal-module-version={TERMINAL_MANAGER_MODULE_VERSION}
        >
            <TerminalToolbar
                tabs={displayTabs}
                activeTabId={activeTabId}
                draggingTabId={draggingTabId}
                dragOverTabId={dragOverTabId}
                handleTabSelect={handleTabSelect}
                closeTab={closeTab}
                handleTabDragStart={handleTabDragStart}
                handleTabDragOver={handleTabDragOver}
                handleTabDrop={handleTabDrop}
                resetTabDragState={resetTabDragState}
                isNewTerminalMenuOpen={isNewTerminalMenuOpen}
                setIsNewTerminalMenuOpen={setIsNewTerminalMenuOpen}
                isLoadingLaunchOptions={isLoadingLaunchOptions}
                availableShells={availableShells}
                selectableBackends={selectableBackends}
                integratedBackend={integratedBackend}
                launchableExternalBackends={launchableExternalBackends}
                defaultBackendName={defaultBackendName}
                resolvedDefaultBackendId={resolvedDefaultBackendId}
                persistPreferredBackendId={persistPreferredBackendId}
                createTerminal={createTerminal}
                resolvePreferredShellId={resolvePreferredShellId}
                t={t}
                isLoadingRemoteConnections={isLoadingRemoteConnections}
                remoteSshProfiles={remoteSshProfiles}
                remoteDockerContainers={remoteDockerContainers}
                hasRemoteConnections={hasRemoteConnections}
                createRemoteTerminal={createRemoteTerminal}
                isSplitPresetMenuOpen={isSplitPresetMenuOpen}
                setIsSplitPresetMenuOpen={setIsSplitPresetMenuOpen}
                splitView={splitView}
                splitPresetOptions={splitPresetOptions}
                splitAnalytics={splitAnalytics}
                isSynchronizedInputEnabled={isSynchronizedInputEnabled}
                saveCurrentSplitAsPreset={saveCurrentSplitAsPreset}
                applySplitPreset={applySplitPreset}
                renameSplitPreset={renameSplitPreset}
                deleteSplitPreset={deleteSplitPreset}
                resetSplitAnalytics={() => {
                    setSplitAnalytics(DEFAULT_SPLIT_ANALYTICS);
                }}
                toggleSynchronizedInput={toggleSynchronizedInput}
                toggleSplitOrientation={toggleSplitOrientation}
                closeSplitView={closeSplitView}
                isGalleryView={isGalleryView}
                toggleGalleryView={toggleGalleryView}
                onFloatingChange={onFloatingChange}
                toggleFloatingMode={toggleFloatingMode}
                isFloating={isFloating}
                toggleSemanticPanel={toggleSemanticPanel}
                hasActiveSession={hasActiveSession}
                activeSemanticIssuesLength={activeSemanticIssues.length}
                activeSemanticErrorCount={activeSemanticErrorCount}
                openMultiplexerPanel={openMultiplexerPanel}
                isMultiplexerOpen={isMultiplexerOpen}
                toggleRecording={toggleRecording}
                activeRecordingTabId={activeRecordingTabId}
                isMaximized={isMaximized}
                setIsMaximized={setIsMaximized}
                onToggle={onToggle}
                appearanceProps={{
                    inputRef: appearanceImportInputRef,
                    onImport: event => {
                        void importAppearancePreferences(event);
                    },
                    isAppearanceMenuOpen,
                    setIsAppearanceMenuOpen,
                    title: t('terminal.appearance'),
                    t,
                    terminalAppearance,
                    resolvedTerminalAppearance,
                    themePresets: TERMINAL_THEME_PRESETS,
                    fontPresets: TERMINAL_FONT_PRESETS,
                    cursorStyles: TERMINAL_CURSOR_STYLES,
                    themeCategoryLabel,
                    applyAppearancePatch,
                    exportAppearancePreferences,
                    openAppearanceImportDialog: () => {
                        appearanceImportInputRef.current?.click();
                    },
                    shortcutInputRef: shortcutImportInputRef,
                    onShortcutImport: event => {
                        void importShortcutPreferences(event);
                    },
                    shortcutPreset,
                    applyShortcutPreset,
                    exportShortcutPreferences,
                    openShortcutImportDialog: () => {
                        shortcutImportInputRef.current?.click();
                    },
                    shareShortcutPreferences,
                    importShortcutShareCode,
                }}
            />
            <TerminalSplitView
                onContextMenu={openTerminalContextMenu}
                isGalleryView={isGalleryView}
                tabs={displayTabs}
                activeTabId={activeTabId}
                splitView={splitView}
                getTabLayoutClass={getTabLayoutClass}
                handlePaneActivate={handlePaneActivate}
                closeTab={closeTab}
                handleTabSelect={handleTabSelect}
                setIsGalleryView={setIsGalleryView}
                projectPath={projectPath}
                terminalAppearance={terminalAppearance}
                resolvedTerminalAppearance={resolvedTerminalAppearance}
                setTerminalInstance={setTerminalInstance}
                emptyTitle={t('terminal.noActiveSessions')}
                emptyActionLabel={t('terminal.startNewSession')}
                createDefaultTerminal={createDefaultTerminal}
                renderTabContent={tab =>
                    tab.id === TERMINAL_PROJECT_ISSUES_TAB_ID ? (
                        <TerminalProjectIssuesTab
                            projectId={projectId}
                            projectPath={projectPath}
                            onOpenFile={onOpenFile}
                        />
                    ) : null
                }
            />
            <TerminalOverlays
                terminalContextMenu={terminalContextMenu}
                canUseGallery={displayTabs.length > 1}
                isGalleryView={isGalleryView}
                contextMenuProps={{
                    hasActiveSession,
                    onCopy: () => {
                        void handleCopySelection();
                    },
                    onCopyWithFormatting: () => {
                        void handleCopyWithFormatting();
                    },
                    onCopyStripAnsi: () => {
                        void handleCopyStripAnsi();
                    },
                    onPaste: () => {
                        void handlePasteClipboard();
                    },
                    onTestPaste: () => {
                        void handleTestPaste();
                    },
                    onSelectAll: handleSelectAll,
                    onSearch: openTerminalSearch,
                    onSemanticToggle: toggleSemanticPanel,
                    onGalleryToggle: toggleGalleryView,
                    onFloatingToggle: onFloatingChange
                        ? () => {
                            toggleFloatingMode();
                            setTerminalContextMenu(null);
                        }
                        : undefined,
                    onHistoryToggle: openCommandHistory,
                    onTaskRunnerToggle: openTaskRunner,
                    onMultiplexerToggle: openMultiplexerPanel,
                    onRecordingToggle: () => {
                        toggleRecording();
                        setTerminalContextMenu(null);
                    },
                    onOpenRecordings: () => {
                        setTerminalContextMenu(null);
                        setIsSearchOpen(false);
                        setIsGalleryView(false);
                        setIsSemanticPanelOpen(false);
                        setIsCommandHistoryOpen(false);
                        setIsTaskRunnerOpen(false);
                        setIsMultiplexerOpen(false);
                        setIsRecordingPanelOpen(true);
                    },
                    onNewTerminal: () => {
                        void createDefaultTerminal();
                        setTerminalContextMenu(null);
                    },
                    onHidePanel: hideTerminalPanel,
                    onClearOutput: handleClearOutput,
                    onSplit: handleSplitTerminal,
                    onDetach: () => {
                        void handleDetachTerminal();
                    },
                    onToggleSynchronizedInput: toggleSynchronizedInput,
                    onCloseSplit: closeSplitView,
                    onToggleSplitOrientation: toggleSplitOrientation,
                    splitActive: Boolean(splitView),
                    isSynchronizedInputEnabled,
                    isRecordingActive: Boolean(activeRecordingTabId),
                    semanticIssueCount: activeSemanticIssues.length,
                    semanticErrorCount: activeSemanticErrorCount,
                    semanticWarningCount: activeSemanticWarningCount,
                    isFloating,
                    projectPath,
                    pasteHistory,
                    onPasteHistory: entry => {
                        void handlePasteFromHistory(entry);
                    },
                    labels: {
                        copy: t('common.copy'),
                        copyWithFormatting: t('terminal.copyWithFormatting'),
                        copyStripAnsi: t('terminal.copyStripAnsi'),
                        paste: t('terminal.paste'),
                        pasteTest: 'Test Paste',
                        pasteHistory: 'Paste History',
                        selectAll: t('common.selectAll'),
                        search: t('common.search'),
                        semanticIssues: t('terminal.semanticIssues'),
                        galleryView: t('terminal.galleryView'),
                        exitGalleryView: t('terminal.exitGalleryView'),
                        floatTerminal: t('terminal.floatTerminal'),
                        dockTerminal: t('terminal.dockTerminal'),
                        commandHistory: t('terminal.commandHistory'),
                        runTask: t('terminal.runTask'),
                        multiplexer: 'Multiplexer (tmux/screen)',
                        startRecording: 'Start Recording',
                        stopRecording: 'Stop Recording',
                        sessionRecordings: 'Session Recordings',
                        clearOutput: t('terminal.clearOutput'),
                        split: t('terminal.split'),
                        synchronizedInputOn: 'Disable Synchronized Input',
                        synchronizedInputOff: 'Enable Synchronized Input',
                        detach: t('terminal.detach'),
                        toggleSplitOrientation: t('terminal.toggleSplitOrientation'),
                        closeSplit: t('terminal.closeSplit'),
                        newTerminal: t('terminal.new'),
                        hide: t('terminal.hide'),
                    },
                }}
                semanticPanelProps={
                    isSemanticPanelOpen
                        ? {
                            t,
                            activeSemanticIssues,
                            activeSemanticErrorCount,
                            activeSemanticWarningCount,
                            clearActiveSemanticIssues,
                            revealSemanticIssue,
                            handleAiExplainError,
                            handleAiFixError,
                        }
                        : null
                }
                t={t}
                isAiPanelOpen={isAiPanelOpen}
                aiPanelMode={aiPanelMode}
                aiSelectedIssue={aiSelectedIssue}
                aiIsLoading={aiIsLoading}
                aiResult={aiResult}
                closeAiPanel={closeAiPanel}
                handleAiApplyFix={handleAiApplyFix}
                multiplexerPanelProps={
                    isMultiplexerOpen
                        ? {
                            t,
                            hasActiveSession,
                            multiplexerMode,
                            multiplexerSessionName,
                            multiplexerSessions,
                            isMultiplexerLoading,
                            multiplexerError,
                            closeMultiplexerPanel,
                            setMultiplexerMode,
                            refreshMultiplexerSessions,
                            setMultiplexerSessionName,
                            createMultiplexerSession,
                            attachMultiplexerSession,
                        }
                        : null
                }
                recordingPanelProps={
                    isRecordingPanelOpen
                        ? {
                            t,
                            hasActiveSession,
                            activeRecordingTabId,
                            activeRecordingLabel,
                            recordings,
                            selectedRecordingId,
                            selectedRecording,
                            selectedRecordingText,
                            replayText,
                            isReplayRunning,
                            setIsRecordingPanelOpen,
                            toggleRecording,
                            startReplay,
                            stopReplay,
                            exportRecording,
                            setSelectedRecordingId,
                            setReplayText,
                        }
                        : null
                }
                searchOverlayProps={
                    isSearchOpen
                        ? {
                            t,
                            searchInputRef,
                            searchQuery,
                            searchUseRegex,
                            searchStatus,
                            searchMatches,
                            searchActiveMatchIndex,
                            searchHistory,
                            setSearchQuery,
                            setSearchUseRegex,
                            setSearchStatus,
                            setSearchMatches,
                            setSearchActiveMatchIndex,
                            setSearchHistoryIndex,
                            resetActiveSearchCursor,
                            runTerminalSearch,
                            closeTerminalSearch,
                            stepSearchHistory,
                            jumpToSearchMatch,
                            getSearchMatchLabel,
                        }
                        : null
                }
                commandPanelsProps={{
                    t,
                    isCommandHistoryOpen,
                    isCommandHistoryLoading,
                    commandHistoryQuery,
                    commandHistoryItems,
                    setCommandHistoryQuery,
                    closeCommandHistory,
                    clearCommandHistory: async () => {
                        await clearCommandHistory();
                    },
                    executeHistoryCommand: async entry => {
                        await executeHistoryCommand(entry);
                    },
                    isTaskRunnerOpen,
                    isTaskRunnerLoading,
                    taskRunnerQuery,
                    taskRunnerItems,
                    setTaskRunnerQuery,
                    closeTaskRunner,
                    executeTaskRunnerEntry: async entry => {
                        await executeTaskRunnerEntry(entry);
                    },
                }}
            />
        </motion.div>
    );
}

function TerminalPanelContent(props: TerminalPanelProps) {
    return <TerminalPanelContentImpl {...props} />;
}

export function TerminalPanel(props: TerminalPanelProps) {
    return <TerminalPanelContent {...props} />;
}


