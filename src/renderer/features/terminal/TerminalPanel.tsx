import { useTranslation } from '@renderer/i18n';
import { ChevronDown, Maximize2, Minimize2, Plus, Terminal, TerminalSquare, X } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { appLogger } from '@main/logging/logger';
import { useTheme } from '@/hooks/useTheme';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

import 'xterm/css/xterm.css';

const initializedTerminals = new Set<string>();
const initializingTerminals = new Set<string>();

interface TerminalPanelProps { isOpen: boolean; onToggle: () => void; height: number; onHeightChange: (height: number) => void; projectPath?: string; tabs: TerminalTab[]; activeTabId: string | null; setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void; setActiveTabId: (id: string | null) => void; }

const useTerminalSession = (tab: TerminalTab, containerRef: React.RefObject<HTMLDivElement>, projectPath: string | undefined) => {
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isInitializedRef = useRef(false);

    useEffect(() => {
        if (initializedTerminals.has(tab.id) || initializingTerminals.has(tab.id) || !containerRef.current || isInitializedRef.current) {
            return;
        }
        isInitializedRef.current = true;
        initializingTerminals.add(tab.id);

        const term = new XTerm({ cursorBlink: true, fontSize: 13, fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace", theme: getTerminalTheme(), allowProposedApi: true, scrollback: 10000, cols: 80, rows: 24 });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        let sessionCreated = false;
        const setupEvents = (id: string) => {
            term.onResize(s => {
                if (sessionCreated) {
                    void window.electron.terminal.resize(id, s.cols, s.rows);
                }
            });
            term.onData(d => {
                if (sessionCreated) {
                    void window.electron.terminal.write(id, d);
                }
            });
        };

        const createBackendSession = async (cols: number, rows: number) => {
            if (!(await window.electron.terminal.isAvailable())) {
                term.write('\r\n\x1b[31m[ERROR] Terminal service not available.\x1b[0m\r\n');
                return null;
            }
            const result = await window.electron.terminal.create({ id: tab.id, shell: tab.type, ...(projectPath ? { cwd: projectPath } : {}), cols, rows });
            if (!result.success) {
                term.write(`\r\n\x1b[31m[ERROR] ${result.error}\x1b[0m\r\n`);
                return null;
            }
            return result;
        };

        const initSession = async () => {
            if (initializedTerminals.has(tab.id)) {
                initializingTerminals.delete(tab.id);
                return;
            }
            await new Promise(r => { setTimeout(r, 50); });
            try {
                if (containerRef.current?.offsetParent) {
                    fitAddon.fit();
                }
            } catch { /* ignore */ }
            const res = await createBackendSession(term.cols || 80, term.rows || 24);
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
                if (b) {
                    term.write(b);
                }
            } catch { /* ignore */ }
            setIsReady(true);
        };

        void initSession();

        return () => {
            isInitializedRef.current = false;
            if (sessionCreated) {
                initializedTerminals.delete(tab.id);
                void window.electron.terminal.kill(tab.id);
            }
            initializingTerminals.delete(tab.id);
            try {
                term.dispose();
            } catch { /* ignore */ }
        };
    }, [tab.id, tab.type, projectPath, containerRef]);

    return { xtermRef, fitAddonRef, isReady, hasError };
};

const TerminalSession = memo(({ tab, isActive, onClose, projectPath }: { tab: TerminalTab, isActive: boolean, onClose: () => void, projectPath?: string }) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const { xtermRef, fitAddonRef, isReady, hasError } = useTerminalSession(tab, containerRef, projectPath);

    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = getTerminalTheme();
        }
    }, [theme, xtermRef]);

    const safeFit = useCallback(() => {
        if (!fitAddonRef.current || !containerRef.current || !isActive) {
            return;
        }
        try {
            if (containerRef.current.offsetParent) {
                fitAddonRef.current.fit();
            }
        } catch { /* ignore */ }
    }, [isActive, fitAddonRef]);

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
                    xtermRef.current.write(`\r\n\x1b[33m[Terminal exited with code ${d.code ?? 0}]\x1b[0m\r\n`);
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
        if (!isActive) {
            return;
        }
        const timer = setTimeout(safeFit, 100);
        return () => {
            clearTimeout(timer);
        };
    }, [isActive, safeFit]);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }
        const observer = new ResizeObserver(() => {
            if (isActive) {
                safeFit();
            }
        });
        observer.observe(containerRef.current);
        return () => { observer.disconnect(); };
    }, [isActive, safeFit]);

    return (
        <div className={cn("h-full w-full bg-background", isActive ? "block" : "hidden")} style={{ paddingLeft: '8px' }}>
            {hasError && <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"><div className="text-center px-4"><p className="text-destructive text-sm mb-1">{t('terminal.sessionFailed')}</p><p className="text-muted-foreground text-xs">{t('terminal.closeAndCreate')}</p></div></div>}
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
});
TerminalSession.displayName = 'TerminalSession';

