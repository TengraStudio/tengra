import { useTranslation } from '@renderer/i18n';
import { Minimize2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { useTheme } from '@/hooks/useTheme';
import { invokeTypedIpc } from '@/lib/ipc-client';
import { getTerminalTheme } from '@/lib/terminal-theme';

import {
    TerminalIpcContract,
    terminalKillResponseSchema,
    terminalReadBufferResponseSchema,
    terminalResizeResponseSchema,
    terminalWriteResponseSchema
} from '../utils/terminal-ipc';

import 'xterm/css/xterm.css';

export function DetachedTerminalWindow() {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const sessionId = params.get('sessionId')?.trim() ?? '';
    const title = params.get('title')?.trim() || t('terminal.title');
    const shell = params.get('shell')?.trim() ?? '';
    const cwd = params.get('cwd')?.trim() ?? '';

    const containerRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const isExitedRef = useRef(false);
    const [isExited, setIsExited] = useState(false);

    const safeFit = useCallback(() => {
        const fitAddon = fitAddonRef.current;
        const container = containerRef.current;
        if (!fitAddon || !container?.offsetParent) {
            return;
        }
        try {
            fitAddon.fit();
        } catch {
            // Ignore fit errors caused by transient layout states.
        }
    }, []);

    useEffect(() => {
        if (!sessionId || !containerRef.current) {
            return;
        }

        const term = new XTerm({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            theme: getTerminalTheme(),
            allowProposedApi: true,
            scrollback: 10000,
            cols: 80,
            rows: 24
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;

        safeFit();

        const onResize = () => {
            safeFit();
        };
        window.addEventListener('resize', onResize);

        const resizeObserver = new ResizeObserver(() => {
            safeFit();
        });
        resizeObserver.observe(containerRef.current);

        term.onData((data) => {
            if (!isExitedRef.current) {
                void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [sessionId, data], { responseSchema: terminalWriteResponseSchema });
            }
        });
        term.onResize((size) => {
            if (!isExitedRef.current) {
                void invokeTypedIpc<TerminalIpcContract, 'terminal:resize'>('terminal:resize', [sessionId, size.cols, size.rows], { responseSchema: terminalResizeResponseSchema });
            }
        });

        const unlistenData = window.electron.terminal.onData((payload) => {
            if (payload.id === sessionId) {
                term.write(payload.data);
            }
        });
        const unlistenExit = window.electron.terminal.onExit((payload) => {
            if (payload.id === sessionId) {
                isExitedRef.current = true;
                setIsExited(true);
                term.write(`\r\n\x1b[33m[Terminal exited with code ${payload.code ?? 0}]\x1b[0m\r\n`);
            }
        });

        void invokeTypedIpc<TerminalIpcContract, 'terminal:readBuffer'>('terminal:readBuffer', [sessionId], { responseSchema: terminalReadBufferResponseSchema }).then((buffer) => {
            if (buffer && terminalRef.current) {
                terminalRef.current.write(buffer);
            }
        });

        return () => {
            window.removeEventListener('resize', onResize);
            resizeObserver.disconnect();
            unlistenData();
            unlistenExit();
            try {
                term.dispose();
            } catch {
                // Ignore dispose errors.
            }
            terminalRef.current = null;
            fitAddonRef.current = null;
            isExitedRef.current = false;
        };
    }, [safeFit, sessionId]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.options.theme = getTerminalTheme();
        }
    }, [theme]);

    useEffect(() => {
        if (!sessionId) {
            return;
        }
        const handleBeforeUnload = () => {
            void invokeTypedIpc<TerminalIpcContract, 'terminal:kill'>('terminal:kill', [sessionId], { responseSchema: terminalKillResponseSchema });
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [sessionId]);

    if (!sessionId) {
        return (
            <div className="h-screen w-screen bg-background text-foreground flex items-center justify-center">
                <p className="text-sm text-destructive">{t('terminal.sessionFailed')}</p>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
            <div className="h-10 border-b border-border flex items-center justify-between px-3 bg-card/70">
                <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                        {[shell, cwd].filter(Boolean).join(' - ')}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { window.electron.minimize(); }}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={t('titleBar.minimize')}
                    >
                        <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => { window.electron.close(); }}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={t('titleBar.close')}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <div className="flex-1 min-h-0 relative">
                <div ref={containerRef} className="h-full w-full" />
                {isExited && (
                    <div className="absolute inset-x-0 bottom-0 bg-background/80 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                        {t('terminal.detachedExited')}
                    </div>
                )}
            </div>
        </div>
    );
}
