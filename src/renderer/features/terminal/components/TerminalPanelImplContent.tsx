import { useTranslation } from '@renderer/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ITheme, Terminal as XTerm } from 'xterm';

import { useTheme } from '@/hooks/useTheme';
import { motion } from '@/lib/framer-motion-compat';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { useTerminalAppearance } from '../hooks/useTerminalAppearance';
import { useTerminalCommandTools } from '../hooks/useTerminalCommandTools';
import { useTerminalLifecycle } from '../hooks/useTerminalLifecycle';
import { useTerminalPasteHistory } from '../hooks/useTerminalPasteHistory';
import { useTerminalSearch } from '../hooks/useTerminalSearch';
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
import { buildFormattedClipboardHtml, summarizePasteText } from '../utils/terminal-panel-helpers';
import {
    collectTerminalSearchMatches,
    type TerminalSearchMatch,
} from '../utils/terminal-search';

import { TerminalOverlays } from './TerminalOverlays';
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
const TERMINAL_MANAGER_MODULE_VERSION = serializeTerminalModuleVersion();
const ANSI_ESCAPE_SEQUENCE_REGEX = new RegExp(
    String.raw`\x1B(?:\[[0-?]*[ -/]*[@-~]|[@-Z\\-_]|\][^\x07]*(?:\x07|\x1B\\))`,
    'g'
);
const TERMINAL_SEMANTIC_MAX_ISSUES_PER_TAB = 80;
const TERMINAL_SEMANTIC_DEDUPE_WINDOW_MS = 1500;
const TERMINAL_SEMANTIC_ERROR_PATTERNS = [
    /\berror\b/i,
    /\bfailed\b/i,
    /\bexception\b/i,
    /\btraceback\b/i,
    /\bpanic\b/i,
    /\bnpm ERR!/i,
    /\berr:?\b/i,
];
const TERMINAL_SEMANTIC_WARNING_PATTERNS = [
    /\bwarning\b/i,
    /\bwarn\b/i,
    /\bdeprecated\b/i,
    /\bcaution\b/i,
];

function toDisplayString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function quoteCommandValue(value: string): string {
    if (!value) {
        return '""';
    }
    if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) {
        return value;
    }
    return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function normalizeSshProfiles(raw: unknown): RemoteSshProfile[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const profiles: RemoteSshProfile[] = [];
    raw.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const record = item as Record<string, unknown>;
        const host = toDisplayString(record.host);
        const username = toDisplayString(record.username);
        if (!host || !username) {
            return;
        }
        const port = Number(record.port) > 0 ? Number(record.port) : 22;
        const profileId = toDisplayString(record.id) || `${username}@${host}:${port}:${index}`;
        const fallbackName = `${username}@${host}`;
        profiles.push({
            id: profileId,
            name: toDisplayString(record.name) || fallbackName,
            host,
            port,
            username,
            privateKey: toDisplayString(record.privateKey) || undefined,
            jumpHost: toDisplayString(record.jumpHost) || undefined,
        });
    });
    return profiles;
}

function parseDockerContainerRecord(
    record: Record<string, unknown>,
    index: number
): RemoteDockerContainer | null {
    const id =
        toDisplayString(record.id) ||
        toDisplayString(record.ID) ||
        toDisplayString(record.Id) ||
        toDisplayString(record.ContainerID);
    if (!id) {
        return null;
    }

    const name =
        toDisplayString(record.name) ||
        toDisplayString(record.Names) ||
        toDisplayString(record.Name) ||
        `container-${index + 1}`;

    const status = toDisplayString(record.status) || toDisplayString(record.Status) || 'unknown';

    const shell = toDisplayString(record.shell) || '/bin/sh';
    return { id, name, status, shell };
}

function normalizeDockerContainers(raw: unknown): RemoteDockerContainer[] {
    let rows: unknown[] = [];
    if (Array.isArray(raw)) {
        rows = raw;
    } else if (raw && typeof raw === 'object') {
        const containerRows = (raw as Record<string, unknown>).containers;
        if (Array.isArray(containerRows)) {
            rows = containerRows;
        }
    }

    const containers: RemoteDockerContainer[] = [];
    rows.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const parsed = parseDockerContainerRecord(item as Record<string, unknown>, index);
        if (parsed) {
            containers.push(parsed);
        }
    });
    return containers;
}