export function TerminalPanel({ isOpen, onToggle, height, onHeightChange, projectPath, tabs, activeTabId, setTabs, setActiveTabId }: TerminalPanelProps) {
    const { t } = useTranslation();
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showNewTerminalMenu, setShowNewTerminalMenu] = useState(false);
    const [availableShells, setAvailableShells] = useState<{ id: string, name: string, path: string }[]>([]);

    const createTerminal = useCallback((type: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        const name = `${availableShells.find(s => s.id === type)?.name ?? type} ${tabs.filter(t => t.type === type).length + 1}`;
        setTabs(prev => [...prev, { id, name, type, cwd: projectPath ?? '', isRunning: true, status: 'idle', history: [], command: '' }]);
        setActiveTabId(id);
        setShowNewTerminalMenu(false);
    }, [availableShells, projectPath, setTabs, setActiveTabId, tabs]);

    const isCreatingRef = useRef(false);
    const hasAutoCreatedRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            hasAutoCreatedRef.current = false;
            isCreatingRef.current = false;
        }
    }, [isOpen]);

    useEffect(() => {
        const loadShells = async () => {
            if (isCreatingRef.current || hasAutoCreatedRef.current || tabs.length > 0) {
                return;
            }
            try {
                if (!(await window.electron.terminal.isAvailable())) {
                    return;
                }
                const shells = await window.electron.terminal.getShells();
                setAvailableShells(shells);
                if (isOpen && tabs.length === 0 && shells.length > 0) {
                    isCreatingRef.current = true;
                    hasAutoCreatedRef.current = true;
                    setTimeout(() => {
                        if (tabs.length === 0 && shells[0]) {
                            createTerminal(shells[0].id);
                        }
                        isCreatingRef.current = false;
                    }, 100);
                }
            } catch (error) {
                appLogger.error('TerminalPanel', 'Failed to load shells', error as Error);
                isCreatingRef.current = false;
                hasAutoCreatedRef.current = false;
            }
        };
        if (isOpen) {
            void loadShells();
        }
    }, [isOpen, tabs.length, createTerminal]);

    const closeTab = useCallback((id: string) => {
        initializedTerminals.delete(id);
        initializingTerminals.delete(id);
        void window.electron.terminal.kill(id);
        setTabs(prev => {
            const next = prev.filter(t => t.id !== id);
            if (activeTabId === id) {
                setActiveTabId(next[next.length - 1]?.id ?? null);
            }
            return next;
        });
    }, [activeTabId, setTabs, setActiveTabId]);

    useEffect(() => {
        const c1 = window.electron.terminal.onData(p => { window.dispatchEvent(new CustomEvent('terminal-data-multiplex', { detail: p })); });
        const c2 = window.electron.terminal.onExit(p => { window.dispatchEvent(new CustomEvent('terminal-exit-multiplex', { detail: p })); });
        return () => {
            c1();
            c2();
        };
    }, []);

    useEffect(() => {
        if (!isResizing) {
            return;
        }
        const hMove = (e: MouseEvent) => {
            onHeightChange(Math.min(Math.max(150, window.innerHeight - e.clientY), window.innerHeight * 0.8));
        };
        const hUp = () => {
            setIsResizing(false);
        };
        document.addEventListener('mousemove', hMove);
        document.addEventListener('mouseup', hUp);
        return () => {
            document.removeEventListener('mousemove', hMove);
            document.removeEventListener('mouseup', hUp);
        };
    }, [isResizing, onHeightChange]);

    return (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ height: isMaximized ? '70vh' : height }} className="flex flex-col bg-background border-t border-border overflow-hidden shadow-2xl h-full">
            <div onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }} className={cn("h-1 cursor-ns-resize bg-transparent hover:bg-primary/50 transition-colors w-full relative z-10", isResizing && "bg-primary")} />
            <div className="flex items-center justify-between px-2 py-1.5 bg-card/40 border-b border-border backdrop-blur-sm">
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar no-thumb">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTabId(tab.id)} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap border border-transparent", activeTabId === tab.id ? "bg-accent text-foreground border-border shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                            <TerminalSquare className={cn("w-3.5 h-3.5", activeTabId === tab.id ? "text-primary" : "opacity-70")} />
                            {tab.name}
                            <div onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-3 h-3" /></div>
                        </button>
                    ))}
                    <div className="relative ml-1">
                        <button onClick={() => { setShowNewTerminalMenu(!showNewTerminalMenu); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                        <AnimatePresence>
                            {showNewTerminalMenu && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute bottom-full left-0 mb-2 py-1 bg-popover border border-border rounded-lg shadow-xl z-50 min-w-[140px] overflow-hidden">
                                    {availableShells.length > 0 ? availableShells.map(s => <button key={s.id} onClick={() => { createTerminal(s.id); }} className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-accent/50 transition-colors flex items-center gap-2 text-foreground"><span className="opacity-50">&gt;_</span>{s.name}</button>) : <div className="px-3 py-2 text-xs text-muted-foreground">{t('terminal.noShellsFound')}</div>}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => { setIsMaximized(!isMaximized); }} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">{isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
                    <button onClick={onToggle} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
            </div>
            <div className="flex-1 overflow-hidden relative bg-background">
                {tabs.map(tab => <TerminalSession key={tab.id} tab={tab} isActive={activeTabId === tab.id} onClose={() => { closeTab(tab.id); }} projectPath={projectPath} />)}
                {tabs.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <Terminal className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm">{t('terminal.noActiveSessions')}</p>
                        <button onClick={() => { createTerminal(availableShells[0]?.id || 'powershell'); }} className="mt-4 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-bold transition-all border border-primary/30">{t('terminal.startNewSession')}</button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
