import { useTranslation } from '@renderer/i18n';
import { getTerminalTheme } from '@renderer/lib/terminal-theme';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

import 'xterm/css/xterm.css';

const initializedTerminals = new Set<string>();
const initializingTerminals = new Set<string>();

interface TerminalDataEventDetail { id: string; data: string; }
interface TerminalExitEventDetail { id: string; code?: number; }

interface TerminalSessionProps {
    tab: TerminalTab;
    isActive: boolean;
    onClose: () => void;
    projectPath?: string;
}

const TerminalErrorOverlay: React.FC<{ t: (k: string) => string }> = ({ t }) => (
    <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
        <div className="text-center px-4">
            <p className="text-destructive text-sm mb-1">{t('terminal.sessionFailed')}</p>
            <p className="text-muted-foreground text-xs">{t('terminal.closeAndCreate')}</p>
        </div>
    </div>
);

function useTerminalMultiplexer(tabId: string, isReady: boolean, xtermRef: React.RefObject<XTerm | null>, onClose: () => void) {
    useEffect(() => {
        const xterm = xtermRef.current;
        if (!isReady || !xterm) { return; }
        const handleData = (e: Event) => {
            const detail = (e as CustomEvent<TerminalDataEventDetail>).detail;
            if (detail.id === tabId) { xterm.write(detail.data); }
        };
        const handleExit = (e: Event) => {
            const detail = (e as CustomEvent<TerminalExitEventDetail>).detail;
            if (detail.id === tabId) {
                if (xtermRef.current) { xtermRef.current.write(`\r\n\x1b[33m[Terminal exited with code ${detail.code ?? 0}]\x1b[0m\r\n`); }
                onClose();
            }
        };
        window.addEventListener('terminal-data-multiplex', handleData);
        window.addEventListener('terminal-exit-multiplex', handleExit);
        return () => {
            window.removeEventListener('terminal-data-multiplex', handleData);
            window.removeEventListener('terminal-exit-multiplex', handleExit);
        };
    }, [tabId, isReady, xtermRef, onClose]);
}

export const TerminalSession = memo(({ tab, isActive, onClose, projectPath }: TerminalSessionProps) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const { theme } = useTheme();
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const sessionIdRef = useRef<string | null>(null);
    const isInitializedRef = useRef(false);
    const isActiveRef = useRef(false);

    useEffect(() => { if (xtermRef.current) { xtermRef.current.options.theme = getTerminalTheme(); } }, [theme]);
    useTerminalMultiplexer(tab.id, isReady, xtermRef, onClose);

    const safeFit = useCallback(() => {
        if (!fitAddonRef.current || !containerRef.current || !isActive) { return; }
        try { if (containerRef.current.offsetParent) { fitAddonRef.current.fit(); } } catch { /* ignore */ }
    }, [isActive]);

    const initializeBackend = useCallback(async (term: XTerm) => {
        if (!(await window.electron.terminal.isAvailable())) {
            term.write('\r\n\x1b[31m[ERROR] Terminal service unavailable.\x1b[0m\r\n');
            initializingTerminals.delete(tab.id);
            return null;
        }
        const res = await window.electron.terminal.create({ id: tab.id, shell: tab.type, ...(projectPath ? { cwd: projectPath } : {}), cols: term.cols, rows: term.rows });
        if (!res.success) {
            term.write(`\r\n\x1b[31m[ERROR] ${res.error ?? 'Failed to create session'}\x1b[0m\r\n`);
            setTimeout(() => setHasError(true), 0);
            initializingTerminals.delete(tab.id);
            return null;
        }
        return res;
    }, [tab.id, tab.type, projectPath]);

    const setupSession = useCallback(async (term: XTerm, fitAddon: FitAddon) => {
        if (initializedTerminals.has(tab.id)) { initializingTerminals.delete(tab.id); return false; }
        sessionIdRef.current = tab.id;
        await new Promise<void>(resolve => { setTimeout(resolve, 50); });
        try { if (containerRef.current?.offsetParent) { fitAddon.fit(); } } catch { /* ignore */ }
        const res = await initializeBackend(term);
        if (!res) { return false; }
        term.onResize(s => { window.electron.terminal.resize(tab.id, s.cols, s.rows).catch(() => { }); });
        term.onData(d => { window.electron.terminal.write(tab.id, d).catch(() => { }); });
        const buf = await window.electron.terminal.readBuffer(tab.id).catch(() => null);
        if (buf) { term.write(buf); }
        setTimeout(() => { setIsReady(true); setHasError(false); }, 0);
        initializedTerminals.add(tab.id);
        initializingTerminals.delete(tab.id);
        return true;
    }, [tab.id, initializeBackend]);

    useEffect(() => {
        if (initializedTerminals.has(tab.id) || initializingTerminals.has(tab.id) || !containerRef.current || isInitializedRef.current) { return; }
        isInitializedRef.current = true;
        initializingTerminals.add(tab.id);
        const term = new XTerm({ cursorBlink: true, fontSize: 13, fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace", theme: getTerminalTheme(), allowProposedApi: true, scrollback: 10000, cols: 80, rows: 24 });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        isActiveRef.current = false;
        void setupSession(term, fitAddon).then(s => { isActiveRef.current = s; });
        return () => {
            isInitializedRef.current = false;
            if (isActiveRef.current && sessionIdRef.current) { initializedTerminals.delete(tab.id); window.electron.terminal.kill(sessionIdRef.current).catch(() => { }); }
            initializingTerminals.delete(tab.id);
            term.dispose();
        };
    }, [tab.id, setupSession]);

    useEffect(() => {
        if (isActive) {
            const timer = setTimeout(safeFit, 100);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isActive, safeFit]);

    useEffect(() => {
        if (!containerRef.current) { return; }
        const observer = new ResizeObserver(() => { if (isActive) { safeFit(); } });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isActive, safeFit]);

    return (
        <div className={cn("h-full w-full bg-background", isActive ? "block" : "hidden")} style={{ paddingLeft: '8px' }}>
            {hasError && <TerminalErrorOverlay t={t} />}
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
});

TerminalSession.displayName = 'TerminalSession';