function parseTmuxSessions(raw: string): MultiplexerSession[] {
    const sessions: MultiplexerSession[] = [];
    raw.split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach((line, index) => {
            const [id, windows, attached] = line.split('|');
            const sessionId = (id ?? '').trim();
            if (!sessionId) {
                return;
            }
            const details: string[] = [];
            if (windows?.trim()) {
                details.push(`${windows.trim()} windows`);
            }
            if (attached?.trim()) {
                details.push(attached.trim() === '1' ? 'attached' : 'detached');
            }
            sessions.push({
                id: sessionId,
                label: sessionId,
                details: details.length > 0 ? details.join(' - ') : `session ${index + 1}`,
            });
        });
    return sessions;
}

function parseScreenSessions(raw: string): MultiplexerSession[] {
    const sessions: MultiplexerSession[] = [];
    raw.split(/\r?\n/)
        .map(line => line.trim())
        .forEach(line => {
            const match = line.match(/^(\d+\.[^\s]+)\s+\((Attached|Detached)\)$/i);
            if (!match) {
                return;
            }
            const rawId = match[1] ?? '';
            const status = (match[2] ?? '').toLowerCase();
            const sessionName = rawId.split('.').slice(1).join('.') || rawId;
            sessions.push({
                id: rawId,
                label: sessionName,
                details: status,
            });
        });
    return sessions;
}

export interface TerminalPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    isMaximized?: boolean;
    onMaximizeChange?: (isMaximized: boolean) => void;
    isFloating?: boolean;
    onFloatingChange?: (isFloating: boolean) => void;
    projectPath?: string;
    tabs: TerminalTab[];
    activeTabId: string | null;
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
}

type RemoteSshProfile = {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    jumpHost?: string;
};

type RemoteDockerContainer = {
    id: string;
    name: string;
    status: string;
    shell: string;
};

type RemoteConnectionTarget =
    | {
        kind: 'ssh';
        profile: RemoteSshProfile;
    }
    | {
        kind: 'docker';
        container: RemoteDockerContainer;
    };

type MultiplexerMode = 'tmux' | 'screen';

type MultiplexerSession = {
    id: string;
    label: string;
    details?: string;
};

type TerminalRecordingEvent = {
    at: number;
    type: 'data' | 'exit';
    data: string;
};

type TerminalRecording = {
    id: string;
    tabId: string;
    tabName: string;
    startedAt: number;
    endedAt: number;
    durationMs: number;
    events: TerminalRecordingEvent[];
};

type TerminalSemanticIssue = {
    id: string;
    tabId: string;
    severity: 'error' | 'warning';
    message: string;
    timestamp: number;
};

