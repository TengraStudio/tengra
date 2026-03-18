import { useTranslation } from '@renderer/i18n';
import { FitAddon } from '@xterm/addon-fit';
import { type ITheme,Terminal as XTerm } from '@xterm/xterm';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useTerminalSmartSuggestions } from '@/features/terminal/hooks/useTerminalSmartSuggestions';
import { invokeTypedIpc } from '@/lib/ipc-client';
import { cn } from '@/lib/utils';
import type { TerminalTab } from '@/types';
import { performanceMonitor } from '@/utils/performance';
import { appLogger } from '@/utils/renderer-logger';

import type {
    ResolvedTerminalAppearance,
    TerminalAppearancePreferences,
} from '../types/terminal-appearance';
import {
    clearTerminalSessionFlags,
    isTerminalSessionInitialized,
    isTerminalSessionInitializing,
    markTerminalSessionInitialized,
    markTerminalSessionInitializing,
} from '../utils/session-registry';
import {
    terminalCreateResponseSchema,
    TerminalIpcContract,
    terminalKillResponseSchema,
    terminalReadBufferResponseSchema,
    terminalResizeResponseSchema,
    terminalWriteResponseSchema
} from '../utils/terminal-ipc';

type DetectedTerminalLink = {
    text: string;
    target: string;
    start: number;
    end: number;
    type: 'url' | 'path';
};

const URL_LINK_REGEX = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const WINDOWS_PATH_LINK_REGEX = /\b[A-Za-z]:[\\/][^\s"'`<>|]+/g;
const UNIX_PATH_LINK_REGEX = /(?:^|[\s([{'"`])(\/[^\s"'`<>()`]+)/g;
const TRAILING_LINK_CHARACTERS_REGEX = /[.,;:!?)}\]'"]+$/;

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

function useTerminalSession(
    tab: TerminalTab,
    containerRef: React.RefObject<HTMLDivElement>,
    workspacePath: string | undefined,
    initialTheme: ITheme
) {
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isInitializedRef = useRef(false);
    const isMountedRef = useRef(true);
    const hasBootstrappedRef = useRef(false);

    const waitForAnimationFrame = useCallback(
        () =>
            new Promise<void>(resolve => {
                window.requestAnimationFrame(() => {
                    resolve();
                });
            }),
        []
    );

    useEffect(() => {
        isMountedRef.current = true;

        if (
            isTerminalSessionInitialized(tab.id) ||
            isTerminalSessionInitializing(tab.id) ||
            !containerRef.current ||
            isInitializedRef.current
        ) {
            return;
        }
        isInitializedRef.current = true;
        markTerminalSessionInitializing(tab.id);

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            theme: initialTheme,
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
                        'TerminalInstance',
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
                    'TerminalInstance',
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
                                    'TerminalInstance',
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
                    void invokeTypedIpc<TerminalIpcContract, 'terminal:resize'>('terminal:resize', [id, s.cols, s.rows], { responseSchema: terminalResizeResponseSchema });
                }
            });
            term.onData(d => {
                if (sessionCreated && isMountedRef.current) {
                    void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [id, d], { responseSchema: terminalWriteResponseSchema });
                }
            });
        };

        const createBackendSession = async (cols: number, rows: number) => {
            if (!isMountedRef.current) {
                return null;
            }
            const sessionId = await invokeTypedIpc<TerminalIpcContract, 'terminal:create'>('terminal:create', [{
                id: tab.id,
                shell: tab.type,
                ...(tab.backendId ? { backendId: tab.backendId } : {}),
                ...(workspacePath ? { cwd: workspacePath } : {}),
                ...(tab.metadata ? { metadata: tab.metadata } : {}),
                cols,
                rows,
            }], { responseSchema: terminalCreateResponseSchema });
            if (!sessionId && isMountedRef.current) {
                term.write(`\r\n\x1b[31m[ERROR] Failed to create session\x1b[0m\r\n`);
                return null;
            }
            return sessionId;
        };

        const initSession = async () => {
            if (isTerminalSessionInitialized(tab.id)) {
                return;
            }
            await waitForAnimationFrame();
            if (!isMountedRef.current) {
                clearTerminalSessionFlags(tab.id);
                return;
            }
            try {
                if (containerRef.current?.offsetParent) {
                    fitAddon.fit();
                }
            } catch {
                // Ignore fit failure on init.
            }
            const result = await createBackendSession(term.cols || 80, term.rows || 24);
            if (!isMountedRef.current) {
                clearTerminalSessionFlags(tab.id);
                return;
            }
            if (!result) {
                setHasError(true);
                clearTerminalSessionFlags(tab.id);
                return;
            }
            sessionCreated = true;
            markTerminalSessionInitialized(tab.id);
            setupEvents(tab.id);
            try {
                const buffer = await invokeTypedIpc<TerminalIpcContract, 'terminal:readBuffer'>('terminal:readBuffer', [tab.id], { responseSchema: terminalReadBufferResponseSchema });
                if (buffer && isMountedRef.current) {
                    term.write(buffer);
                }
            } catch {
                // Ignore readBuffer failure.
            }
            if (isMountedRef.current) {
                setIsReady(true);
                if (workspacePath) {
                    performanceMonitor.mark('workspace:terminal:ready');
                }
            }

            if (
                !hasBootstrappedRef.current &&
                typeof tab.bootstrapCommand === 'string' &&
                tab.bootstrapCommand.trim()
            ) {
                hasBootstrappedRef.current = true;
                window.requestAnimationFrame(() => {
                    if (isMountedRef.current) {
                        void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [
                            tab.id,
                            `${tab.bootstrapCommand?.trim() ?? ''}\r`
                        ], { responseSchema: terminalWriteResponseSchema });
                    }
                });
            }
        };

        void initSession();

        return () => {
            isMountedRef.current = false;
            isInitializedRef.current = false;
            xtermRef.current = null;
            fitAddonRef.current = null;

            if (sessionCreated) {
                clearTerminalSessionFlags(tab.id);
                void invokeTypedIpc<TerminalIpcContract, 'terminal:kill'>('terminal:kill', [tab.id], { responseSchema: terminalKillResponseSchema });
            } else {
                clearTerminalSessionFlags(tab.id);
            }
            if (webglAddon) {
                try {
                    webglAddon.dispose();
                } catch {
                    // Ignore addon disposal errors.
                }
            }
            linkProviderDisposable.dispose();
            try {
                term.dispose();
            } catch {
                // Ignore terminal disposal errors.
            }
        };
    }, [
        containerRef,
        initialTheme,
        workspacePath,
        tab.backendId,
        tab.bootstrapCommand,
        tab.id,
        tab.metadata,
        tab.type,
        waitForAnimationFrame,
    ]);

    return { xtermRef, fitAddonRef, isReady, hasError };
}

