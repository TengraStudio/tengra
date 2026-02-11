import { useTranslation } from '@renderer/i18n';
import {
    AlertTriangle,
    Bot,
    Check,
    ChevronDown,
    ChevronUp,
    Columns2,
    Download,
    History,
    LayoutGrid,
    Loader2,
    Maximize2,
    Minimize2,
    Palette,
    Play,
    Plus,
    Rows2,
    Search,
    Sparkles,
    Square,
    Terminal,
    TerminalSquare,
    Wrench,
    X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type ITheme, Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/hooks/useTheme';
import { motion } from '@/lib/framer-motion-compat';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { useTerminalSmartSuggestions } from './hooks/useTerminalSmartSuggestions';

import 'xterm/css/xterm.css';

const initializedTerminals = new Set<string>();
const initializingTerminals = new Set<string>();
const TERMINAL_SEARCH_HISTORY_STORAGE_KEY = 'terminal.search-history.v1';
const TERMINAL_SEARCH_HISTORY_LIMIT = 12;
const TERMINAL_PREFERRED_BACKEND_STORAGE_KEY = 'terminal.preferred-backend.v1';
const TERMINAL_APPEARANCE_STORAGE_KEY = 'terminal.appearance.v1';
const URL_LINK_REGEX = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const WINDOWS_PATH_LINK_REGEX = /\b[A-Za-z]:[\\/][^\s"'`<>|]+/g;
const UNIX_PATH_LINK_REGEX = /(?:^|[\s([{'"`])(\/[^\s"'`<>()`]+)/g;
const TRAILING_LINK_CHARACTERS_REGEX = /[.,;:!?)}\]'"]+$/;
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

type DetectedTerminalLink = {
    text: string;
    target: string;
    start: number;
    end: number;
    type: 'url' | 'path';
};

function trimTrailingLinkCharacters(value: string): string {
    let normalized = value;
    while (TRAILING_LINK_CHARACTERS_REGEX.test(normalized)) {
        normalized = normalized.replace(TRAILING_LINK_CHARACTERS_REGEX, '');
    }
    return normalized;
}

function normalizePathLinkTarget(path: string): string {
    const withoutLineColumn = path.replace(/(?::\d+){1,2}$/, '');
    return trimTrailingLinkCharacters(withoutLineColumn);
}

function resolveTerminalLineLinks(lineText: string): DetectedTerminalLink[] {
    if (!lineText) {
        return [];
    }

    const matches: DetectedTerminalLink[] = [];

    URL_LINK_REGEX.lastIndex = 0;
    for (let match = URL_LINK_REGEX.exec(lineText); match; match = URL_LINK_REGEX.exec(lineText)) {
        const rawText = match[0] ?? '';
        const text = trimTrailingLinkCharacters(rawText);
        if (!text) {
            continue;
        }
        const start = match.index;
        const end = start + text.length;
        matches.push({ text, target: text, start, end, type: 'url' });
    }

    WINDOWS_PATH_LINK_REGEX.lastIndex = 0;
    for (
        let match = WINDOWS_PATH_LINK_REGEX.exec(lineText);
        match;
        match = WINDOWS_PATH_LINK_REGEX.exec(lineText)
    ) {
        const rawText = match[0] ?? '';
        const target = normalizePathLinkTarget(rawText);
        if (!target) {
            continue;
        }
        const start = match.index;
        const end = start + target.length;
        matches.push({ text: target, target, start, end, type: 'path' });
    }

    UNIX_PATH_LINK_REGEX.lastIndex = 0;
    for (
        let match = UNIX_PATH_LINK_REGEX.exec(lineText);
        match;
        match = UNIX_PATH_LINK_REGEX.exec(lineText)
    ) {
        const rawText = match[1] ?? '';
        const target = normalizePathLinkTarget(rawText);
        if (!target) {
            continue;
        }

        const prefixOffset = (match[0]?.length ?? 0) - rawText.length;
        const start = match.index + Math.max(prefixOffset, 0);
        const end = start + target.length;
        matches.push({ text: target, target, start, end, type: 'path' });
    }

    if (matches.length === 0) {
        return [];
    }

    matches.sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start;
        }
        if (a.type !== b.type) {
            return a.type === 'url' ? -1 : 1;
        }
        return b.end - b.start - (a.end - a.start);
    });

    const deduped: DetectedTerminalLink[] = [];
    for (const candidate of matches) {
        if (candidate.end <= candidate.start) {
            continue;
        }
        const overlapsExisting = deduped.some(
            existing => candidate.start < existing.end && candidate.end > existing.start
        );
        if (overlapsExisting) {
            continue;
        }
        deduped.push(candidate);
    }

    return deduped;
}

function toSafeFileUrl(path: string): string {
    return `safe-file://${encodeURIComponent(path)}`;
}

function joinProjectPath(basePath: string, child: string): string {
    const normalizedBase = basePath.replace(/[\\/]+$/, '');
    if (!normalizedBase) {
        return child;
    }
    return `${normalizedBase}/${child}`;
}

function extractMakeTargets(content: string): string[] {
    const targetPattern = /^([A-Za-z0-9_.-]+)\s*:(?![=])/;
    const ignored = new Set(['.PHONY']);
    const targets = new Set<string>();
    content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }
        const match = targetPattern.exec(trimmed);
        if (!match) {
            return;
        }
        const target = match[1] ?? '';
        if (!target || ignored.has(target) || target.startsWith('.')) {
            return;
        }
        targets.add(target);
    });
    return Array.from(targets);
}

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

type SplitViewState = {
    primaryId: string;
    secondaryId: string;
    orientation: 'vertical' | 'horizontal';
};

type TerminalHistoryEntry = {
    command: string;
    shell?: string;
    cwd?: string;
    timestamp: number;
    sessionId: string;
};

type TaskRunnerEntry = {
    id: string;
    label: string;
    command: string;
    source: 'npm' | 'make' | 'cargo';
};

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