type TerminalBackendInfo = {
    id: string;
    name: string;
    available: boolean;
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

function detectSemanticSeverity(line: string): 'error' | 'warning' | null {
    if (TERMINAL_SEMANTIC_ERROR_PATTERNS.some(pattern => pattern.test(line))) {
        return 'error';
    }
    if (TERMINAL_SEMANTIC_WARNING_PATTERNS.some(pattern => pattern.test(line))) {
        return 'warning';
    }
    return null;
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

function TerminalPanelContent({
    isOpen,
    onToggle,
    isMaximized: isMaximizedProp = false,
    onMaximizeChange: onMaximizeChangeProp,
    isFloating = false,
    onFloatingChange,
    projectPath,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
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
    const [semanticIssuesByTab, setSemanticIssuesByTab] = useState<
        Record<string, TerminalSemanticIssue[]>
    >({});
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
    const [isLoadingShells, setIsLoadingShells] = useState(false);
    const [isLoadingBackends, setIsLoadingBackends] = useState(false);
    const [availableShells, setAvailableShells] = useState<
        { id: string; name: string; path: string }[]
    >([]);
    const [availableBackends, setAvailableBackends] = useState<TerminalBackendInfo[]>([]);
    const [isLoadingRemoteConnections, setIsLoadingRemoteConnections] = useState(false);
    const [remoteSshProfiles, setRemoteSshProfiles] = useState<RemoteSshProfile[]>([]);
    const [remoteDockerContainers, setRemoteDockerContainers] = useState<RemoteDockerContainer[]>(
        []
    );
    const [preferredBackendId, setPreferredBackendId] = useState<string | null>(null);
    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });
    const [multiplexerMode, setMultiplexerMode] = useState<MultiplexerMode>('tmux');
    const [multiplexerSessionName, setMultiplexerSessionName] = useState('main');
    const [isMultiplexerLoading, setIsMultiplexerLoading] = useState(false);
    const [multiplexerSessions, setMultiplexerSessions] = useState<MultiplexerSession[]>([]);
    const [multiplexerError, setMultiplexerError] = useState<string | null>(null);
    const [recordings, setRecordings] = useState<TerminalRecording[]>([]);
    const [activeRecordingTabId, setActiveRecordingTabId] = useState<string | null>(null);
    const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
    const [isReplayRunning, setIsReplayRunning] = useState(false);
    const { pasteHistory, setPasteHistory } = useTerminalPasteHistory({
        storageKey: TERMINAL_PASTE_HISTORY_STORAGE_KEY,
        historyLimit: TERMINAL_PASTE_HISTORY_LIMIT,
    });
    const { shortcutPreset, setShortcutPreset, shortcutBindings, setShortcutBindings } =
        useTerminalShortcuts({ storageKey: TERMINAL_SHORTCUTS_STORAGE_KEY });

    // AI Assistant state
    const [aiPanelMode, setAiPanelMode] = useState<
        'explain-error' | 'fix-error' | 'explain-command'
    >('explain-error');
    const [aiSelectedIssue, setAiSelectedIssue] = useState<TerminalSemanticIssue | null>(null);
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiResult, setAiResult] = useState<{
        type: 'explain-error' | 'fix-error' | 'explain-command';
        data: Record<string, unknown>;
    } | null>(null);
    const [replayText, setReplayText] = useState('');
    const tabsRef = useRef<TerminalTab[]>(tabs);
    const activeTabIdRef = useRef<string | null>(activeTabId);
    const terminalInstancesRef = useRef<Record<string, XTerm | null>>({});
    const appearanceImportInputRef = useRef<HTMLInputElement | null>(null);
    const shortcutImportInputRef = useRef<HTMLInputElement | null>(null);
    const semanticCarryByTabRef = useRef<Record<string, string>>({});
    const semanticRecentBySignatureRef = useRef<Record<string, number>>({});
    const recordingCaptureRef = useRef<{
        tabId: string;
        tabName: string;
        startedAt: number;
        events: TerminalRecordingEvent[];
    } | null>(null);
    const replayTimeoutsRef = useRef<number[]>([]);
    const hasActiveSession = Boolean(activeTabId);

    useTrackedEffect(() => {
        tabsRef.current = tabs;
    }, [tabs]);

    useTrackedEffect(() => {
        const validTabIds = new Set(tabs.map(tab => tab.id));
        Object.keys(semanticCarryByTabRef.current).forEach(tabId => {
            if (!validTabIds.has(tabId)) {
                delete semanticCarryByTabRef.current[tabId];
            }
        });
        Object.keys(semanticRecentBySignatureRef.current).forEach(signature => {
            const [tabId] = signature.split(':');
            if (tabId && !validTabIds.has(tabId)) {
                delete semanticRecentBySignatureRef.current[signature];
            }
        });
        setSemanticIssuesByTab(prev => {
            const nextEntries = Object.entries(prev).filter(([tabId]) => validTabIds.has(tabId));
            if (nextEntries.length === Object.keys(prev).length) {
                return prev;
            }
            return Object.fromEntries(nextEntries);
        });
    }, [tabs]);

    useTrackedEffect(() => {
        activeTabIdRef.current = activeTabId;
    }, [activeTabId]);

    useTrackedEffect(() => {
        if (!selectedRecordingId) {
            return;
        }
        if (recordings.some(recording => recording.id === selectedRecordingId)) {
            return;
        }
        setSelectedRecordingId(recordings[0]?.id ?? null);
    }, [recordings, selectedRecordingId]);

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

    const clearReplayTimers = useTrackedCallback(() => {
        replayTimeoutsRef.current.forEach(timerId => {
            window.clearTimeout(timerId);
        });
        replayTimeoutsRef.current = [];
    }, []);

    const stopReplay = useTrackedCallback(() => {
        clearReplayTimers();
        setIsReplayRunning(false);
    }, [clearReplayTimers]);

    useTrackedEffect(() => {
        return () => {
            clearReplayTimers();
        };
    }, [clearReplayTimers]);

    const completeRecording = useTrackedCallback(() => {
        const active = recordingCaptureRef.current;
        if (!active) {
            return;
        }

        const endedAt = Date.now();
        const recording: TerminalRecording = {
            id: `rec-${endedAt}-${Math.random().toString(36).slice(2, 7)}`,
            tabId: active.tabId,
            tabName: active.tabName,
            startedAt: active.startedAt,
            endedAt,
            durationMs: Math.max(0, endedAt - active.startedAt),
            events: active.events.slice(),
        };

        recordingCaptureRef.current = null;
        setActiveRecordingTabId(null);
        setRecordings(prev => [recording, ...prev].slice(0, 50));
        setSelectedRecordingId(recording.id);
    }, []);

    const startRecording = useTrackedCallback(() => {
        const tabId = activeTabIdRef.current;
        if (!tabId) {
            return;
        }
        const tab = tabsRef.current.find(item => item.id === tabId);
        if (!tab) {
            return;
        }

        if (recordingCaptureRef.current) {
            completeRecording();
        }

        recordingCaptureRef.current = {
            tabId,
            tabName: tab.name,
            startedAt: Date.now(),
            events: [],
        };
        setActiveRecordingTabId(tabId);
        setIsRecordingPanelOpen(true);
        setReplayText('');
        stopReplay();
    }, [completeRecording, stopReplay]);

    const stopRecording = useTrackedCallback(() => {
        completeRecording();
    }, [completeRecording]);

    const toggleRecording = useTrackedCallback(() => {
        if (activeRecordingTabId) {
            stopRecording();
            return;
        }
        startRecording();
    }, [activeRecordingTabId, startRecording, stopRecording]);

    const exportRecording = useTrackedCallback((recording: TerminalRecording) => {
        const payload = JSON.stringify(recording, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `terminal-recording-${recording.tabName.replace(/\s+/g, '-').toLowerCase()}-${new Date(recording.endedAt).toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, []);

    const selectedRecording = selectedRecordingId
        ? (recordings.find(recording => recording.id === selectedRecordingId) ?? null)
        : null;

    const startReplay = useTrackedCallback(
        (recording: TerminalRecording) => {
            stopReplay();
            setReplayText('');

            const playbackEvents = recording.events.filter(event => event.type === 'data');
            if (playbackEvents.length === 0) {
                setIsReplayRunning(false);
                return;
            }

            setIsReplayRunning(true);
            let elapsed = 0;
            let previousAt = 0;

            playbackEvents.forEach((event, index) => {
                const stepDelta = Math.max(0, event.at - previousAt);
                previousAt = event.at;
                elapsed += Math.min(stepDelta, 80);

                const timerId = window.setTimeout(() => {
                    setReplayText(prev => prev + event.data);
                    if (index === playbackEvents.length - 1) {
                        setIsReplayRunning(false);
                    }
                }, elapsed);

                replayTimeoutsRef.current.push(timerId);
            });
        },
        [stopReplay]
    );

    const pushSemanticIssue = useTrackedCallback(
        (tabId: string, severity: 'error' | 'warning', rawMessage: string) => {
            const message = rawMessage.replace(/\s+/g, ' ').trim();
            if (!message || message.length < 3) {
                return;
            }

            const signature = `${tabId}:${severity}:${message.toLowerCase()}`;
            const now = Date.now();
            const lastTimestamp = semanticRecentBySignatureRef.current[signature] ?? 0;
            if (now - lastTimestamp < TERMINAL_SEMANTIC_DEDUPE_WINDOW_MS) {
                return;
            }
            semanticRecentBySignatureRef.current[signature] = now;

            const issue: TerminalSemanticIssue = {
                id: `${tabId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
                tabId,
                severity,
                message,
                timestamp: now,
            };

            setSemanticIssuesByTab(prev => {
                const nextForTab = [issue, ...(prev[tabId] ?? [])].slice(
                    0,
                    TERMINAL_SEMANTIC_MAX_ISSUES_PER_TAB
                );
                return {
                    ...prev,
                    [tabId]: nextForTab,
                };
            });
        },
        []
    );

    const parseSemanticChunk = useTrackedCallback(
        (tabId: string, chunk: string, flushRemainder = false) => {
            const stripped = stripAnsiControlSequences(chunk);
            const carried = semanticCarryByTabRef.current[tabId] ?? '';
            const combined = `${carried}${stripped}`;
            const lines = combined.split('\n');
            semanticCarryByTabRef.current[tabId] = lines.pop() ?? '';

            for (const line of lines) {
                const normalized = line.trim();
                if (!normalized) {
                    continue;
                }
                const severity = detectSemanticSeverity(normalized);
                if (!severity) {
                    continue;
                }
                pushSemanticIssue(tabId, severity, normalized);
            }

            if (flushRemainder) {
                const remainder = semanticCarryByTabRef.current[tabId]?.trim();
                if (remainder) {
                    const severity = detectSemanticSeverity(remainder);
                    if (severity) {
                        pushSemanticIssue(tabId, severity, remainder);
                    }
                }
                semanticCarryByTabRef.current[tabId] = '';
            }
        },
        [pushSemanticIssue]
    );

    const clearSemanticIssuesForTab = useTrackedCallback((tabId: string) => {
        setSemanticIssuesByTab(prev => {
            if (!(tabId in prev)) {
                return prev;
            }
            const next = { ...prev };
            delete next[tabId];
            return next;
        });
        delete semanticCarryByTabRef.current[tabId];
        Object.keys(semanticRecentBySignatureRef.current).forEach(signature => {
            if (signature.startsWith(`${tabId}:`)) {
                delete semanticRecentBySignatureRef.current[signature];
            }
        });
    }, []);

    const loadPreferredBackendPreference = useTrackedCallback(async () => {
        try {
            const settings = await window.electron.getSettings();
            const configuredBackend = settings?.general?.defaultTerminalBackend?.trim();
            if (configuredBackend) {
                setPreferredBackendId(configuredBackend);
                try {
                    window.localStorage.setItem(
                        TERMINAL_PREFERRED_BACKEND_STORAGE_KEY,
                        configuredBackend
                    );
                } catch {
                    // Ignore localStorage failures in restricted environments.
                }
                return configuredBackend;
            }
        } catch {
            // Ignore settings read failures and fallback to localStorage.
        }

        try {
            const stored = window.localStorage.getItem(TERMINAL_PREFERRED_BACKEND_STORAGE_KEY);
            if (stored?.trim()) {
                const fallbackBackend = stored.trim();
                setPreferredBackendId(fallbackBackend);
                return fallbackBackend;
            }
        } catch {
            // Ignore localStorage failures in restricted environments.
        }

        return null;
    }, []);

    useTrackedEffect(() => {
        void loadPreferredBackendPreference();
    }, [loadPreferredBackendPreference]);

    const fetchAvailableShells = useTrackedCallback(async () => {
        try {
            setIsLoadingShells(true);
            if (!(await window.electron.terminal.isAvailable())) {
                return [];
            }
            const shells = await window.electron.terminal.getShells();
            setAvailableShells(shells);
            return shells;
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to load shells', error as Error);
            return [];
        } finally {
            setIsLoadingShells(false);
        }
    }, []);

    const fetchAvailableBackends = useTrackedCallback(async () => {
        try {
            setIsLoadingBackends(true);
            if (!(await window.electron.terminal.isAvailable())) {
                return [];
            }
            const backends = await window.electron.terminal.getBackends();
            setAvailableBackends(backends);
            return backends;
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to load terminal backends', error as Error);
            return [];
        } finally {
            setIsLoadingBackends(false);
        }
    }, []);

    const fetchRemoteConnections = useTrackedCallback(async () => {
        try {
            setIsLoadingRemoteConnections(true);

            const [profilesRaw, dockerRaw] = await Promise.all([
                window.electron.ssh.getProfiles().catch(() => []),
                window.electron.terminal.getDockerContainers().catch(() => []),
            ]);

            setRemoteSshProfiles(normalizeSshProfiles(profilesRaw));
            setRemoteDockerContainers(normalizeDockerContainers(dockerRaw as unknown));
        } catch (error) {
            appLogger.error(
                'TerminalPanel',
                'Failed to load remote terminal connections',
                error as Error
            );
            setRemoteSshProfiles([]);
            setRemoteDockerContainers([]);
        } finally {
            setIsLoadingRemoteConnections(false);
        }
    }, []);

    const resolveDefaultBackendId = useTrackedCallback(
        (backends: TerminalBackendInfo[], preferredId?: string | null) => {
            const preferred = (preferredId ?? preferredBackendId)?.trim();
            if (preferred) {
                const preferredBackend = backends.find(
                    backend => backend.id === preferred && backend.available
                );
                if (preferredBackend) {
                    return preferredBackend.id;
                }
            }

            return (
                backends.find(backend => backend.id === 'node-pty' && backend.available)?.id ??
                backends.find(backend => backend.available)?.id
            );
        },
        [preferredBackendId]
    );

    const persistPreferredBackendId = useTrackedCallback(async (backendId: string) => {
        setPreferredBackendId(backendId);
        try {
            window.localStorage.setItem(TERMINAL_PREFERRED_BACKEND_STORAGE_KEY, backendId);
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
        try {
            const settings = await window.electron.getSettings();
            const currentBackend = settings?.general?.defaultTerminalBackend;
            if (!settings?.general || currentBackend === backendId) {
                return;
            }

            await window.electron.saveSettings({
                ...settings,
                general: {
                    ...settings.general,
                    defaultTerminalBackend: backendId,
                },
            });
        } catch (error) {
            appLogger.error(
                'TerminalPanel',
                'Failed to persist preferred terminal backend',
                error as Error
            );
        }
    }, []);

    useTrackedEffect(() => {
        if (availableBackends.length === 0) {
            return;
        }

        const resolved = resolveDefaultBackendId(availableBackends);
        if (!resolved || resolved === preferredBackendId) {
            return;
        }

        void persistPreferredBackendId(resolved);
    }, [availableBackends, preferredBackendId, resolveDefaultBackendId, persistPreferredBackendId]);

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
            const shellName = availableShells.find(s => s.id === type)?.name ?? type;
            const backendName = availableBackends.find(
                backend => backend.id === effectiveBackendId
            )?.name;
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
            availableShells,
            projectPath,
            setTabs,
            setActiveTabId,
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
                const commandParts: string[] = ['ssh'];
                if (profile.privateKey) {
                    commandParts.push('-i', quoteCommandValue(profile.privateKey));
                }
                if (profile.jumpHost) {
                    commandParts.push('-J', quoteCommandValue(profile.jumpHost));
                }
                if (profile.port > 0) {
                    commandParts.push('-p', String(profile.port));
                }
                commandParts.push(`${profile.username}@${profile.host}`);
                const bootstrapCommand = commandParts.join(' ');

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
            const bootstrapCommand = [
                'docker exec -it',
                quoteCommandValue(container.id),
                quoteCommandValue(container.shell || '/bin/sh'),
            ].join(' ');

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
                targets.map(sessionId => window.electron.terminal.write(sessionId, value))
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

    const refreshMultiplexerSessions = useTrackedCallback(
        async (mode: MultiplexerMode = multiplexerMode) => {
            try {
                setIsMultiplexerLoading(true);
                setMultiplexerError(null);
                setMultiplexerSessions([]);

                if (mode === 'tmux') {
                    const result = await window.electron.runCommand(
                        'tmux',
                        ['list-sessions', '-F', '#S|#{session_windows}|#{session_attached}'],
                        projectPath
                    );
                    if (result.code !== 0) {
                        const stderr = (result.stderr || '').toLowerCase();
                        if (
                            stderr.includes('failed to connect') ||
                            stderr.includes('no server running')
                        ) {
                            setMultiplexerSessions([]);
                            return;
                        }
                        setMultiplexerError(result.stderr || 'Failed to list tmux sessions');
                        return;
                    }
                    setMultiplexerSessions(parseTmuxSessions(result.stdout));
                    return;
                }

                const result = await window.electron.runCommand('screen', ['-ls'], projectPath);
                if (result.code !== 0) {
                    const stderr = (result.stderr || '').toLowerCase();
                    if (stderr.includes('no sockets found')) {
                        setMultiplexerSessions([]);
                        return;
                    }
                    setMultiplexerError(result.stderr || 'Failed to list screen sessions');
                    return;
                }
                setMultiplexerSessions(parseScreenSessions(result.stdout));
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to query multiplexer sessions',
                    error as Error
                );
                setMultiplexerError(
                    error instanceof Error ? error.message : 'Multiplexer query failed'
                );
            } finally {
                setIsMultiplexerLoading(false);
            }
        },
        [multiplexerMode, projectPath]
    );

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
        setMultiplexerError(null);
    }, []);

    const attachMultiplexerSession = useTrackedCallback(
        async (session: MultiplexerSession) => {
            const command =
                multiplexerMode === 'tmux'
                    ? `tmux attach -t ${quoteCommandValue(session.id)}`
                    : `screen -r ${quoteCommandValue(session.id)}`;
            await writeCommandToActiveTerminal(command);
            setIsMultiplexerOpen(false);
        },
        [multiplexerMode, writeCommandToActiveTerminal]
    );

    const createMultiplexerSession = useTrackedCallback(async () => {
        const safeName = multiplexerSessionName.trim() || 'main';
        const command =
            multiplexerMode === 'tmux'
                ? `tmux new -As ${quoteCommandValue(safeName)}`
                : `screen -S ${quoteCommandValue(safeName)}`;
        await writeCommandToActiveTerminal(command);
        setIsMultiplexerOpen(false);
    }, [multiplexerMode, multiplexerSessionName, writeCommandToActiveTerminal]);

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

    useTrackedEffect(() => {
        if (!isOpen) {
            return;
        }

        let cancelled = false;
        const loadShellsAndMaybeCreate = async () => {
            const shells =
                availableShells.length > 0 ? availableShells : await fetchAvailableShells();
            const backends =
                availableBackends.length > 0 ? availableBackends : await fetchAvailableBackends();
            if (cancelled || isCreatingRef.current || hasAutoCreatedRef.current) {
                return;
            }
            if (tabs.length === 0) {
                isCreatingRef.current = true;
                hasAutoCreatedRef.current = true;
                if (!cancelled && tabsRef.current.length === 0) {
                    const shellId =
                        shells[0]?.id ??
                        availableShells[0]?.id ??
                        tabsRef.current[0]?.type ??
                        'powershell';
                    createTerminal(shellId, resolveDefaultBackendId(backends));
                }
                isCreatingRef.current = false;
            }
        };

        void loadShellsAndMaybeCreate();
        return () => {
            cancelled = true;
        };
    }, [
        isOpen,
        tabs.length,
        availableBackends,
        availableShells,
        fetchAvailableBackends,
        fetchAvailableShells,
        createTerminal,
        resolveDefaultBackendId,
    ]);

    useTrackedEffect(() => {
        if (isOpen && isNewTerminalMenuOpen) {
            void loadPreferredBackendPreference();
            if (availableShells.length === 0 && !isLoadingShells) {
                void fetchAvailableShells();
            }
            if (availableBackends.length === 0 && !isLoadingBackends) {
                void fetchAvailableBackends();
            }
            if (!isLoadingRemoteConnections) {
                void fetchRemoteConnections();
            }
        }
    }, [
        isOpen,
        isNewTerminalMenuOpen,
        availableShells.length,
        availableBackends.length,
        isLoadingShells,
        isLoadingBackends,
        isLoadingRemoteConnections,
        loadPreferredBackendPreference,
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
    ]);

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
            clearSemanticIssuesForTab(id);
            if (recordingCaptureRef.current?.tabId === id) {
                completeRecording();
            }
            void window.electron.terminal.kill(id);

            setTabs(prev => prev.filter(tab => tab.id !== id));
            setActiveTabId(nextActiveTabId);
            activeTabIdRef.current = nextActiveTabId;

            if (remainingTabs.length === 0) {
                setIsNewTerminalMenuOpen(false);
                onToggle();
            }
        },
        [clearSemanticIssuesForTab, completeRecording, onToggle, setTabs, setActiveTabId]
    );

    useTrackedEffect(() => {
        if (tabs.length === 0) {
            if (activeTabId !== null) {
                setActiveTabId(null);
            }
            setIsGalleryView(false);
            setIsSemanticPanelOpen(false);
            return;
        }

        if (!activeTabId || !tabs.some(tab => tab.id === activeTabId)) {
            setActiveTabId(tabs[tabs.length - 1]?.id ?? null);
        }
    }, [activeTabId, setActiveTabId, tabs]);

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

            let secondaryId = currentTabs.find(tab => tab.id !== activeId)?.id;
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

        let secondaryId = currentTabs.find(tab => tab.id !== activeId)?.id;
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
            const detached = await window.electron.terminal.detach({
                sessionId: tabToDetach.id,
                title: tabToDetach.name,
                shell: tabToDetach.type,
                cwd: tabToDetach.cwd,
            });
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

            if (remainingTabs.length === 0) {
                setIsNewTerminalMenuOpen(false);
                onToggle();
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to detach terminal tab', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [completeRecording, onToggle, setActiveTabId, setTabs]);

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

    const validateThemeImport = useTrackedCallback((data: unknown): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Invalid theme file: must be a JSON object'] };
        }

        const theme = data as Record<string, unknown>;

        // Validate themePresetId if present
        if ('themePresetId' in theme && typeof theme.themePresetId !== 'string') {
            errors.push('themePresetId must be a string');
        }

        // Validate fontPresetId if present
        if ('fontPresetId' in theme && typeof theme.fontPresetId !== 'string') {
            errors.push('fontPresetId must be a string');
        }

        // Validate ligatures if present
        if ('ligatures' in theme && typeof theme.ligatures !== 'boolean') {
            errors.push('ligatures must be a boolean');
        }

        // Validate surfaceOpacity if present
        if ('surfaceOpacity' in theme) {
            if (typeof theme.surfaceOpacity !== 'number' || theme.surfaceOpacity < 0.6 || theme.surfaceOpacity > 1) {
                errors.push('surfaceOpacity must be a number between 0.6 and 1');
            }
        }

        // Validate surfaceBlur if present
        if ('surfaceBlur' in theme) {
            if (typeof theme.surfaceBlur !== 'number' || theme.surfaceBlur < 0 || theme.surfaceBlur > 24) {
                errors.push('surfaceBlur must be a number between 0 and 24');
            }
        }

        // Validate cursorStyle if present
        if ('cursorStyle' in theme) {
            if (!['block', 'underline', 'bar'].includes(theme.cursorStyle as string)) {
                errors.push('cursorStyle must be one of: block, underline, bar');
            }
        }

        // Validate cursorBlink if present
        if ('cursorBlink' in theme && typeof theme.cursorBlink !== 'boolean') {
            errors.push('cursorBlink must be a boolean');
        }

        // Validate fontSize if present
        if ('fontSize' in theme) {
            if (typeof theme.fontSize !== 'number' || theme.fontSize < 8 || theme.fontSize > 32) {
                errors.push('fontSize must be a number between 8 and 32');
            }
        }

        // Validate lineHeight if present
        if ('lineHeight' in theme) {
            if (typeof theme.lineHeight !== 'number' || theme.lineHeight < 1 || theme.lineHeight > 2) {
                errors.push('lineHeight must be a number between 1 and 2');
            }
        }

        // Validate customTheme if present
        if ('customTheme' in theme && theme.customTheme !== null) {
            if (typeof theme.customTheme !== 'object') {
                errors.push('customTheme must be an object or null');
            } else {
                const customTheme = theme.customTheme as Record<string, unknown>;
                const validColorKeys = [
                    'background', 'foreground', 'cursor', 'cursorAccent', 'selectionBackground',
                    'selectionForeground', 'selectionInactiveBackground', 'black', 'red', 'green',
                    'yellow', 'blue', 'magenta', 'cyan', 'white', 'brightBlack', 'brightRed',
                    'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite'
                ];

                for (const key of Object.keys(customTheme)) {
                    if (!validColorKeys.includes(key)) {
                        errors.push(`customTheme has unknown property: ${key}`);
                    } else if (typeof customTheme[key] !== 'string') {
                        errors.push(`customTheme.${key} must be a string (color value)`);
                    }
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }, []);

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
                const validation = validateThemeImport(parsed);
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
                alertDialog('Failed to import theme: Invalid JSON file');
            }
        },
        [applyAppearancePatch, validateThemeImport]
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
        clearSemanticIssuesForTab(activeTabIdRef.current);
    }, [clearSemanticIssuesForTab]);

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
        const tab = tabs.find(t => t.id === activeTabId);
        return tab?.type ?? 'bash';
    }, [activeTabId, tabs]);

    const handleAiExplainError = useTrackedCallback(
        async (issue: TerminalSemanticIssue) => {
            setAiSelectedIssue(issue);
            setAiPanelMode('explain-error');
            setIsAiPanelOpen(true);
            setAiIsLoading(true);
            setAiResult(null);

            try {
                const result = await window.electron.terminal.explainError({
                    errorOutput: issue.message,
                    shell: getActiveShellType(),
                    cwd: projectPath ?? undefined,
                });
                setAiResult({ type: 'explain-error', data: result as Record<string, unknown> });
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to explain error', err as Error);
                setAiResult({
                    type: 'explain-error',
                    data: {
                        summary: 'Failed to analyze error',
                        cause: 'Service error',
                        solution: 'Please try again',
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
                const history = await window.electron.terminal.getCommandHistory('', 1);
                if (history.length > 0) {
                    lastCommand = history[0]?.command ?? '';
                }
            } catch {
                // Ignore history fetch errors
            }

            try {
                const result = await window.electron.terminal.fixError({
                    errorOutput: issue.message,
                    command: lastCommand,
                    shell: getActiveShellType(),
                    cwd: projectPath ?? undefined,
                });
                setAiResult({ type: 'fix-error', data: result as Record<string, unknown> });
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to suggest fix', err as Error);
                setAiResult({
                    type: 'fix-error',
                    data: {
                        suggestedCommand: '',
                        explanation: 'Failed to suggest fix',
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
        [setActiveTabId, splitFocusedPane, splitView]
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

    const selectableBackends = availableBackends.filter(backend => backend.available);
    const integratedBackend = selectableBackends.find(backend => backend.id === 'node-pty');
    const launchableExternalBackends = selectableBackends.filter(
        backend => backend.id !== 'node-pty'
    );
    const resolvedDefaultBackendId = resolveDefaultBackendId(availableBackends);
    const defaultBackendName =
        selectableBackends.find(backend => backend.id === resolvedDefaultBackendId)?.name ??
        'Unknown';
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

    return (
        <motion.div
            className="flex flex-col h-full w-full overflow-hidden border border-border/60"
            style={terminalChromeStyle}
            data-terminal-module="terminal-manager"
            data-terminal-module-version={TERMINAL_MANAGER_MODULE_VERSION}
        >
            <TerminalToolbar
                tabs={tabs}
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
                tabs={tabs}
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
            />
            <TerminalOverlays
                terminalContextMenu={terminalContextMenu}
                canUseGallery={tabs.length > 1}
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
                              activeRecordingLabel: activeRecordingTabId
                                  ? tabs.find(tab => tab.id === activeRecordingTabId)?.name ??
                                    activeRecordingTabId
                                  : null,
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

export function TerminalPanel(props: TerminalPanelProps) {
    return <TerminalPanelContent {...props} />;
}


