import { useTranslation } from '@renderer/i18n';
import {
    AlertTriangle,
    Bot,
    Check,
    ChevronDown,
    LayoutGrid,
    Loader2,
    Maximize2,
    Minimize2,
    Palette,
    Play,
    Plus,
    Rows2,
    Sparkles,
    Square,
    TerminalSquare,
    Wrench,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type ITheme, Terminal as XTerm } from 'xterm';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/hooks/useTheme';
import { motion } from '@/lib/framer-motion-compat';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { TerminalContextMenu } from './components/TerminalContextMenu';
import { TerminalCommandPanels } from './components/TerminalCommandPanels';
import { TerminalEmptyState } from './components/TerminalEmptyState';
import { TerminalInstance } from './components/TerminalInstance';
import { TerminalMultiplexerPanel } from './components/TerminalMultiplexerPanel';
import { TerminalRecordingPanel } from './components/TerminalRecordingPanel';
import { TerminalSearchOverlay } from './components/TerminalSearchOverlay';
import { TerminalSplitControls } from './components/TerminalSplitControls';
import { TerminalTabsBar } from './components/TerminalTabsBar';
import { useTerminalCommandTools } from './hooks/useTerminalCommandTools';
import type {
    ResolvedTerminalAppearance,
    TerminalAppearancePreferences,
    TerminalCursorStyle,
} from './types/terminal-appearance';
import { serializeTerminalModuleVersion } from './utils/module-version';
import { clearTerminalSessionFlags } from './utils/session-registry';
import {
    createShortcutShareCode,
    isTypingElement,
    keyboardEventToShortcut,
    normalizeShortcutBinding,
    parseShortcutShareCode,
    parseShortcutStorage,
    sanitizeShortcutBindings,
    serializeShortcutStorage,
    TERMINAL_SHORTCUT_PRESETS,
    type TerminalShortcutAction,
    type TerminalShortcutBindings,
    type TerminalShortcutPresetId,
} from './utils/shortcut-config';
import {
    createCustomSplitPreset,
    DEFAULT_SPLIT_ANALYTICS,
    DEFAULT_SPLIT_PRESETS,
    incrementSplitAnalytics,
    sanitizeSplitAnalytics,
    sanitizeSplitLayout,
    sanitizeSplitPresets,
    serializeSplitPresets,
    type SplitAnalytics,
    type SplitPreset,
    type SplitViewState,
    TERMINAL_SPLIT_PRESET_LIMIT,
} from './utils/split-config';
import {
    collectTerminalSearchMatches,
    type TerminalSearchMatch,
} from './utils/terminal-search';

import 'xterm/css/xterm.css';

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