type TerminalAppearancePreferences = {
    themePresetId: string;
    fontPresetId: string;
    ligatures: boolean;
    surfaceOpacity: number;
    surfaceBlur: number;
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

const DEFAULT_TERMINAL_APPEARANCE: TerminalAppearancePreferences = {
    themePresetId: 'system',
    fontPresetId: 'jetbrains',
    ligatures: true,
    surfaceOpacity: 0.92,
    surfaceBlur: 14,
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
): { theme: ITheme; fontFamily: string } {
    const themePreset =
        TERMINAL_THEME_PRESETS.find(item => item.id === appearance.themePresetId) ??
        TERMINAL_THEME_PRESETS[0];
    const fontPreset =
        TERMINAL_FONT_PRESETS.find(item => item.id === appearance.fontPresetId) ??
        TERMINAL_FONT_PRESETS[0];
    return {
        theme: { ...baseTheme, ...themePreset.theme },
        fontFamily: fontPreset.fontFamily,
    };
}

const useTerminalSession = (
    tab: TerminalTab,
    containerRef: React.RefObject<HTMLDivElement>,
    projectPath: string | undefined
) => {
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isInitializedRef = useRef(false);
    // CLEAN-002-2: Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);
    const hasBootstrappedRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;

        if (
            initializedTerminals.has(tab.id) ||
            initializingTerminals.has(tab.id) ||
            !containerRef.current ||
            isInitializedRef.current
        ) {
            return;
        }
        isInitializedRef.current = true;
        initializingTerminals.add(tab.id);

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            theme: getTerminalTheme(),
            allowProposedApi: true,
            scrollback: 10000,
            cols: 80,
            rows: 24,
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        let webglAddon: { dispose: () => void } | null = null;

        const initializeGpuRenderer = async () => {
            if (
                typeof window === 'undefined' ||
                !('WebGL2RenderingContext' in window) ||
                !isMountedRef.current
            ) {
                return;
            }
            try {
                const { WebglAddon } = await import('@xterm/addon-webgl');
                if (!isMountedRef.current) {
                    return;
                }

                const addon = new WebglAddon();
                addon.onContextLoss(() => {
                    appLogger.warn(
                        'TerminalPanel',
                        'Terminal WebGL context lost, falling back to canvas renderer'
                    );
                    try {
                        addon.dispose();
                    } catch {
                        // Ignore addon disposal errors after context loss.
                    }
                    if (webglAddon === addon) {
                        webglAddon = null;
                    }
                });
                term.loadAddon(addon);
                webglAddon = addon;
            } catch (error) {
                appLogger.warn(
                    'TerminalPanel',
                    'WebGL renderer unavailable, using default terminal renderer',
                    error instanceof Error ? error : new Error(String(error))
                );
            }
        };

        void initializeGpuRenderer();
        const linkProviderDisposable = term.registerLinkProvider({
            provideLinks: (bufferLineNumber, callback) => {
                const lineText =
                    term.buffer.active.getLine(bufferLineNumber - 1)?.translateToString(true) ?? '';
                const links = resolveTerminalLineLinks(lineText);
                if (links.length === 0) {
                    callback(undefined);
                    return;
                }

                callback(
                    links.map(link => ({
                        text: link.text,
                        range: {
                            start: { x: link.start + 1, y: bufferLineNumber },
                            end: { x: link.end, y: bufferLineNumber },
                        },
                        activate: () => {
                            const target =
                                link.type === 'url' ? link.target : toSafeFileUrl(link.target);
                            try {
                                window.electron.openExternal(target);
                            } catch (error) {
                                appLogger.error(
                                    'TerminalPanel',
                                    `Failed to open terminal ${link.type} link: ${link.target}`,
                                    error instanceof Error ? error : new Error(String(error))
                                );
                            }
                        },
                    }))
                );
            },
        });
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        let sessionCreated = false;
        const setupEvents = (id: string) => {
            term.onResize(s => {
                if (sessionCreated && isMountedRef.current) {
                    void window.electron.terminal.resize(id, s.cols, s.rows);
                }
            });
            term.onData(d => {
                if (sessionCreated && isMountedRef.current) {
                    void window.electron.terminal.write(id, d);
                }
            });
        };

        const createBackendSession = async (cols: number, rows: number) => {
            // CLEAN-002-2: Check if still mounted before async operations
            if (!isMountedRef.current) {
                return null;
            }
            if (!(await window.electron.terminal.isAvailable())) {
                if (isMountedRef.current) {
                    term.write('\r\n\x1b[31m[ERROR] Terminal service not available.\x1b[0m\r\n');
                }
                return null;
            }
            if (!isMountedRef.current) {
                return null;
            }
            const sessionId = await window.electron.terminal.create({
                id: tab.id,
                shell: tab.type,
                ...(tab.backendId ? { backendId: tab.backendId } : {}),
                ...(projectPath ? { cwd: projectPath } : {}),
                ...(tab.metadata ? { metadata: tab.metadata } : {}),
                cols,
                rows,
            });
            if (!sessionId && isMountedRef.current) {
                term.write(`\r\n\x1b[31m[ERROR] Failed to create session\x1b[0m\r\n`);
                return null;
            }
            return sessionId;
        };

        const initSession = async () => {
            if (initializedTerminals.has(tab.id)) {
                initializingTerminals.delete(tab.id);
                return;
            }
            await new Promise(r => {
                setTimeout(r, 50);
            });
            // CLEAN-002-2: Check if still mounted after delay
            if (!isMountedRef.current) {
                initializingTerminals.delete(tab.id);
                return;
            }
            try {
                if (containerRef.current?.offsetParent) {
                    fitAddon.fit();
                }
            } catch {
                /* ignore */
            }
            const res = await createBackendSession(term.cols || 80, term.rows || 24);
            // CLEAN-002-2: Check if still mounted after async operation
            if (!isMountedRef.current) {
                initializingTerminals.delete(tab.id);
                return;
            }
            if (!res) {
                setHasError(true);
                initializingTerminals.delete(tab.id);
                return;
            }
            sessionCreated = true;
            initializedTerminals.add(tab.id);
            initializingTerminals.delete(tab.id);
            setupEvents(tab.id);
            try {
                const b = await window.electron.terminal.readBuffer(tab.id);
                // CLEAN-002-2: Check if still mounted before writing
                if (b && isMountedRef.current) {
                    term.write(b);
                }
            } catch {
                /* ignore */
            }
            // CLEAN-002-2: Only update state if still mounted
            if (isMountedRef.current) {
                setIsReady(true);
            }

            if (
                !hasBootstrappedRef.current &&
                typeof tab.bootstrapCommand === 'string' &&
                tab.bootstrapCommand.trim()
            ) {
                hasBootstrappedRef.current = true;
                window.setTimeout(() => {
                    if (isMountedRef.current) {
                        void window.electron.terminal.write(
                            tab.id,
                            `${tab.bootstrapCommand?.trim() ?? ''}\r`
                        );
                    }
                }, 120);
            }
        };

        void initSession();

        return () => {
            // CLEAN-002-2: Mark as unmounted first
            isMountedRef.current = false;
            isInitializedRef.current = false;

            // CLEAN-002-2: Clean up terminal references
            xtermRef.current = null;
            fitAddonRef.current = null;

            if (sessionCreated) {
                initializedTerminals.delete(tab.id);
                void window.electron.terminal.kill(tab.id);
            }
            initializingTerminals.delete(tab.id);
            if (webglAddon) {
                try {
                    webglAddon.dispose();
                } catch {
                    // Ignore addon disposal errors on terminal cleanup.
                }
            }
            linkProviderDisposable.dispose();
            try {
                term.dispose();
            } catch {
                /* ignore */
            }
        };
    }, [
        tab.id,
        tab.type,
        tab.backendId,
        tab.metadata,
        tab.bootstrapCommand,
        projectPath,
        containerRef,
    ]);

    return { xtermRef, fitAddonRef, isReady, hasError };
};