type TerminalInstanceProps = {
    tab: TerminalTab;
    isVisible: boolean;
    className?: string;
    onActivate?: () => void;
    onClose: () => void;
    workspacePath?: string;
    onTerminalInstanceChange?: (id: string, terminal: XTerm | null) => void;
    appearance: TerminalAppearancePreferences;
    resolvedAppearance: ResolvedTerminalAppearance;
};

export const TerminalInstance = memo(({
    tab,
    isVisible,
    className,
    onActivate,
    onClose,
    workspacePath,
    onTerminalInstanceChange,
    appearance,
    resolvedAppearance,
}: TerminalInstanceProps) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const { xtermRef, fitAddonRef, isReady, hasError } = useTerminalSession(
        tab,
        containerRef,
        workspacePath,
        resolvedAppearance.theme
    );

    useTerminalSmartSuggestions({
        xtermRef,
        tabId: tab.id,
        shell: tab.type,
        cwd: workspacePath,
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
        terminal.options.cursorStyle = resolvedAppearance.cursorStyle;
        terminal.options.cursorBlink = resolvedAppearance.cursorBlink;
        terminal.options.fontSize = resolvedAppearance.fontSize;
        terminal.options.lineHeight = resolvedAppearance.lineHeight;

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
        const xtermViewport = containerRef.current?.querySelector('.xterm-viewport') as
            | HTMLElement
            | null;
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
            // Ignore fit failure.
        }
    }, [fitAddonRef, isVisible]);

    useEffect(() => {
        if (!isReady || !xtermRef.current) {
            return;
        }
        const handleData = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (detail?.id === tab.id && xtermRef.current) {
                xtermRef.current.write(detail.data);
            }
        };
        const handleExit = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (detail?.id === tab.id) {
                if (xtermRef.current) {
                    xtermRef.current.write(
                        `\r\n\x1b[33m[Terminal exited with code ${detail.code ?? 0}]\x1b[0m\r\n`
                    );
                }
                onClose();
            }
        };
        window.addEventListener('terminal-data-multiplex', handleData);
        window.addEventListener('terminal-exit-multiplex', handleExit);
        return () => {
            window.removeEventListener('terminal-data-multiplex', handleData);
            window.removeEventListener('terminal-exit-multiplex', handleExit);
        };
    }, [isReady, onClose, tab.id, xtermRef]);

    useEffect(() => {
        if (!isVisible) {
            return;
        }
        const frameId = window.requestAnimationFrame(() => {
            safeFit();
        });
        return () => {
            window.cancelAnimationFrame(frameId);
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
            className={cn('h-full w-full bg-background relative', isVisible ? 'block' : 'hidden', className)}
            style={{ backgroundColor: resolvedAppearance.theme.background ?? undefined }}
            onMouseDown={() => {
                onActivate?.();
            }}
        >
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <div className="text-center px-4">
                        <p className="text-destructive text-sm mb-1">{t('terminal.sessionFailed')}</p>
                        <p className="text-muted-foreground text-xs">{t('terminal.closeAndCreate')}</p>
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
});

TerminalInstance.displayName = 'TerminalInstance';