interface TerminalPanelProps {
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

// TODO: Refactor TerminalPanel into smaller modules; temporary suppression for legacy function size.
// eslint-disable-next-line max-lines-per-function, complexity
export function TerminalPanel({
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
    const [isMaximizedLocal, setIsMaximizedLocal] = useState(false);

    const isMaximized = onMaximizeChangeProp ? isMaximizedProp : isMaximizedLocal;
    const setIsMaximized = onMaximizeChangeProp ?? setIsMaximizedLocal;
    const [isNewTerminalMenuOpen, setIsNewTerminalMenuOpen] = useState(false);
    const [terminalContextMenu, setTerminalContextMenu] = useState<{ x: number; y: number } | null>(
        null
    );
    const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
    const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
    const [splitView, setSplitView] = useState<SplitViewState | null>(null);
    const [splitFocusedPane, setSplitFocusedPane] = useState<'primary' | 'secondary'>('primary');
    const [isSynchronizedInputEnabled, setIsSynchronizedInputEnabled] = useState(false);
    const [isSplitPresetMenuOpen, setIsSplitPresetMenuOpen] = useState(false);
    const [splitPresets, setSplitPresets] = useState<SplitPreset[]>([]);
    const [splitAnalytics, setSplitAnalytics] = useState<SplitAnalytics>(DEFAULT_SPLIT_ANALYTICS);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isGalleryView, setIsGalleryView] = useState(false);
    const [isAppearanceMenuOpen, setIsAppearanceMenuOpen] = useState(false);
    const [isSemanticPanelOpen, setIsSemanticPanelOpen] = useState(false);
    const [semanticIssuesByTab, setSemanticIssuesByTab] = useState<
        Record<string, TerminalSemanticIssue[]>
    >({});
    const [searchQuery, setSearchQuery] = useState('');
    const [searchUseRegex, setSearchUseRegex] = useState(false);
    const [searchStatus, setSearchStatus] = useState<
        'idle' | 'found' | 'not-found' | 'invalid-regex'
    >('idle');
    const [searchMatches, setSearchMatches] = useState<TerminalSearchMatch[]>([]);
    const [searchActiveMatchIndex, setSearchActiveMatchIndex] = useState(-1);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [searchHistoryIndex, setSearchHistoryIndex] = useState(-1);
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
    const [terminalAppearance, setTerminalAppearance] = useState<TerminalAppearancePreferences>(
        DEFAULT_TERMINAL_APPEARANCE
    );
    const [isMultiplexerOpen, setIsMultiplexerOpen] = useState(false);
    const [multiplexerMode, setMultiplexerMode] = useState<MultiplexerMode>('tmux');
    const [multiplexerSessionName, setMultiplexerSessionName] = useState('main');
    const [isMultiplexerLoading, setIsMultiplexerLoading] = useState(false);
    const [multiplexerSessions, setMultiplexerSessions] = useState<MultiplexerSession[]>([]);
    const [multiplexerError, setMultiplexerError] = useState<string | null>(null);
    const [isRecordingPanelOpen, setIsRecordingPanelOpen] = useState(false);
    const [recordings, setRecordings] = useState<TerminalRecording[]>([]);
    const [activeRecordingTabId, setActiveRecordingTabId] = useState<string | null>(null);
    const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
    const [isReplayRunning, setIsReplayRunning] = useState(false);
    const [pasteHistory, setPasteHistory] = useState<string[]>([]);
    const [shortcutPreset, setShortcutPreset] = useState<TerminalShortcutPresetId>('default');
    const [shortcutBindings, setShortcutBindings] = useState<TerminalShortcutBindings>(
        TERMINAL_SHORTCUT_PRESETS.default
    );

    // AI Assistant state
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
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
    const searchInputRef = useRef<HTMLInputElement>(null);
    const appearanceImportInputRef = useRef<HTMLInputElement | null>(null);
    const shortcutImportInputRef = useRef<HTMLInputElement | null>(null);
    const searchCursorRef = useRef<Record<string, { row: number; col: number }>>({});
    const semanticCarryByTabRef = useRef<Record<string, string>>({});
    const semanticRecentBySignatureRef = useRef<Record<string, number>>({});
    const recordingCaptureRef = useRef<{
        tabId: string;
        tabName: string;
        startedAt: number;
        events: TerminalRecordingEvent[];
    } | null>(null);
    const replayTimeoutsRef = useRef<number[]>([]);
    const splitLayoutRestoreAttemptedRef = useRef(false);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMINAL_SEARCH_HISTORY_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return;
            }
            const sanitized = parsed
                .filter((item): item is string => typeof item === 'string')
                .map(item => item.trim())
                .filter(Boolean)
                .slice(0, TERMINAL_SEARCH_HISTORY_LIMIT);
            setSearchHistory(sanitized);
        } catch {
            // Ignore invalid persisted history payloads.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                TERMINAL_SEARCH_HISTORY_STORAGE_KEY,
                JSON.stringify(searchHistory.slice(0, TERMINAL_SEARCH_HISTORY_LIMIT))
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [searchHistory]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMINAL_PASTE_HISTORY_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return;
            }
            const sanitized = parsed
                .filter((item): item is string => typeof item === 'string')
                .map(item => item.trim())
                .filter(Boolean)
                .slice(0, TERMINAL_PASTE_HISTORY_LIMIT);
            setPasteHistory(sanitized);
        } catch {
            // Ignore malformed paste history payloads.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                TERMINAL_PASTE_HISTORY_STORAGE_KEY,
                JSON.stringify(pasteHistory.slice(0, TERMINAL_PASTE_HISTORY_LIMIT))
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [pasteHistory]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMINAL_SYNC_INPUT_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw) as { enabled?: unknown };
            if (typeof parsed.enabled === 'boolean') {
                setIsSynchronizedInputEnabled(parsed.enabled);
            }
        } catch {
            // Ignore malformed synchronized-input payloads.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                TERMINAL_SYNC_INPUT_STORAGE_KEY,
                JSON.stringify({ enabled: isSynchronizedInputEnabled })
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [isSynchronizedInputEnabled]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMINAL_APPEARANCE_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw) as Partial<TerminalAppearancePreferences>;
            setTerminalAppearance(prev => ({
                themePresetId:
                    typeof parsed.themePresetId === 'string'
                        ? parsed.themePresetId
                        : prev.themePresetId,
                fontPresetId:
                    typeof parsed.fontPresetId === 'string'
                        ? parsed.fontPresetId
                        : prev.fontPresetId,
                ligatures:
                    typeof parsed.ligatures === 'boolean' ? parsed.ligatures : prev.ligatures,
                surfaceOpacity: clamp(
                    typeof parsed.surfaceOpacity === 'number'
                        ? parsed.surfaceOpacity
                        : prev.surfaceOpacity,
                    0.6,
                    1
                ),
                surfaceBlur: clamp(
                    typeof parsed.surfaceBlur === 'number' ? parsed.surfaceBlur : prev.surfaceBlur,
                    0,
                    24
                ),
                cursorStyle:
                    typeof parsed.cursorStyle === 'string' &&
                        ['block', 'underline', 'bar'].includes(parsed.cursorStyle)
                        ? parsed.cursorStyle
                        : prev.cursorStyle,
                cursorBlink:
                    typeof parsed.cursorBlink === 'boolean' ? parsed.cursorBlink : prev.cursorBlink,
                fontSize: clamp(
                    typeof parsed.fontSize === 'number' ? parsed.fontSize : prev.fontSize,
                    8,
                    32
                ),
                lineHeight: clamp(
                    typeof parsed.lineHeight === 'number' ? parsed.lineHeight : prev.lineHeight,
                    1,
                    2
                ),
                customTheme:
                    parsed.customTheme && typeof parsed.customTheme === 'object'
                        ? parsed.customTheme
                        : prev.customTheme,
            }));
        } catch {
            // Ignore invalid appearance payloads.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                TERMINAL_APPEARANCE_STORAGE_KEY,
                JSON.stringify(terminalAppearance)
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [terminalAppearance]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMINAL_SHORTCUTS_STORAGE_KEY);
            const parsed = parseShortcutStorage(raw);
            if (parsed.preset) {
                setShortcutPreset(parsed.preset);
            }
            if (Object.keys(parsed.bindings).length > 0) {
                setShortcutBindings(prev => ({
                    ...prev,
                    ...sanitizeShortcutBindings(parsed.bindings),
                }));
            }
        } catch {
            // Ignore malformed shortcut settings payloads.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                TERMINAL_SHORTCUTS_STORAGE_KEY,
                serializeShortcutStorage(shortcutPreset, shortcutBindings)
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [shortcutBindings, shortcutPreset]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMINAL_SPLIT_PRESETS_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            setSplitPresets(sanitizeSplitPresets(parsed, TERMINAL_SPLIT_PRESET_LIMIT));
        } catch {
            // Ignore invalid split preset payloads.
        }
    }, []);

    useEffect(() => {
        try {
            const serialized = serializeSplitPresets(splitPresets, TERMINAL_SPLIT_PRESET_LIMIT);
            window.localStorage.setItem(
                TERMINAL_SPLIT_PRESETS_STORAGE_KEY,
                JSON.stringify(serialized)
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [splitPresets]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            setSplitAnalytics(sanitizeSplitAnalytics(parsed));
        } catch {
            // Ignore invalid split analytics payloads.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY,
                JSON.stringify(splitAnalytics)
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [splitAnalytics]);

    useEffect(() => {
        tabsRef.current = tabs;
    }, [tabs]);

    useEffect(() => {
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

    useEffect(() => {
        activeTabIdRef.current = activeTabId;
    }, [activeTabId]);

    useEffect(() => {
        if (!splitView) {
            try {
                window.localStorage.removeItem(TERMINAL_SPLIT_LAYOUT_STORAGE_KEY);
            } catch {
                // Ignore localStorage failures in restricted environments.
            }
            return;
        }
        try {
            window.localStorage.setItem(TERMINAL_SPLIT_LAYOUT_STORAGE_KEY, JSON.stringify(splitView));
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [splitView]);

    useEffect(() => {
        if (splitLayoutRestoreAttemptedRef.current) {
            return;
        }
        if (splitView || tabs.length < 2) {
            return;
        }
        splitLayoutRestoreAttemptedRef.current = true;
        try {
            const raw = window.localStorage.getItem(TERMINAL_SPLIT_LAYOUT_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            const validIds = new Set(tabs.map(tab => tab.id));
            const restored = sanitizeSplitLayout(parsed, validIds);
            if (restored) {
                setSplitView(restored);
            }
        } catch {
            // Ignore invalid split layout payloads.
        }
    }, [splitView, tabs]);

    useEffect(() => {
        if (!selectedRecordingId) {
            return;
        }
        if (recordings.some(recording => recording.id === selectedRecordingId)) {
            return;
        }
        setSelectedRecordingId(recordings[0]?.id ?? null);
    }, [recordings, selectedRecordingId]);

    const setTerminalInstance = useCallback((id: string, terminal: XTerm | null) => {
        if (terminal) {
            terminalInstancesRef.current[id] = terminal;
            return;
        }
        delete terminalInstancesRef.current[id];
    }, []);

    const getActiveTerminalInstance = useCallback(() => {
        if (!activeTabIdRef.current) {
            return null;
        }
        return terminalInstancesRef.current[activeTabIdRef.current] ?? null;
    }, []);

    const clearReplayTimers = useCallback(() => {
        replayTimeoutsRef.current.forEach(timerId => {
            window.clearTimeout(timerId);
        });
        replayTimeoutsRef.current = [];
    }, []);

    const stopReplay = useCallback(() => {
        clearReplayTimers();
        setIsReplayRunning(false);
    }, [clearReplayTimers]);

    useEffect(() => {
        return () => {
            clearReplayTimers();
        };
    }, [clearReplayTimers]);

    const completeRecording = useCallback(() => {
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

    const startRecording = useCallback(() => {
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

    const stopRecording = useCallback(() => {
        completeRecording();
    }, [completeRecording]);

    const toggleRecording = useCallback(() => {
        if (activeRecordingTabId) {
            stopRecording();
            return;
        }
        startRecording();
    }, [activeRecordingTabId, startRecording, stopRecording]);

    const exportRecording = useCallback((recording: TerminalRecording) => {
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

    const startReplay = useCallback(
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

    const pushSemanticIssue = useCallback(
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

    const parseSemanticChunk = useCallback(
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

    const clearSemanticIssuesForTab = useCallback((tabId: string) => {
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

    const loadPreferredBackendPreference = useCallback(async () => {
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

    useEffect(() => {
        void loadPreferredBackendPreference();
    }, [loadPreferredBackendPreference]);

    const fetchAvailableShells = useCallback(async () => {
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

    const fetchAvailableBackends = useCallback(async () => {
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

    const fetchRemoteConnections = useCallback(async () => {
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

    const resolveDefaultBackendId = useCallback(
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

    const persistPreferredBackendId = useCallback(async (backendId: string) => {
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

    useEffect(() => {
        if (availableBackends.length === 0) {
            return;
        }

        const resolved = resolveDefaultBackendId(availableBackends);
        if (!resolved || resolved === preferredBackendId) {
            return;
        }

        void persistPreferredBackendId(resolved);
    }, [availableBackends, preferredBackendId, resolveDefaultBackendId, persistPreferredBackendId]);

    const createTerminal = useCallback(
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

    const createDefaultTerminal = useCallback(async () => {
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

    const resolvePreferredShellId = useCallback(() => {
        const currentTabs = tabsRef.current;
        const active = currentTabs.find(tab => tab.id === activeTabIdRef.current);
        return active?.type ?? availableShells[0]?.id;
    }, [availableShells]);

    const createRemoteTerminal = useCallback(
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

    const resolveInputTargetSessionIds = useCallback((): string[] => {
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

    const writeInputToTargetSessions = useCallback(
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

    const writeCommandToActiveTerminal = useCallback(
        async (command: string) => {
            if (!command) {
                return;
            }
            await writeInputToTargetSessions(`${command}\r`);
        },
        [writeInputToTargetSessions]
    );

    const refreshMultiplexerSessions = useCallback(
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

    const openMultiplexerPanel = useCallback(() => {
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
    }, [refreshMultiplexerSessions]);

    const closeMultiplexerPanel = useCallback(() => {
        setIsMultiplexerOpen(false);
        setMultiplexerError(null);
    }, []);

    const attachMultiplexerSession = useCallback(
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

    const createMultiplexerSession = useCallback(async () => {
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

    useEffect(() => {
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
    }, [completeRecording, isOpen, stopReplay]);

    useEffect(() => {
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

    useEffect(() => {
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

    const closeTab = useCallback(
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

    useEffect(() => {
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

    useEffect(() => {
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

    useEffect(() => {
        const c1 = window.electron.terminal.onData(p => {
            parseSemanticChunk(p.id, p.data);
            const activeRecording = recordingCaptureRef.current;
            if (activeRecording?.tabId === p.id && p.data) {
                activeRecording.events.push({
                    at: Date.now() - activeRecording.startedAt,
                    type: 'data',
                    data: p.data,
                });
                if (activeRecording.events.length > 12000) {
                    activeRecording.events = activeRecording.events.slice(-12000);
                }
            }
            window.dispatchEvent(new CustomEvent('terminal-data-multiplex', { detail: p }));
        });
        const c2 = window.electron.terminal.onExit(p => {
            parseSemanticChunk(p.id, '', true);
            const activeRecording = recordingCaptureRef.current;
            if (activeRecording?.tabId === p.id) {
                activeRecording.events.push({
                    at: Date.now() - activeRecording.startedAt,
                    type: 'exit',
                    data: String(p.code ?? 0),
                });
                completeRecording();
            }
            window.dispatchEvent(new CustomEvent('terminal-exit-multiplex', { detail: p }));
        });
        return () => {
            c1();
            c2();
        };
    }, [completeRecording, parseSemanticChunk]);

    useEffect(() => {
        const handleNewTerminalShortcut = () => {
            void createDefaultTerminal();
        };

        window.addEventListener('workspace-terminal:new', handleNewTerminalShortcut);
        return () => {
            window.removeEventListener('workspace-terminal:new', handleNewTerminalShortcut);
        };
    }, [createDefaultTerminal]);

    useEffect(() => {
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

    const openTerminalContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setTerminalContextMenu({
            x: Math.min(event.clientX, window.innerWidth - 220),
            y: Math.min(event.clientY, window.innerHeight - 260),
        });
    }, []);

    const hideTerminalPanel = useCallback(() => {
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
    }, [completeRecording, onToggle, stopReplay]);

    const handleCopySelection = useCallback(async (options?: { stripAnsi?: boolean; trimWhitespace?: boolean }) => {
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

    const handleCopyWithFormatting = useCallback(async () => {
        try {
            const terminal = getActiveTerminalInstance();
            const selectedText = terminal?.hasSelection()
                ? terminal.getSelection()
                : (window.getSelection()?.toString() ?? '');

            if (!selectedText) {
                return;
            }

            // Create HTML formatted copy with terminal styling
            const htmlContent = `<pre style="font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; font-size: 13px; background: #1e1e1e; color: #d4d4d4; padding: 8px; border-radius: 4px; overflow-x: auto;">${selectedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;

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

    const handleCopyStripAnsi = useCallback(async () => {
        await handleCopySelection({ stripAnsi: true });
    }, [handleCopySelection]);

    const handlePasteClipboard = useCallback(async () => {
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
                    const confirmed = window.confirm(
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

    const handlePasteFromHistory = useCallback(async (entry: string) => {
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

    const handleTestPaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                return;
            }

            // Show paste test modal with preview
            const lineCount = text.split(/\r?\n/).length;
            const charCount = text.length;
            const hasSpecialChars = Array.from(text).some(c => {
                const code = c.charCodeAt(0);
                return (code >= 0 && code <= 31) || code === 127;
            });
            const hasAnsi = ANSI_ESCAPE_SEQUENCE_REGEX.test(text);
            const preview = text.slice(0, 500);

            const message = [
                `Paste Test Results:`,
                `• ${lineCount} line(s)`,
                `• ${charCount} character(s)`,
                `• Special characters: ${hasSpecialChars ? 'Yes' : 'No'}`,
                `• ANSI codes: ${hasAnsi ? 'Yes' : 'No'}`,
                '',
                'Preview:',
                preview + (text.length > 500 ? '...' : ''),
            ].join('\n');

            window.alert(message);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to test paste', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, []);

    const handleSelectAll = useCallback(() => {
        getActiveTerminalInstance()?.selectAll();
        setTerminalContextMenu(null);
    }, [getActiveTerminalInstance]);

    const handleClearOutput = useCallback(() => {
        const terminal = getActiveTerminalInstance();
        terminal?.clearSelection();
        terminal?.clear();
        setTerminalContextMenu(null);
    }, [getActiveTerminalInstance]);

    const updateSplitAnalytics = useCallback(
        (kind: keyof Omit<SplitAnalytics, 'lastSplitActionAt'>) => {
            setSplitAnalytics(prev => incrementSplitAnalytics(prev, kind));
        },
        []
    );

    const applySplitPreset = useCallback(
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

    const saveCurrentSplitAsPreset = useCallback(() => {
        if (!splitView) {
            return;
        }
        const name = window.prompt('Preset name', `Split ${splitPresets.length + 1}`)?.trim();
        if (!name) {
            return;
        }
        const preset = createCustomSplitPreset(name, splitView.orientation);
        setSplitPresets(prev => [preset, ...prev].slice(0, TERMINAL_SPLIT_PRESET_LIMIT));
    }, [splitPresets.length, splitView]);

    const renameSplitPreset = useCallback((presetId: string) => {
        setSplitPresets(prev => {
            const target = prev.find(item => item.id === presetId && item.source === 'custom');
            if (!target) {
                return prev;
            }
            const nextName = window.prompt('Rename preset', target.name)?.trim();
            if (!nextName || nextName === target.name) {
                return prev;
            }
            return prev.map(item =>
                item.id === presetId ? { ...item, name: nextName, updatedAt: Date.now() } : item
            );
        });
    }, []);

    const deleteSplitPreset = useCallback((presetId: string) => {
        setSplitPresets(prev => prev.filter(item => item.id !== presetId));
    }, []);

    const handleSplitTerminal = useCallback(() => {
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

    const handleDetachTerminal = useCallback(async () => {
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

    const closeSplitView = useCallback(() => {
        setSplitView(null);
        updateSplitAnalytics('splitClosedCount');
        setTerminalContextMenu(null);
    }, [updateSplitAnalytics]);

    const toggleSplitOrientation = useCallback(() => {
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

    const toggleSynchronizedInput = useCallback(() => {
        setIsSynchronizedInputEnabled(prev => !prev);
        setTerminalContextMenu(null);
    }, []);

    const hasActiveSession = Boolean(activeTabId);
    const activeSemanticIssues = activeTabId ? (semanticIssuesByTab[activeTabId] ?? []) : [];
    const activeSemanticErrorCount = activeSemanticIssues.filter(
        issue => issue.severity === 'error'
    ).length;
    const activeSemanticWarningCount = activeSemanticIssues.filter(
        issue => issue.severity === 'warning'
    ).length;

    const applyAppearancePatch = useCallback((patch: Partial<TerminalAppearancePreferences>) => {
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

    const exportAppearancePreferences = useCallback(() => {
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

    const validateThemeImport = useCallback((data: unknown): { valid: boolean; errors: string[] } => {
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

    const importAppearancePreferences = useCallback(
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
                    alert(`Invalid theme file:\n${validation.errors.join('\n')}`);
                    return;
                }

                applyAppearancePatch(parsed as Partial<TerminalAppearancePreferences>);
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to import terminal appearance preset',
                    error as Error
                );
                alert('Failed to import theme: Invalid JSON file');
            }
        },
        [applyAppearancePatch, validateThemeImport]
    );

    const toggleGalleryView = useCallback(() => {
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsSemanticPanelOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsGalleryView(prev => !prev);
    }, []);

    const toggleFloatingMode = useCallback(() => {
        if (!onFloatingChange) {
            return;
        }
        onFloatingChange(!isFloating);
    }, [isFloating, onFloatingChange]);

    const toggleSemanticPanel = useCallback(() => {
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
    }, [hasActiveSession]);

    const clearActiveSemanticIssues = useCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        clearSemanticIssuesForTab(activeTabIdRef.current);
    }, [clearSemanticIssuesForTab]);

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

    const resetActiveSearchCursor = useCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        delete searchCursorRef.current[activeTabIdRef.current];
        setSearchActiveMatchIndex(-1);
    }, []);

    const pushSearchHistory = useCallback((query: string) => {
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

    const applySearchHistoryAt = useCallback(
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

    const stepSearchHistory = useCallback(
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

    const collectActiveSearchMatches = useCallback(() => {
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

    const jumpToSearchMatch = useCallback(
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

    const runTerminalSearch = useCallback(
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

    const getSearchMatchLabel = useCallback(
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

    const revealSemanticIssue = useCallback(
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
    const getActiveShellType = useCallback(() => {
        if (!activeTabId) {
            return 'bash';
        }
        const tab = tabs.find(t => t.id === activeTabId);
        return tab?.type ?? 'bash';
    }, [activeTabId, tabs]);

    const handleAiExplainError = useCallback(
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

    const handleAiFixError = useCallback(
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

    const handleAiApplyFix = useCallback(
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

    const closeAiPanel = useCallback(() => {
        setIsAiPanelOpen(false);
        setAiResult(null);
        setAiSelectedIssue(null);
    }, []);

    const openTerminalSearch = useCallback(() => {
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
    }, [hasActiveSession, resetActiveSearchCursor]);

    const closeTerminalSearch = useCallback(() => {
        setIsSearchOpen(false);
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        setSearchHistoryIndex(-1);
        const terminal = getActiveTerminalInstance();
        terminal?.clearSelection();
        resetActiveSearchCursor();
    }, [getActiveTerminalInstance, resetActiveSearchCursor]);

    const applyShortcutPreset = useCallback((presetId: TerminalShortcutPresetId) => {
        setShortcutPreset(presetId);
        setShortcutBindings(TERMINAL_SHORTCUT_PRESETS[presetId]);
    }, []);

    const applyShortcutPayload = useCallback(
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

    const exportShortcutPreferences = useCallback(() => {
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

    const importShortcutPreferences = useCallback(
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

    const shareShortcutPreferences = useCallback(async () => {
        try {
            const shareCode = createShortcutShareCode(shortcutPreset, shortcutBindings);
            await navigator.clipboard.writeText(shareCode);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy shortcut share code', error as Error);
        }
    }, [shortcutBindings, shortcutPreset]);

    const importShortcutShareCode = useCallback(() => {
        const raw = window.prompt('Paste shortcut share code');
        if (!raw?.trim()) {
            return;
        }
        const parsed = parseShortcutShareCode(raw);
        applyShortcutPayload(parsed, 'share-code');
    }, [applyShortcutPayload]);

    useEffect(() => {
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

    useEffect(() => {
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

    useEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [activeTabId, resetActiveSearchCursor]);

    useEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [resetActiveSearchCursor, searchUseRegex]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if (!isOpen || isTypingElement(event.target)) {
                return;
            }
            const pressed = keyboardEventToShortcut(event);
            const matchedAction = (Object.entries(shortcutBindings) as Array<
                [TerminalShortcutAction, string]
            >).find(([, binding]) => normalizeShortcutBinding(binding) === pressed)?.[0];
            if (!matchedAction) {
                return;
            }

            event.preventDefault();
            switch (matchedAction) {
                case 'togglePanel':
                    hideTerminalPanel();
                    break;
                case 'newTerminal':
                    void createDefaultTerminal();
                    break;
                case 'closeTab': {
                    const activeId = activeTabIdRef.current;
                    if (activeId) {
                        closeTab(activeId);
                    }
                    break;
                }
                case 'search':
                    if (isSearchOpen) {
                        closeTerminalSearch();
                    } else {
                        openTerminalSearch();
                    }
                    break;
                case 'split':
                    handleSplitTerminal();
                    break;
                case 'detach':
                    void handleDetachTerminal();
                    break;
                default:
                    break;
            }
        };

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

    const reorderTabs = useCallback(
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

    const handleTabDragStart = useCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            setDraggingTabId(tabId);
            setDragOverTabId(tabId);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', tabId);
        },
        []
    );

    const handleTabDragOver = useCallback(
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

    const resetTabDragState = useCallback(() => {
        setDraggingTabId(null);
        setDragOverTabId(null);
    }, []);

    const handleTabDrop = useCallback(
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

    const handleTabSelect = useCallback(
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

    const handlePaneActivate = useCallback(
        (tabId: string) => {
            setActiveTabId(tabId);
            if (!splitView) {
                return;
            }
            setSplitFocusedPane(splitView.primaryId === tabId ? 'primary' : 'secondary');
        },
        [setActiveTabId, splitView]
    );

    const getTabLayoutClass = useCallback(
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
            <input
                ref={appearanceImportInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={event => {
                    void importAppearancePreferences(event);
                }}
            />
            <input
                ref={shortcutImportInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={event => {
                    void importShortcutPreferences(event);
                }}
            />
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/70">
                <TerminalTabsBar
                    tabs={tabs}
                    activeTabId={activeTabId}
                    draggingTabId={draggingTabId}
                    dragOverTabId={dragOverTabId}
                    onSelectTab={handleTabSelect}
                    onCloseTab={closeTab}
                    onTabDragStart={handleTabDragStart}
                    onTabDragOver={handleTabDragOver}
                    onTabDrop={handleTabDrop}
                    onTabDragEnd={resetTabDragState}
                />
                <div className="flex items-center gap-1 border-l border-border/50 pl-1 shrink-0">
                    <Popover open={isNewTerminalMenuOpen} onOpenChange={setIsNewTerminalMenuOpen}>
                        <PopoverTrigger asChild>
                            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            side="top"
                            align="start"
                            sideOffset={8}
                            className="w-auto min-w-[220px] p-1 bg-popover border border-border rounded-lg"
                        >
                            {isLoadingLaunchOptions ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                    {t('common.loading')}
                                </div>
                            ) : availableShells.length > 0 ? (
                                <>
                                    {selectableBackends.length > 0 && (
                                        <div className="px-2 pt-1 pb-1">
                                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                                {t('terminal.defaultBackend')}: {defaultBackendName}
                                            </div>
                                            <div className="mt-1 space-y-0.5">
                                                {selectableBackends.map(backend => (
                                                    <button
                                                        key={backend.id}
                                                        onClick={() => {
                                                            void persistPreferredBackendId(
                                                                backend.id
                                                            );
                                                        }}
                                                        className="w-full px-2 py-1 text-left text-[11px] rounded-sm hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground"
                                                    >
                                                        <span className="truncate">
                                                            {backend.name}
                                                        </span>
                                                        {resolvedDefaultBackendId ===
                                                            backend.id && (
                                                                <Check className="w-3 h-3 text-primary shrink-0" />
                                                            )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {integratedBackend && (
                                        <>
                                            <div className="h-px bg-border/70 my-1" />
                                            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                {t('terminal.integratedSessions')}
                                            </div>
                                            {availableShells.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => {
                                                        createTerminal(s.id, integratedBackend.id);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center gap-2 text-foreground rounded-sm"
                                                >
                                                    <span className="opacity-50">&gt;_</span>
                                                    {s.name}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {launchableExternalBackends.length > 0 && (
                                        <>
                                            <div className="h-px bg-border/70 my-1" />
                                            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                {t('terminal.externalTerminals')}
                                            </div>
                                            {launchableExternalBackends.map(backend => (
                                                <button
                                                    key={backend.id}
                                                    onClick={() => {
                                                        const shellId = resolvePreferredShellId();
                                                        if (shellId) {
                                                            createTerminal(shellId, backend.id);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <TerminalSquare className="w-3 h-3 opacity-60" />
                                                        {backend.name}
                                                    </span>
                                                    {resolvedDefaultBackendId === backend.id && (
                                                        <Check className="w-3 h-3 text-primary shrink-0" />
                                                    )}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    <div className="h-px bg-border/70 my-1" />
                                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {t('terminal.select_connection')}
                                    </div>
                                    {isLoadingRemoteConnections && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">
                                            {t('common.loading')}
                                        </div>
                                    )}
                                    {!isLoadingRemoteConnections &&
                                        remoteSshProfiles.map(profile => (
                                            <button
                                                key={`ssh-${profile.id}`}
                                                onClick={() => {
                                                    createRemoteTerminal({ kind: 'ssh', profile });
                                                }}
                                                className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm"
                                                title={`${profile.username}@${profile.host}:${profile.port}`}
                                            >
                                                <span className="truncate">
                                                    SSH: {profile.name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {profile.host}
                                                </span>
                                            </button>
                                        ))}
                                    {!isLoadingRemoteConnections &&
                                        remoteDockerContainers.map(container => (
                                            <button
                                                key={`docker-${container.id}`}
                                                onClick={() => {
                                                    createRemoteTerminal({
                                                        kind: 'docker',
                                                        container,
                                                    });
                                                }}
                                                className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center justify-between gap-2 text-foreground rounded-sm"
                                                title={container.id}
                                            >
                                                <span className="truncate">
                                                    Docker: {container.name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                                    {container.status}
                                                </span>
                                            </button>
                                        ))}
                                    {!isLoadingRemoteConnections && !hasRemoteConnections && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">
                                            {t('terminal.no_ssh_profiles')} /{' '}
                                            {t('terminal.no_containers')}
                                        </div>
                                    )}
                                    {selectableBackends.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground">
                                            {t('terminal.noBackendsAvailable')}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                    {t('terminal.noShellsFound')}
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                    <div className="flex items-center gap-1">
                        <Popover open={isAppearanceMenuOpen} onOpenChange={setIsAppearanceMenuOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                    title={t('terminal.appearance')}
                                >
                                    <Palette className="w-3.5 h-3.5" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                side="top"
                                align="end"
                                sideOffset={8}
                                className="w-[300px] p-2 bg-popover border border-border rounded-lg space-y-2"
                            >
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {t('terminal.theme')}
                                </div>
                                <div className="max-h-28 overflow-y-auto space-y-1">
                                    {TERMINAL_THEME_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => {
                                                applyAppearancePatch({ themePresetId: preset.id });
                                            }}
                                            className="w-full px-2 py-1 rounded-sm text-left text-xs hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                                        >
                                            <span className="truncate">{preset.name}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {themeCategoryLabel(preset)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <div className="rounded border border-border/50 p-1.5 text-[10px] font-mono overflow-hidden"
                                    style={{
                                        backgroundColor: resolveTerminalAppearance(getTerminalTheme(), terminalAppearance).theme.background,
                                        color: resolveTerminalAppearance(getTerminalTheme(), terminalAppearance).theme.foreground,
                                        fontFamily: resolveTerminalAppearance(getTerminalTheme(), terminalAppearance).fontFamily,
                                        fontSize: `${Math.min(terminalAppearance.fontSize, 11)}px`,
                                        lineHeight: terminalAppearance.lineHeight,
                                    }}
                                >
                                    <div>$ echo &quot;Theme Preview&quot;</div>
                                    <div style={{ color: resolveTerminalAppearance(getTerminalTheme(), terminalAppearance).theme.green }}>✓ Success</div>
                                    <div style={{ color: resolveTerminalAppearance(getTerminalTheme(), terminalAppearance).theme.red }}>✗ Error</div>
                                    <div style={{ color: resolveTerminalAppearance(getTerminalTheme(), terminalAppearance).theme.yellow }}>⚠ Warning</div>
                                </div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {t('terminal.font')}
                                </div>
                                <div className="space-y-1">
                                    {TERMINAL_FONT_PRESETS.map(fontPreset => (
                                        <button
                                            key={fontPreset.id}
                                            onClick={() => {
                                                applyAppearancePatch({
                                                    fontPresetId: fontPreset.id,
                                                });
                                            }}
                                            className={cn(
                                                'w-full px-2 py-1 rounded-sm text-left text-xs hover:bg-accent/50 transition-colors',
                                                terminalAppearance.fontPresetId === fontPreset.id &&
                                                'bg-accent/40'
                                            )}
                                        >
                                            {fontPreset.name}
                                        </button>
                                    ))}
                                </div>
                                <label className="flex items-center justify-between gap-3 text-xs">
                                    <span>{t('terminal.fontLigatures')}</span>
                                    <input
                                        type="checkbox"
                                        checked={terminalAppearance.ligatures}
                                        onChange={event => {
                                            applyAppearancePatch({
                                                ligatures: event.target.checked,
                                            });
                                        }}
                                        className="h-3.5 w-3.5 rounded border-border bg-background"
                                    />
                                </label>
                                <div className="pt-1 border-t border-border/50 space-y-1">
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {t('terminal.cursorStyle')}
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {TERMINAL_CURSOR_STYLES.map(cursorStyle => (
                                            <button
                                                key={cursorStyle.id}
                                                onClick={() => {
                                                    applyAppearancePatch({ cursorStyle: cursorStyle.id });
                                                }}
                                                className={cn(
                                                    'px-2 py-1 rounded-sm text-[11px] border transition-colors',
                                                    terminalAppearance.cursorStyle === cursorStyle.id
                                                        ? 'bg-accent border-border text-foreground'
                                                        : 'bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30'
                                                )}
                                            >
                                                {cursorStyle.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <label className="flex items-center justify-between gap-3 text-xs">
                                    <span>{t('terminal.cursorBlink')}</span>
                                    <input
                                        type="checkbox"
                                        checked={terminalAppearance.cursorBlink}
                                        onChange={event => {
                                            applyAppearancePatch({
                                                cursorBlink: event.target.checked,
                                            });
                                        }}
                                        className="h-3.5 w-3.5 rounded border-border bg-background"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                    <span className="w-20 shrink-0 text-muted-foreground">
                                        {t('terminal.fontSize')}
                                    </span>
                                    <input
                                        type="range"
                                        min={8}
                                        max={32}
                                        step={1}
                                        value={terminalAppearance.fontSize}
                                        onChange={event => {
                                            applyAppearancePatch({
                                                fontSize: Number(event.target.value),
                                            });
                                        }}
                                        className="flex-1"
                                    />
                                    <span className="w-6 text-right text-muted-foreground">
                                        {terminalAppearance.fontSize}
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                    <span className="w-20 shrink-0 text-muted-foreground">
                                        {t('terminal.lineHeight')}
                                    </span>
                                    <input
                                        type="range"
                                        min={1}
                                        max={2}
                                        step={0.1}
                                        value={terminalAppearance.lineHeight}
                                        onChange={event => {
                                            applyAppearancePatch({
                                                lineHeight: Number(event.target.value),
                                            });
                                        }}
                                        className="flex-1"
                                    />
                                    <span className="w-6 text-right text-muted-foreground">
                                        {terminalAppearance.lineHeight.toFixed(1)}
                                    </span>
                                </label>
                                <div className="pt-1 border-t border-border/50 space-y-1">
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        Shortcut Preset
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {(['default', 'vim', 'emacs'] as TerminalShortcutPresetId[]).map(presetId => (
                                            <button
                                                key={presetId}
                                                onClick={() => {
                                                    applyShortcutPreset(presetId);
                                                }}
                                                className={cn(
                                                    'px-2 py-1 rounded-sm text-[11px] border transition-colors capitalize',
                                                    shortcutPreset === presetId
                                                        ? 'bg-accent border-border text-foreground'
                                                        : 'bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30'
                                                )}
                                            >
                                                {presetId}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <button
                                            onClick={exportShortcutPreferences}
                                            className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                                        >
                                            Export
                                        </button>
                                        <button
                                            onClick={() => {
                                                shortcutImportInputRef.current?.click();
                                            }}
                                            className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                                        >
                                            Import
                                        </button>
                                        <button
                                            onClick={() => {
                                                void shareShortcutPreferences();
                                            }}
                                            className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                                        >
                                            Share
                                        </button>
                                        <button
                                            onClick={importShortcutShareCode}
                                            className="px-2 py-1 rounded border border-border text-[11px] hover:bg-accent/50 transition-colors"
                                        >
                                            Apply Code
                                        </button>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-xs">
                                    <span className="w-20 shrink-0 text-muted-foreground">
                                        {t('terminal.transparency')}
                                    </span>
                                    <input
                                        type="range"
                                        min={0.6}
                                        max={1}
                                        step={0.02}
                                        value={terminalAppearance.surfaceOpacity}
                                        onChange={event => {
                                            applyAppearancePatch({
                                                surfaceOpacity: Number(event.target.value),
                                            });
                                        }}
                                        className="flex-1"
                                    />
                                </label>
                                <label className="flex items-center gap-2 text-xs">
                                    <span className="w-20 shrink-0 text-muted-foreground">
                                        {t('terminal.blur')}
                                    </span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={24}
                                        step={1}
                                        value={terminalAppearance.surfaceBlur}
                                        onChange={event => {
                                            applyAppearancePatch({
                                                surfaceBlur: Number(event.target.value),
                                            });
                                        }}
                                        className="flex-1"
                                    />
                                </label>
                                <div className="pt-1 border-t border-border/50 space-y-1">
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {t('terminal.customTheme')}
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <label className="flex items-center gap-1.5 text-[11px]">
                                            <input
                                                type="color"
                                                value={terminalAppearance.customTheme?.background ?? '#1e1e1e'}
                                                onChange={event => {
                                                    applyAppearancePatch({
                                                        customTheme: {
                                                            ...terminalAppearance.customTheme,
                                                            background: event.target.value,
                                                        },
                                                    });
                                                }}
                                                className="w-5 h-5 rounded border border-border cursor-pointer"
                                            />
                                            <span className="text-muted-foreground">Background</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[11px]">
                                            <input
                                                type="color"
                                                value={terminalAppearance.customTheme?.foreground ?? '#d4d4d4'}
                                                onChange={event => {
                                                    applyAppearancePatch({
                                                        customTheme: {
                                                            ...terminalAppearance.customTheme,
                                                            foreground: event.target.value,
                                                        },
                                                    });
                                                }}
                                                className="w-5 h-5 rounded border border-border cursor-pointer"
                                            />
                                            <span className="text-muted-foreground">Foreground</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[11px]">
                                            <input
                                                type="color"
                                                value={terminalAppearance.customTheme?.cursor ?? '#d4d4d4'}
                                                onChange={event => {
                                                    applyAppearancePatch({
                                                        customTheme: {
                                                            ...terminalAppearance.customTheme,
                                                            cursor: event.target.value,
                                                        },
                                                    });
                                                }}
                                                className="w-5 h-5 rounded border border-border cursor-pointer"
                                            />
                                            <span className="text-muted-foreground">Cursor</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[11px]">
                                            <input
                                                type="color"
                                                value={terminalAppearance.customTheme?.selectionBackground ?? '#264f78'}
                                                onChange={event => {
                                                    applyAppearancePatch({
                                                        customTheme: {
                                                            ...terminalAppearance.customTheme,
                                                            selectionBackground: event.target.value,
                                                        },
                                                    });
                                                }}
                                                className="w-5 h-5 rounded border border-border cursor-pointer"
                                            />
                                            <span className="text-muted-foreground">Selection</span>
                                        </label>
                                    </div>
                                    {terminalAppearance.customTheme && (
                                        <button
                                            onClick={() => {
                                                applyAppearancePatch({ customTheme: null });
                                            }}
                                            className="w-full px-2 py-1 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                                        >
                                            {t('terminal.resetToDefault')}
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/60">
                                    <button
                                        onClick={exportAppearancePreferences}
                                        className="px-2 py-1 rounded border border-border text-xs hover:bg-accent/50 transition-colors"
                                    >
                                        {t('terminal.exportTheme')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            appearanceImportInputRef.current?.click();
                                        }}
                                        className="px-2 py-1 rounded border border-border text-xs hover:bg-accent/50 transition-colors"
                                    >
                                        {t('terminal.importTheme')}
                                    </button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <TerminalSplitControls
                            t={t}
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
                        />
                        <button
                            onClick={toggleGalleryView}
                            disabled={tabs.length <= 1}
                            className={cn(
                                'p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                                isGalleryView && 'text-primary'
                            )}
                            title={t('terminal.galleryView')}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        {onFloatingChange && (
                            <button
                                onClick={toggleFloatingMode}
                                className={cn(
                                    'p-1.5 text-muted-foreground hover:text-foreground transition-colors',
                                    isFloating && 'text-primary'
                                )}
                                title={
                                    isFloating
                                        ? t('terminal.dockTerminal')
                                        : t('terminal.floatTerminal')
                                }
                            >
                                <TerminalSquare className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            onClick={toggleSemanticPanel}
                            disabled={!hasActiveSession}
                            className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={t('terminal.semanticIssues')}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {activeSemanticIssues.length > 0 && (
                                <span
                                    className={cn(
                                        'absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] leading-[14px] text-center font-semibold',
                                        activeSemanticErrorCount > 0
                                            ? 'bg-destructive/90 text-destructive-foreground'
                                            : 'bg-amber-500/90 text-black'
                                    )}
                                >
                                    {Math.min(activeSemanticIssues.length, 99)}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={openMultiplexerPanel}
                            disabled={!hasActiveSession}
                            className={cn(
                                'p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                                isMultiplexerOpen && 'text-primary'
                            )}
                            title="Multiplexer (tmux/screen)"
                        >
                            <Rows2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={toggleRecording}
                            disabled={!hasActiveSession}
                            className={cn(
                                'relative p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                                activeRecordingTabId && 'text-destructive'
                            )}
                            title={activeRecordingTabId ? 'Stop recording' : 'Start recording'}
                        >
                            {activeRecordingTabId ? (
                                <Square className="w-3.5 h-3.5" />
                            ) : (
                                <Play className="w-3.5 h-3.5" />
                            )}
                            {activeRecordingTabId && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setIsMaximized(!isMaximized);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isMaximized ? (
                                <Minimize2 className="w-3.5 h-3.5" />
                            ) : (
                                <Maximize2 className="w-3.5 h-3.5" />
                            )}
                        </button>
                        <button
                            onClick={onToggle}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
            <div
                className="flex-1 overflow-hidden relative"
                onContextMenu={openTerminalContextMenu}
            >
                {!isGalleryView &&
                    tabs.map(tab => (
                        <TerminalInstance
                            key={tab.id}
                            tab={tab}
                            isVisible={
                                splitView
                                    ? tab.id === splitView.primaryId ||
                                    tab.id === splitView.secondaryId
                                    : activeTabId === tab.id
                            }
                            className={getTabLayoutClass(tab.id)}
                            onActivate={() => {
                                handlePaneActivate(tab.id);
                            }}
                            onClose={() => {
                                closeTab(tab.id);
                            }}
                            projectPath={projectPath}
                            appearance={terminalAppearance}
                            resolvedAppearance={resolvedTerminalAppearance}
                            onTerminalInstanceChange={setTerminalInstance}
                        />
                    ))}
                {isGalleryView && tabs.length > 0 && (
                    <div className="absolute inset-0 p-2 overflow-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 auto-rows-[260px]">
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    className={cn(
                                        'relative rounded-lg border overflow-hidden bg-background/70',
                                        activeTabId === tab.id
                                            ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]'
                                            : 'border-border/70'
                                    )}
                                    onMouseDown={() => {
                                        handleTabSelect(tab.id);
                                    }}
                                    onDoubleClick={() => {
                                        handleTabSelect(tab.id);
                                        setIsGalleryView(false);
                                    }}
                                >
                                    <div className="absolute top-0 inset-x-0 z-10 h-7 flex items-center justify-between px-2 bg-background/80 border-b border-border/70 backdrop-blur">
                                        <div className="text-[11px] truncate text-foreground/90">
                                            {tab.name}
                                        </div>
                                        <button
                                            onClick={event => {
                                                event.stopPropagation();
                                                closeTab(tab.id);
                                            }}
                                            className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 top-7">
                                        <TerminalInstance
                                            tab={tab}
                                            isVisible={true}
                                            className="absolute inset-0"
                                            onActivate={() => {
                                                handlePaneActivate(tab.id);
                                            }}
                                            onClose={() => {
                                                closeTab(tab.id);
                                            }}
                                            projectPath={projectPath}
                                            appearance={terminalAppearance}
                                            resolvedAppearance={resolvedTerminalAppearance}
                                            onTerminalInstanceChange={setTerminalInstance}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {tabs.length === 0 && (
                    <TerminalEmptyState
                        title={t('terminal.noActiveSessions')}
                        actionLabel={t('terminal.startNewSession')}
                        onCreate={() => {
                            void createDefaultTerminal();
                        }}
                    />
                )}
            </div>
            {terminalContextMenu &&
                createPortal(
                    <TerminalContextMenu
                        position={terminalContextMenu}
                        hasActiveSession={hasActiveSession}
                        canUseGallery={tabs.length > 1}
                        isGalleryView={isGalleryView}
                        onCopy={() => {
                            void handleCopySelection();
                        }}
                        onCopyWithFormatting={() => {
                            void handleCopyWithFormatting();
                        }}
                        onCopyStripAnsi={() => {
                            void handleCopyStripAnsi();
                        }}
                        onPaste={() => {
                            void handlePasteClipboard();
                        }}
                        onTestPaste={() => {
                            void handleTestPaste();
                        }}
                        onSelectAll={handleSelectAll}
                        onSearch={openTerminalSearch}
                        onSemanticToggle={toggleSemanticPanel}
                        onGalleryToggle={toggleGalleryView}
                        onFloatingToggle={
                            onFloatingChange
                                ? () => {
                                    toggleFloatingMode();
                                    setTerminalContextMenu(null);
                                }
                                : undefined
                        }
                        onHistoryToggle={openCommandHistory}
                        onTaskRunnerToggle={openTaskRunner}
                        onMultiplexerToggle={openMultiplexerPanel}
                        onRecordingToggle={() => {
                            toggleRecording();
                            setTerminalContextMenu(null);
                        }}
                        onOpenRecordings={() => {
                            setTerminalContextMenu(null);
                            setIsSearchOpen(false);
                            setIsGalleryView(false);
                            setIsSemanticPanelOpen(false);
                            setIsCommandHistoryOpen(false);
                            setIsTaskRunnerOpen(false);
                            setIsMultiplexerOpen(false);
                            setIsRecordingPanelOpen(true);
                        }}
                        onNewTerminal={() => {
                            void createDefaultTerminal();
                            setTerminalContextMenu(null);
                        }}
                        onHidePanel={hideTerminalPanel}
                        onClearOutput={handleClearOutput}
                        onSplit={handleSplitTerminal}
                        onDetach={() => {
                            void handleDetachTerminal();
                        }}
                        onToggleSynchronizedInput={toggleSynchronizedInput}
                        onCloseSplit={closeSplitView}
                        onToggleSplitOrientation={toggleSplitOrientation}
                        splitActive={Boolean(splitView)}
                        isSynchronizedInputEnabled={isSynchronizedInputEnabled}
                        isRecordingActive={Boolean(activeRecordingTabId)}
                        semanticIssueCount={activeSemanticIssues.length}
                        semanticErrorCount={activeSemanticErrorCount}
                        semanticWarningCount={activeSemanticWarningCount}
                        isFloating={isFloating}
                        projectPath={projectPath}
                        pasteHistory={pasteHistory}
                        onPasteHistory={entry => {
                            void handlePasteFromHistory(entry);
                        }}
                        labels={{
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
                        }}
                    />,
                    document.body
                )}
            {isSemanticPanelOpen && (
                <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 min-w-[340px] max-w-[460px]">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            {t('terminal.semanticIssues')}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>
                                {t('terminal.semanticErrors')}: {activeSemanticErrorCount}
                            </span>
                            <span>
                                {t('terminal.semanticWarnings')}: {activeSemanticWarningCount}
                            </span>
                            <button
                                onClick={clearActiveSemanticIssues}
                                className="px-1.5 py-0.5 rounded border border-border hover:bg-accent/50 transition-colors text-foreground"
                            >
                                {t('terminal.clearIssues')}
                            </button>
                        </div>
                    </div>
                    {activeSemanticIssues.length === 0 ? (
                        <div className="px-1 py-2 text-xs text-muted-foreground">
                            {t('terminal.semanticNoIssues')}
                        </div>
                    ) : (
                        <div className="max-h-56 overflow-y-auto space-y-1">
                            {activeSemanticIssues.map(issue => (
                                <div
                                    key={issue.id}
                                    className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors border border-transparent hover:border-border/70 group"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span
                                            className={cn(
                                                'text-[10px] uppercase tracking-wide font-semibold',
                                                issue.severity === 'error'
                                                    ? 'text-destructive'
                                                    : 'text-amber-500'
                                            )}
                                        >
                                            {issue.severity}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {issue.severity === 'error' && (
                                                <>
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            void handleAiExplainError(issue);
                                                        }}
                                                        className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                        title={t('terminal.aiExplainError')}
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            void handleAiFixError(issue);
                                                        }}
                                                        className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                        title={t('terminal.aiFixError')}
                                                    >
                                                        <Wrench className="w-3 h-3" />
                                                    </button>
                                                </>
                                            )}
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(issue.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            revealSemanticIssue(issue);
                                        }}
                                        className="w-full text-left"
                                    >
                                        <div className="text-xs text-foreground/90 mt-0.5 line-clamp-2">
                                            {issue.message}
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {/* AI Assistant Panel */}
            {isAiPanelOpen && (
                <div className="absolute top-2 right-2 z-30 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-3 py-3 min-w-[380px] max-w-[500px]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                            <Bot className="w-4 h-4 text-primary" />
                            {aiPanelMode === 'explain-error' && t('terminal.aiExplainError')}
                            {aiPanelMode === 'fix-error' && t('terminal.aiFixError')}
                            {aiPanelMode === 'explain-command' && t('terminal.aiExplainCommand')}
                        </div>
                        <button
                            onClick={closeAiPanel}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {aiSelectedIssue && (
                        <div className="mb-3 p-2 rounded bg-destructive/10 border border-destructive/30">
                            <div className="text-[10px] uppercase tracking-wide text-destructive font-semibold mb-1">
                                {aiSelectedIssue.severity}
                            </div>
                            <div className="text-xs text-foreground/90 line-clamp-3">
                                {aiSelectedIssue.message}
                            </div>
                        </div>
                    )}

                    {aiIsLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">
                                {t('terminal.aiAnalyzing')}
                            </span>
                        </div>
                    ) : aiResult ? (
                        <div className="space-y-3">
                            {aiResult.type === 'explain-error' && (
                                <>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                            {t('terminal.aiSummary')}
                                        </div>
                                        <div className="text-xs text-foreground">
                                            {String(aiResult.data.summary ?? '')}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                            {t('terminal.aiCause')}
                                        </div>
                                        <div className="text-xs text-foreground">
                                            {String(aiResult.data.cause ?? '')}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                            {t('terminal.aiSolution')}
                                        </div>
                                        <div className="text-xs text-foreground">
                                            {String(aiResult.data.solution ?? '')}
                                        </div>
                                    </div>
                                    {Array.isArray(aiResult.data.steps) &&
                                        aiResult.data.steps.length > 0 && (
                                            <div>
                                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                                    {t('terminal.aiSteps')}
                                                </div>
                                                <ol className="list-decimal list-inside text-xs text-foreground space-y-1">
                                                    {(aiResult.data.steps as string[]).map(
                                                        (step, idx) => (
                                                            <li key={idx}>{step}</li>
                                                        )
                                                    )}
                                                </ol>
                                            </div>
                                        )}
                                </>
                            )}
                            {aiResult.type === 'fix-error' && (
                                <>
                                    {aiResult.data.suggestedCommand && (
                                        <div>
                                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                                {t('terminal.aiSuggestedCommand')}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 text-xs bg-muted/50 px-2 py-1.5 rounded font-mono break-all">
                                                    {String(aiResult.data.suggestedCommand)}
                                                </code>
                                                <button
                                                    onClick={() => {
                                                        void handleAiApplyFix(
                                                            String(aiResult.data.suggestedCommand)
                                                        );
                                                    }}
                                                    className="shrink-0 px-2 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-1"
                                                >
                                                    <Play className="w-3 h-3" />
                                                    {t('terminal.aiRunCommand')}
                                                </button>
                                            </div>
                                            <div className="mt-1 text-[10px] text-muted-foreground">
                                                {t('terminal.aiConfidence')}:{' '}
                                                {String(aiResult.data.confidence ?? 'low')}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                            {t('terminal.aiExplanation')}
                                        </div>
                                        <div className="text-xs text-foreground">
                                            {String(aiResult.data.explanation ?? '')}
                                        </div>
                                    </div>
                                    {Array.isArray(aiResult.data.alternativeCommands) &&
                                        aiResult.data.alternativeCommands.length > 0 && (
                                            <div>
                                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                                    {t('terminal.aiAlternatives')}
                                                </div>
                                                <div className="space-y-1">
                                                    {(
                                                        aiResult.data
                                                            .alternativeCommands as string[]
                                                    ).map((cmd, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <code className="flex-1 text-xs bg-muted/30 px-2 py-1 rounded font-mono break-all">
                                                                {cmd}
                                                            </code>
                                                            <button
                                                                onClick={() => {
                                                                    void handleAiApplyFix(cmd);
                                                                }}
                                                                className="shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors"
                                                                title={t('terminal.aiRunCommand')}
                                                            >
                                                                <Play className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
            {isMultiplexerOpen && (
                <TerminalMultiplexerPanel
                    t={t}
                    hasActiveSession={hasActiveSession}
                    multiplexerMode={multiplexerMode}
                    multiplexerSessionName={multiplexerSessionName}
                    multiplexerSessions={multiplexerSessions}
                    isMultiplexerLoading={isMultiplexerLoading}
                    multiplexerError={multiplexerError}
                    closeMultiplexerPanel={closeMultiplexerPanel}
                    setMultiplexerMode={setMultiplexerMode}
                    refreshMultiplexerSessions={refreshMultiplexerSessions}
                    setMultiplexerSessionName={setMultiplexerSessionName}
                    createMultiplexerSession={createMultiplexerSession}
                    attachMultiplexerSession={attachMultiplexerSession}
                />
            )}
            {isRecordingPanelOpen && (
                <TerminalRecordingPanel
                    t={t}
                    hasActiveSession={hasActiveSession}
                    activeRecordingTabId={activeRecordingTabId}
                    activeRecordingLabel={
                        activeRecordingTabId
                            ? (tabs.find(tab => tab.id === activeRecordingTabId)?.name ??
                                activeRecordingTabId)
                            : null
                    }
                    recordings={recordings}
                    selectedRecordingId={selectedRecordingId}
                    selectedRecording={selectedRecording}
                    selectedRecordingText={selectedRecordingText}
                    replayText={replayText}
                    isReplayRunning={isReplayRunning}
                    setIsRecordingPanelOpen={setIsRecordingPanelOpen}
                    toggleRecording={toggleRecording}
                    startReplay={startReplay}
                    stopReplay={stopReplay}
                    exportRecording={exportRecording}
                    setSelectedRecordingId={setSelectedRecordingId}
                    setReplayText={setReplayText}
                />
            )}
            {isSearchOpen && (
                <TerminalSearchOverlay
                    t={t}
                    searchInputRef={searchInputRef}
                    searchQuery={searchQuery}
                    searchUseRegex={searchUseRegex}
                    searchStatus={searchStatus}
                    searchMatches={searchMatches}
                    searchActiveMatchIndex={searchActiveMatchIndex}
                    searchHistory={searchHistory}
                    setSearchQuery={setSearchQuery}
                    setSearchUseRegex={setSearchUseRegex}
                    setSearchStatus={setSearchStatus}
                    setSearchMatches={setSearchMatches}
                    setSearchActiveMatchIndex={setSearchActiveMatchIndex}
                    setSearchHistoryIndex={setSearchHistoryIndex}
                    resetActiveSearchCursor={resetActiveSearchCursor}
                    runTerminalSearch={runTerminalSearch}
                    closeTerminalSearch={closeTerminalSearch}
                    stepSearchHistory={stepSearchHistory}
                    jumpToSearchMatch={jumpToSearchMatch}
                    getSearchMatchLabel={getSearchMatchLabel}
                />
            )}
            <TerminalCommandPanels
                t={t}
                isCommandHistoryOpen={isCommandHistoryOpen}
                isCommandHistoryLoading={isCommandHistoryLoading}
                commandHistoryQuery={commandHistoryQuery}
                commandHistoryItems={commandHistoryItems}
                setCommandHistoryQuery={setCommandHistoryQuery}
                closeCommandHistory={closeCommandHistory}
                clearCommandHistory={clearCommandHistory}
                executeHistoryCommand={executeHistoryCommand}
                isTaskRunnerOpen={isTaskRunnerOpen}
                isTaskRunnerLoading={isTaskRunnerLoading}
                taskRunnerQuery={taskRunnerQuery}
                taskRunnerItems={taskRunnerItems}
                setTaskRunnerQuery={setTaskRunnerQuery}
                closeTaskRunner={closeTaskRunner}
                executeTaskRunnerEntry={executeTaskRunnerEntry}
            />
        </motion.div>
    );
}