const TerminalSession = memo(
    ({
        tab,
        isVisible,
        className,
        onActivate,
        onClose,
        projectPath,
        onTerminalInstanceChange,
        appearance,
    }: {
        tab: TerminalTab;
        isVisible: boolean;
        className?: string;
        onActivate?: () => void;
        onClose: () => void;
        projectPath?: string;
        onTerminalInstanceChange?: (id: string, terminal: XTerm | null) => void;
        appearance: TerminalAppearancePreferences;
    }) => {
        const { t } = useTranslation();
        const { theme } = useTheme();
        const containerRef = useRef<HTMLDivElement>(null);
        const { xtermRef, fitAddonRef, isReady, hasError } = useTerminalSession(
            tab,
            containerRef,
            projectPath
        );
        const resolvedAppearance = useMemo(() => {
            void theme;
            return resolveTerminalAppearance(getTerminalTheme(), appearance);
        }, [appearance, theme]);
        useTerminalSmartSuggestions({
            xtermRef,
            tabId: tab.id,
            shell: tab.type,
            cwd: projectPath,
            enabled: isReady && isVisible,
        });

        useEffect(() => {
            if (!xtermRef.current) {
                return;
            }
            const terminal = xtermRef.current;
            terminal.options.theme = resolvedAppearance.theme;
            terminal.options.fontFamily = resolvedAppearance.fontFamily;
            terminal.options.allowTransparency = appearance.surfaceOpacity < 1;

            const xtermRoot = containerRef.current?.querySelector('.xterm') as HTMLElement | null;
            if (xtermRoot) {
                xtermRoot.style.fontFeatureSettings = appearance.ligatures
                    ? '"liga" 1, "calt" 1'
                    : '"liga" 0, "calt" 0';
                xtermRoot.style.fontVariantLigatures = appearance.ligatures ? 'normal' : 'none';
                if (resolvedAppearance.theme.background) {
                    xtermRoot.style.backgroundColor = resolvedAppearance.theme.background;
                }
            }
            const xtermViewport = containerRef.current?.querySelector(
                '.xterm-viewport'
            ) as HTMLElement | null;
            if (xtermViewport) {
                xtermViewport.style.backgroundColor =
                    resolvedAppearance.theme.background ?? 'transparent';
            }

            if (isVisible) {
                try {
                    fitAddonRef.current?.fit();
                } catch {
                    // Ignore fit failures during visibility/theme transitions.
                }
            }
            if (terminal.rows > 0) {
                terminal.refresh(0, terminal.rows - 1);
            }
        }, [appearance, fitAddonRef, isVisible, resolvedAppearance, xtermRef]);

        const safeFit = useCallback(() => {
            if (!fitAddonRef.current || !containerRef.current || !isVisible) {
                return;
            }
            try {
                if (containerRef.current.offsetParent) {
                    fitAddonRef.current.fit();
                }
            } catch {
                /* ignore */
            }
        }, [isVisible, fitAddonRef]);

        useEffect(() => {
            if (!isReady || !xtermRef.current) {
                return;
            }
            const hData = (e: Event) => {
                const d = (e as CustomEvent).detail;
                if (d?.id === tab.id && xtermRef.current) {
                    xtermRef.current.write(d.data);
                }
            };
            const hExit = (e: Event) => {
                const d = (e as CustomEvent).detail;
                if (d?.id === tab.id) {
                    if (xtermRef.current) {
                        xtermRef.current.write(
                            `\r\n\x1b[33m[Terminal exited with code ${d.code ?? 0}]\x1b[0m\r\n`
                        );
                    }
                    onClose();
                }
            };
            window.addEventListener('terminal-data-multiplex', hData);
            window.addEventListener('terminal-exit-multiplex', hExit);
            return () => {
                window.removeEventListener('terminal-data-multiplex', hData);
                window.removeEventListener('terminal-exit-multiplex', hExit);
            };
        }, [tab.id, isReady, onClose, xtermRef]);

        useEffect(() => {
            if (!isVisible) {
                return;
            }
            const timer = setTimeout(safeFit, 100);
            return () => {
                clearTimeout(timer);
            };
        }, [isVisible, safeFit]);

        useEffect(() => {
            if (!containerRef.current) {
                return;
            }
            const observer = new ResizeObserver(() => {
                if (isVisible) {
                    safeFit();
                }
            });
            observer.observe(containerRef.current);
            return () => {
                observer.disconnect();
            };
        }, [isVisible, safeFit]);

        useEffect(() => {
            onTerminalInstanceChange?.(tab.id, isReady ? xtermRef.current : null);
            return () => {
                onTerminalInstanceChange?.(tab.id, null);
            };
        }, [isReady, onTerminalInstanceChange, tab.id, xtermRef]);

        return (
            <div
                className={cn(
                    'h-full w-full bg-background relative',
                    isVisible ? 'block' : 'hidden',
                    className
                )}
                style={{ backgroundColor: resolvedAppearance.theme.background ?? undefined }}
                onMouseDown={() => {
                    onActivate?.();
                }}
            >
                {hasError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                        <div className="text-center px-4">
                            <p className="text-destructive text-sm mb-1">
                                {t('terminal.sessionFailed')}
                            </p>
                            <p className="text-muted-foreground text-xs">
                                {t('terminal.closeAndCreate')}
                            </p>
                        </div>
                    </div>
                )}
                <div
                    ref={containerRef}
                    className="h-full w-full"
                    style={{ backgroundColor: resolvedAppearance.theme.background ?? undefined }}
                />
            </div>
        );
    }
);
TerminalSession.displayName = 'TerminalSession';

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
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isGalleryView, setIsGalleryView] = useState(false);
    const [isAppearanceMenuOpen, setIsAppearanceMenuOpen] = useState(false);
    const [isSemanticPanelOpen, setIsSemanticPanelOpen] = useState(false);
    const [semanticIssuesByTab, setSemanticIssuesByTab] = useState<
        Record<string, TerminalSemanticIssue[]>
    >({});
    const [isCommandHistoryOpen, setIsCommandHistoryOpen] = useState(false);
    const [isCommandHistoryLoading, setIsCommandHistoryLoading] = useState(false);
    const [commandHistoryQuery, setCommandHistoryQuery] = useState('');
    const [commandHistoryItems, setCommandHistoryItems] = useState<TerminalHistoryEntry[]>([]);
    const [isTaskRunnerOpen, setIsTaskRunnerOpen] = useState(false);
    const [isTaskRunnerLoading, setIsTaskRunnerLoading] = useState(false);
    const [taskRunnerQuery, setTaskRunnerQuery] = useState('');
    const [taskRunnerItems, setTaskRunnerItems] = useState<TaskRunnerEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchUseRegex, setSearchUseRegex] = useState(false);
    const [searchStatus, setSearchStatus] = useState<
        'idle' | 'found' | 'not-found' | 'invalid-regex'
    >('idle');
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
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const appearanceImportInputRef = useRef<HTMLInputElement | null>(null);
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

    const writeCommandToActiveTerminal = useCallback(async (command: string) => {
        const tabId = activeTabIdRef.current;
        if (!tabId) {
            return;
        }
        await window.electron.terminal.write(tabId, `${command}\r`);
    }, []);

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

            initializedTerminals.delete(id);
            initializingTerminals.delete(id);
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

    const handleCopySelection = useCallback(async () => {
        try {
            const terminal = getActiveTerminalInstance();
            const selectedText = terminal?.hasSelection()
                ? terminal.getSelection()
                : (window.getSelection()?.toString() ?? '');
            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy terminal selection', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [getActiveTerminalInstance]);

    const handlePasteClipboard = useCallback(async () => {
        try {
            if (!activeTabIdRef.current) {
                return;
            }
            const text = await navigator.clipboard.readText();
            if (text) {
                await window.electron.terminal.write(activeTabIdRef.current, text);
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to paste into terminal', error as Error);
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
        setTerminalContextMenu(null);
    }, [availableBackends, availableShells, createTerminal, resolveDefaultBackendId]);

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
        setTerminalContextMenu(null);
    }, []);

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

    const importAppearancePreferences = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) {
                return;
            }
            try {
                const raw = await file.text();
                const parsed = JSON.parse(raw) as Partial<TerminalAppearancePreferences>;
                applyAppearancePatch(parsed);
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to import terminal appearance preset',
                    error as Error
                );
            }
        },
        [applyAppearancePatch]
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

    const openCommandHistory = useCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsGalleryView(false);
        setIsSemanticPanelOpen(false);
        setIsTaskRunnerOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsCommandHistoryOpen(true);
    }, [hasActiveSession]);

    const closeCommandHistory = useCallback(() => {
        setIsCommandHistoryOpen(false);
        setCommandHistoryQuery('');
        setIsCommandHistoryLoading(false);
    }, []);

    const executeHistoryCommand = useCallback(async (entry: TerminalHistoryEntry) => {
        if (!activeTabIdRef.current) {
            return;
        }
        try {
            await window.electron.terminal.write(activeTabIdRef.current, `${entry.command}\r`);
        } catch (error) {
            appLogger.error(
                'TerminalPanel',
                'Failed to execute command history entry',
                error as Error
            );
        }
    }, []);

    const clearCommandHistory = useCallback(async () => {
        try {
            const success = await window.electron.terminal.clearCommandHistory();
            if (success) {
                setCommandHistoryItems([]);
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to clear command history', error as Error);
        }
    }, []);

    useEffect(() => {
        if (!isCommandHistoryOpen) {
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            void (async () => {
                try {
                    setIsCommandHistoryLoading(true);
                    const entries = await window.electron.terminal.getCommandHistory(
                        commandHistoryQuery,
                        80
                    );
                    if (!cancelled) {
                        setCommandHistoryItems(entries);
                    }
                } catch (error) {
                    if (!cancelled) {
                        setCommandHistoryItems([]);
                    }
                    appLogger.error(
                        'TerminalPanel',
                        'Failed to load command history',
                        error as Error
                    );
                } finally {
                    if (!cancelled) {
                        setIsCommandHistoryLoading(false);
                    }
                }
            })();
        }, 120);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [commandHistoryQuery, isCommandHistoryOpen]);

    const openTaskRunner = useCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsGalleryView(false);
        setIsSemanticPanelOpen(false);
        setIsCommandHistoryOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsTaskRunnerOpen(true);
    }, [hasActiveSession]);

    const closeTaskRunner = useCallback(() => {
        setIsTaskRunnerOpen(false);
        setTaskRunnerQuery('');
        setTaskRunnerItems([]);
        setIsTaskRunnerLoading(false);
    }, []);

    const executeTaskRunnerEntry = useCallback(async (entry: TaskRunnerEntry) => {
        if (!activeTabIdRef.current) {
            return;
        }
        try {
            await window.electron.terminal.write(activeTabIdRef.current, `${entry.command}\r`);
            setIsTaskRunnerOpen(false);
        } catch (error) {
            appLogger.error(
                'TerminalPanel',
                'Failed to execute task runner command',
                error as Error
            );
        }
    }, []);

    useEffect(() => {
        if (!isTaskRunnerOpen) {
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            void (async () => {
                if (!projectPath) {
                    setTaskRunnerItems([]);
                    return;
                }

                try {
                    setIsTaskRunnerLoading(true);
                    const items: TaskRunnerEntry[] = [];

                    const packageJsonPath = joinProjectPath(projectPath, 'package.json');
                    if (await window.electron.files.exists(packageJsonPath)) {
                        const packageRaw = await window.electron.files.readFile(packageJsonPath);
                        const parsed = JSON.parse(packageRaw) as {
                            scripts?: Record<string, string>;
                        };
                        Object.entries(parsed.scripts ?? {}).forEach(([name, command]) => {
                            if (!name || !command) {
                                return;
                            }
                            items.push({
                                id: `npm:${name}`,
                                label: name,
                                command: `npm run ${name}`,
                                source: 'npm',
                            });
                        });
                    }

                    const makefilePath = joinProjectPath(projectPath, 'Makefile');
                    if (await window.electron.files.exists(makefilePath)) {
                        const makefileRaw = await window.electron.files.readFile(makefilePath);
                        extractMakeTargets(makefileRaw).forEach(target => {
                            items.push({
                                id: `make:${target}`,
                                label: target,
                                command: `make ${target}`,
                                source: 'make',
                            });
                        });
                    }

                    const cargoTomlPath = joinProjectPath(projectPath, 'Cargo.toml');
                    if (await window.electron.files.exists(cargoTomlPath)) {
                        const cargoDefaults = ['build', 'run', 'test', 'check', 'clippy'];
                        cargoDefaults.forEach(command => {
                            items.push({
                                id: `cargo:${command}`,
                                label: command,
                                command: `cargo ${command}`,
                                source: 'cargo',
                            });
                        });
                    }

                    const normalizedQuery = taskRunnerQuery.trim().toLowerCase();
                    const filtered = normalizedQuery
                        ? items.filter(
                              item =>
                                  item.label.toLowerCase().includes(normalizedQuery) ||
                                  item.command.toLowerCase().includes(normalizedQuery) ||
                                  item.source.toLowerCase().includes(normalizedQuery)
                          )
                        : items;

                    if (!cancelled) {
                        setTaskRunnerItems(filtered);
                    }
                } catch (error) {
                    if (!cancelled) {
                        setTaskRunnerItems([]);
                    }
                    appLogger.error(
                        'TerminalPanel',
                        'Failed to load task runner entries',
                        error as Error
                    );
                } finally {
                    if (!cancelled) {
                        setIsTaskRunnerLoading(false);
                    }
                }
            })();
        }, 120);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [isTaskRunnerOpen, projectPath, taskRunnerQuery]);

    const resetActiveSearchCursor = useCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        delete searchCursorRef.current[activeTabIdRef.current];
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

    const runTerminalSearch = useCallback(
        (direction: 'next' | 'prev') => {
            const terminal = getActiveTerminalInstance();
            const activeId = activeTabIdRef.current;
            const rawQuery = searchQuery.trim();

            if (!terminal || !activeId || !rawQuery) {
                setSearchStatus('idle');
                return false;
            }
            pushSearchHistory(rawQuery);

            const buffer = terminal.buffer.active;
            const lineCount = buffer.length;
            if (lineCount === 0) {
                setSearchStatus('not-found');
                return false;
            }

            let regex: RegExp | null = null;
            if (searchUseRegex) {
                try {
                    regex = new RegExp(rawQuery, 'i');
                } catch {
                    setSearchStatus('invalid-regex');
                    return false;
                }
            }
            const query = rawQuery.toLowerCase();

            const currentCursor = searchCursorRef.current[activeId];
            const initialRow =
                currentCursor?.row ?? Math.max(0, Math.min(buffer.viewportY, lineCount - 1));

            for (let offset = 0; offset < lineCount; offset += 1) {
                const row =
                    direction === 'next'
                        ? (initialRow + offset) % lineCount
                        : (initialRow - offset + lineCount) % lineCount;
                const lineText = buffer.getLine(row)?.translateToString(true) ?? '';
                if (!lineText) {
                    continue;
                }

                const searchFrom =
                    direction === 'next'
                        ? offset === 0 && currentCursor?.row === row
                            ? currentCursor.col + 1
                            : 0
                        : offset === 0 && currentCursor?.row === row
                          ? currentCursor.col - 1
                          : lineText.length - 1;

                if (regex) {
                    if (direction === 'next') {
                        const start = Math.max(0, searchFrom);
                        const segment = lineText.slice(start);
                        const match = regex.exec(segment);
                        if (!match) {
                            continue;
                        }
                        const matchText = match[0] ?? '';
                        const length = Math.max(matchText.length, 1);
                        const index = start + match.index;

                        terminal.select(index, row, length);
                        terminal.scrollToLine(Math.max(0, row - Math.floor(terminal.rows / 2)));
                        searchCursorRef.current[activeId] = { row, col: index };
                        setSearchStatus('found');
                        return true;
                    }

                    if (searchFrom < 0) {
                        continue;
                    }

                    const segment = lineText.slice(0, Math.min(lineText.length, searchFrom + 1));
                    const regexGlobal = new RegExp(
                        regex.source,
                        regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
                    );

                    let candidateIndex = -1;
                    let candidateLength = 0;
                    for (
                        let match = regexGlobal.exec(segment);
                        match;
                        match = regexGlobal.exec(segment)
                    ) {
                        const matchText = match[0] ?? '';
                        candidateIndex = match.index;
                        candidateLength = Math.max(matchText.length, 1);
                        if (regexGlobal.lastIndex === match.index) {
                            regexGlobal.lastIndex += 1;
                        }
                    }

                    if (candidateIndex < 0) {
                        continue;
                    }

                    terminal.select(candidateIndex, row, candidateLength);
                    terminal.scrollToLine(Math.max(0, row - Math.floor(terminal.rows / 2)));
                    searchCursorRef.current[activeId] = { row, col: candidateIndex };
                    setSearchStatus('found');
                    return true;
                }

                const normalizedLine = lineText.toLowerCase();
                if (direction === 'next') {
                    const index = normalizedLine.indexOf(query, Math.max(0, searchFrom));
                    if (index < 0) {
                        continue;
                    }
                    terminal.select(index, row, query.length);
                    terminal.scrollToLine(Math.max(0, row - Math.floor(terminal.rows / 2)));
                    searchCursorRef.current[activeId] = { row, col: index };
                    setSearchStatus('found');
                    return true;
                }

                if (searchFrom < 0) {
                    continue;
                }
                const index = normalizedLine.lastIndexOf(
                    query,
                    Math.min(lineText.length - 1, searchFrom)
                );
                if (index < 0) {
                    continue;
                }
                terminal.select(index, row, query.length);
                terminal.scrollToLine(Math.max(0, row - Math.floor(terminal.rows / 2)));
                searchCursorRef.current[activeId] = { row, col: index };
                setSearchStatus('found');
                return true;
            }

            setSearchStatus('not-found');
            return false;
        },
        [getActiveTerminalInstance, pushSearchHistory, searchQuery, searchUseRegex]
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
                await window.electron.terminal.write(activeTabId, command + '\r');
                setIsAiPanelOpen(false);
                setAiResult(null);
            } catch (err) {
                appLogger.error('TerminalPanel', 'Failed to apply fix command', err as Error);
            }
        },
        [activeTabId]
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
        setSearchHistoryIndex(-1);
        resetActiveSearchCursor();
    }, [hasActiveSession, resetActiveSearchCursor]);

    const closeTerminalSearch = useCallback(() => {
        setIsSearchOpen(false);
        setSearchStatus('idle');
        setSearchHistoryIndex(-1);
        const terminal = getActiveTerminalInstance();
        terminal?.clearSelection();
        resetActiveSearchCursor();
    }, [getActiveTerminalInstance, resetActiveSearchCursor]);

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
        setSearchStatus('idle');
        resetActiveSearchCursor();
    }, [activeTabId, resetActiveSearchCursor]);

    useEffect(() => {
        setSearchStatus('idle');
        resetActiveSearchCursor();
    }, [resetActiveSearchCursor, searchUseRegex]);

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
    const themeCategoryLabel = (preset: TerminalAppearancePreset) =>
        preset.category === 'community' ? t('terminal.communityTheme') : t('terminal.defaultTheme');
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
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/70">
                <div className="flex-1 flex items-center gap-1 overflow-x-auto custom-scrollbar no-thumb min-w-0 mr-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            draggable
                            onClick={() => {
                                handleTabSelect(tab.id);
                            }}
                            onDragStart={event => {
                                handleTabDragStart(event, tab.id);
                            }}
                            onDragOver={event => {
                                handleTabDragOver(event, tab.id);
                            }}
                            onDrop={event => {
                                handleTabDrop(event, tab.id);
                            }}
                            onDragEnd={resetTabDragState}
                            className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap border border-transparent min-w-[100px] max-w-[200px] flex-shrink-0',
                                activeTabId === tab.id
                                    ? 'bg-accent text-foreground border-border shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                                draggingTabId === tab.id && 'opacity-60',
                                dragOverTabId === tab.id &&
                                    draggingTabId !== tab.id &&
                                    'border-primary/70'
                            )}
                        >
                            <TerminalSquare
                                className={cn(
                                    'w-3.5 h-3.5 flex-shrink-0',
                                    activeTabId === tab.id ? 'text-primary' : 'opacity-70'
                                )}
                            />
                            <span className="truncate flex-1 text-left">{tab.name}</span>
                            <div
                                onClick={e => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                            >
                                <X className="w-3 h-3" />
                            </div>
                        </button>
                    ))}
                </div>
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
                        {splitView && (
                            <>
                                <button
                                    onClick={toggleSplitOrientation}
                                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                    title={t('terminal.toggleSplitOrientation')}
                                >
                                    {splitView.orientation === 'vertical' ? (
                                        <Rows2 className="w-3.5 h-3.5" />
                                    ) : (
                                        <Columns2 className="w-3.5 h-3.5" />
                                    )}
                                </button>
                                <button
                                    onClick={closeSplitView}
                                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                    title={t('terminal.closeSplit')}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
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
                        <TerminalSession
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
                                        <TerminalSession
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
                                            onTerminalInstanceChange={setTerminalInstance}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {tabs.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <Terminal className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">{t('terminal.noActiveSessions')}</p>
                        <button
                            onClick={() => {
                                void createDefaultTerminal();
                            }}
                            className="mt-4 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-bold transition-all border border-primary/30"
                        >
                            {t('terminal.startNewSession')}
                        </button>
                    </div>
                )}
            </div>
            {terminalContextMenu &&
                createPortal(
                    <div
                        className="fixed min-w-[200px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-2xl py-1 z-[99999]"
                        style={{ left: terminalContextMenu.x, top: terminalContextMenu.y }}
                        onMouseDown={event => event.stopPropagation()}
                        onContextMenu={event => event.preventDefault()}
                    >
                        <button
                            onClick={() => {
                                void handleCopySelection();
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground"
                        >
                            {t('common.copy')}
                        </button>
                        <button
                            onClick={() => {
                                void handlePasteClipboard();
                            }}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('terminal.paste')}
                        </button>
                        <button
                            onClick={handleSelectAll}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('common.selectAll')}
                        </button>
                        <button
                            onClick={openTerminalSearch}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('common.search')}
                        </button>
                        <button
                            onClick={toggleSemanticPanel}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                        >
                            <span>{t('terminal.semanticIssues')}</span>
                            {activeSemanticIssues.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                    {activeSemanticErrorCount}/{activeSemanticWarningCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={toggleGalleryView}
                            disabled={tabs.length <= 1}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isGalleryView
                                ? t('terminal.exitGalleryView')
                                : t('terminal.galleryView')}
                        </button>
                        {onFloatingChange && (
                            <button
                                onClick={() => {
                                    toggleFloatingMode();
                                    setTerminalContextMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground"
                            >
                                {isFloating
                                    ? t('terminal.dockTerminal')
                                    : t('terminal.floatTerminal')}
                            </button>
                        )}
                        <button
                            onClick={openCommandHistory}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('terminal.commandHistory')}
                        </button>
                        <button
                            onClick={openMultiplexerPanel}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Multiplexer (tmux/screen)
                        </button>
                        <button
                            onClick={() => {
                                toggleRecording();
                                setTerminalContextMenu(null);
                            }}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {activeRecordingTabId ? 'Stop Recording' : 'Start Recording'}
                        </button>
                        <button
                            onClick={() => {
                                setTerminalContextMenu(null);
                                setIsSearchOpen(false);
                                setIsGalleryView(false);
                                setIsSemanticPanelOpen(false);
                                setIsCommandHistoryOpen(false);
                                setIsTaskRunnerOpen(false);
                                setIsMultiplexerOpen(false);
                                setIsRecordingPanelOpen(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground"
                        >
                            Session Recordings
                        </button>
                        <button
                            onClick={openTaskRunner}
                            disabled={!hasActiveSession || !projectPath}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('terminal.runTask')}
                        </button>
                        <button
                            onClick={handleClearOutput}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('terminal.clearOutput')}
                        </button>
                        <button
                            onClick={handleSplitTerminal}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('terminal.split')}
                        </button>
                        <button
                            onClick={() => {
                                void handleDetachTerminal();
                            }}
                            disabled={!hasActiveSession}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('terminal.detach')}
                        </button>
                        {splitView && (
                            <>
                                <button
                                    onClick={toggleSplitOrientation}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground"
                                >
                                    {t('terminal.toggleSplitOrientation')}
                                </button>
                                <button
                                    onClick={closeSplitView}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground"
                                >
                                    {t('terminal.closeSplit')}
                                </button>
                            </>
                        )}
                        <div className="h-px bg-border/60 my-1 mx-2" />
                        <button
                            onClick={() => {
                                void createDefaultTerminal();
                                setTerminalContextMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground"
                        >
                            {t('terminal.new')}
                        </button>
                        <button
                            onClick={hideTerminalPanel}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors text-foreground"
                        >
                            {t('terminal.hide')}
                        </button>
                    </div>,
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
                <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-[420px] max-w-[95vw]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-xs font-semibold text-foreground">
                            Multiplexer (tmux/screen)
                        </div>
                        <button
                            onClick={closeMultiplexerPanel}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                        <button
                            onClick={() => {
                                setMultiplexerMode('tmux');
                                void refreshMultiplexerSessions('tmux');
                            }}
                            className={cn(
                                'h-7 px-2 rounded text-xs border transition-colors',
                                multiplexerMode === 'tmux'
                                    ? 'border-primary/60 bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'
                            )}
                        >
                            tmux
                        </button>
                        <button
                            onClick={() => {
                                setMultiplexerMode('screen');
                                void refreshMultiplexerSessions('screen');
                            }}
                            className={cn(
                                'h-7 px-2 rounded text-xs border transition-colors',
                                multiplexerMode === 'screen'
                                    ? 'border-primary/60 bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'
                            )}
                        >
                            screen
                        </button>
                        <button
                            onClick={() => {
                                void refreshMultiplexerSessions();
                            }}
                            className="h-7 px-2 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                        >
                            Refresh
                        </button>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                        <input
                            value={multiplexerSessionName}
                            onChange={event => {
                                setMultiplexerSessionName(event.target.value);
                            }}
                            placeholder="session name"
                            className="h-7 flex-1 px-2 rounded border border-border bg-background/60 text-xs outline-none"
                        />
                        <button
                            onClick={() => {
                                void createMultiplexerSession();
                            }}
                            disabled={!hasActiveSession}
                            className="h-7 px-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Create/Attach
                        </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                        {isMultiplexerLoading && (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        )}
                        {!isMultiplexerLoading && multiplexerError && (
                            <div className="px-2 py-2 text-xs text-destructive whitespace-pre-wrap">
                                {multiplexerError}
                            </div>
                        )}
                        {!isMultiplexerLoading &&
                            !multiplexerError &&
                            multiplexerSessions.length === 0 && (
                                <div className="px-2 py-2 text-xs text-muted-foreground">
                                    No active sessions found.
                                </div>
                            )}
                        {!isMultiplexerLoading &&
                            !multiplexerError &&
                            multiplexerSessions.map(session => (
                                <button
                                    key={`${multiplexerMode}:${session.id}`}
                                    onClick={() => {
                                        void attachMultiplexerSession(session);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/40 transition-colors border border-transparent hover:border-border/70"
                                >
                                    <div className="text-xs text-foreground truncate">
                                        {session.label}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                        {session.details ?? session.id}
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            )}
            {isRecordingPanelOpen && (
                <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-[460px] max-w-[95vw]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-xs font-semibold text-foreground">
                            Session Recordings
                        </div>
                        <button
                            onClick={() => {
                                setIsRecordingPanelOpen(false);
                                stopReplay();
                            }}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                        <button
                            onClick={toggleRecording}
                            disabled={!hasActiveSession && !activeRecordingTabId}
                            className={cn(
                                'h-7 px-2 rounded text-xs border transition-colors',
                                activeRecordingTabId
                                    ? 'border-destructive/50 bg-destructive/10 text-destructive'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'
                            )}
                        >
                            {activeRecordingTabId ? 'Stop Recording' : 'Start Recording'}
                        </button>
                        <button
                            onClick={() => {
                                if (selectedRecording) {
                                    startReplay(selectedRecording);
                                }
                            }}
                            disabled={!selectedRecording || isReplayRunning}
                            className="h-7 px-2 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <Play className="w-3 h-3" />
                            Replay
                        </button>
                        <button
                            onClick={stopReplay}
                            disabled={!isReplayRunning}
                            className="h-7 px-2 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <Square className="w-3 h-3" />
                            Stop
                        </button>
                        <button
                            onClick={() => {
                                if (selectedRecording) {
                                    exportRecording(selectedRecording);
                                }
                            }}
                            disabled={!selectedRecording}
                            className="h-7 px-2 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <Download className="w-3 h-3" />
                            Export
                        </button>
                    </div>
                    {activeRecordingTabId && (
                        <div className="mb-2 px-2 py-1 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive">
                            Recording active:{' '}
                            {tabs.find(tab => tab.id === activeRecordingTabId)?.name ??
                                activeRecordingTabId}
                        </div>
                    )}
                    <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1 mb-2">
                        {recordings.length === 0 && (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                No recordings yet.
                            </div>
                        )}
                        {recordings.map(recording => (
                            <button
                                key={recording.id}
                                onClick={() => {
                                    setSelectedRecordingId(recording.id);
                                    setReplayText('');
                                    stopReplay();
                                }}
                                className={cn(
                                    'w-full text-left px-2 py-1.5 rounded border transition-colors',
                                    selectedRecordingId === recording.id
                                        ? 'border-primary/60 bg-primary/10'
                                        : 'border-border/60 hover:bg-accent/40'
                                )}
                            >
                                <div className="text-xs text-foreground truncate">
                                    {recording.tabName}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                    {new Date(recording.startedAt).toLocaleString()} -{' '}
                                    {(recording.durationMs / 1000).toFixed(1)}s -{' '}
                                    {recording.events.length} events
                                </div>
                            </button>
                        ))}
                    </div>
                    {selectedRecording && (
                        <div className="rounded border border-border/60 bg-background/70">
                            <div className="px-2 py-1 border-b border-border/60 text-[10px] text-muted-foreground">
                                Replay Preview
                            </div>
                            <pre className="p-2 text-[11px] leading-4 text-foreground max-h-44 overflow-auto whitespace-pre-wrap break-words">
                                {isReplayRunning || replayText ? replayText : selectedRecordingText}
                            </pre>
                        </div>
                    )}
                </div>
            )}
            {isSearchOpen && (
                <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-1 min-w-[300px]">
                    <div className="flex items-center gap-1">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={event => {
                                setSearchQuery(event.target.value);
                                setSearchStatus('idle');
                                setSearchHistoryIndex(-1);
                                resetActiveSearchCursor();
                            }}
                            onKeyDown={event => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    runTerminalSearch(event.shiftKey ? 'prev' : 'next');
                                } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    closeTerminalSearch();
                                } else if (event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    stepSearchHistory('older');
                                } else if (event.key === 'ArrowDown') {
                                    event.preventDefault();
                                    stepSearchHistory('newer');
                                }
                            }}
                            placeholder={t('common.search')}
                            className="h-6 w-44 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
                        />
                        <button
                            onClick={() => {
                                setSearchUseRegex(prev => !prev);
                                setSearchStatus('idle');
                            }}
                            className={cn(
                                'h-6 px-1.5 text-[10px] rounded border transition-colors',
                                searchUseRegex
                                    ? 'border-primary/70 text-primary bg-primary/10'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'
                            )}
                            aria-label={t('terminal.searchRegex')}
                            title={t('terminal.searchRegex')}
                        >
                            .*
                        </button>
                        <button
                            onClick={() => {
                                runTerminalSearch('prev');
                            }}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Find previous"
                        >
                            <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => {
                                runTerminalSearch('next');
                            }}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Find next"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={closeTerminalSearch}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <span
                            className={cn(
                                'text-[10px]',
                                searchStatus === 'invalid-regex' || searchStatus === 'not-found'
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                            )}
                        >
                            {searchStatus === 'invalid-regex'
                                ? t('terminal.invalidRegex')
                                : searchStatus === 'not-found'
                                  ? '0/0'
                                  : ''}
                        </span>
                        {searchHistory.length > 0 && (
                            <div className="flex items-center gap-1 max-w-[180px] overflow-hidden">
                                {searchHistory.slice(0, 3).map(entry => (
                                    <button
                                        key={entry}
                                        onClick={() => {
                                            setSearchQuery(entry);
                                            setSearchStatus('idle');
                                            setSearchHistoryIndex(-1);
                                            resetActiveSearchCursor();
                                        }}
                                        className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/40 truncate max-w-[56px]"
                                        title={entry}
                                    >
                                        {entry}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {isCommandHistoryOpen && (
                <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-[420px] max-w-[95vw]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <History className="w-3.5 h-3.5 text-muted-foreground" />
                            {t('terminal.commandHistory')}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    void clearCommandHistory();
                                }}
                                className="h-6 px-2 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                            >
                                {t('terminal.clearHistory')}
                            </button>
                            <button
                                onClick={closeCommandHistory}
                                className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label={t('common.close')}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                    <input
                        value={commandHistoryQuery}
                        onChange={event => {
                            setCommandHistoryQuery(event.target.value);
                        }}
                        placeholder={t('terminal.historySearchPlaceholder')}
                        className="w-full h-7 px-2 rounded border border-border bg-background/60 text-xs outline-none mb-2"
                    />
                    <div className="max-h-56 overflow-y-auto custom-scrollbar">
                        {isCommandHistoryLoading && (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        )}
                        {!isCommandHistoryLoading && commandHistoryItems.length === 0 && (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                {t('terminal.noHistory')}
                            </div>
                        )}
                        {!isCommandHistoryLoading &&
                            commandHistoryItems.map(entry => (
                                <button
                                    key={`${entry.timestamp}-${entry.command}`}
                                    onClick={() => {
                                        void executeHistoryCommand(entry);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/40 transition-colors"
                                    title={entry.command}
                                >
                                    <div className="text-xs text-foreground truncate">
                                        {entry.command}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                        {new Date(entry.timestamp).toLocaleString()}
                                        {entry.cwd ? ` - ${entry.cwd}` : ''}
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            )}
            {isTaskRunnerOpen && (
                <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-[420px] max-w-[95vw]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <TerminalSquare className="w-3.5 h-3.5 text-muted-foreground" />
                            {t('terminal.taskRunner')}
                        </div>
                        <button
                            onClick={closeTaskRunner}
                            className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <input
                        value={taskRunnerQuery}
                        onChange={event => {
                            setTaskRunnerQuery(event.target.value);
                        }}
                        placeholder={t('terminal.tasksSearchPlaceholder')}
                        className="w-full h-7 px-2 rounded border border-border bg-background/60 text-xs outline-none mb-2"
                    />
                    <div className="max-h-56 overflow-y-auto custom-scrollbar">
                        {isTaskRunnerLoading && (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        )}
                        {!isTaskRunnerLoading && taskRunnerItems.length === 0 && (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                {t('terminal.noTasksFound')}
                            </div>
                        )}
                        {!isTaskRunnerLoading &&
                            taskRunnerItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        void executeTaskRunnerEntry(item);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/40 transition-colors"
                                    title={item.command}
                                >
                                    <div className="text-xs text-foreground truncate">
                                        {item.command}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                        {item.source} - {item.label}
                                    </div>
                                </button>
                            ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
