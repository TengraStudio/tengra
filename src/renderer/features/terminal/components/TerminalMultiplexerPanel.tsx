import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

type MultiplexerMode = 'tmux' | 'screen';

interface MultiplexerSession {
    id: string;
    label: string;
    details?: string;
}

interface TerminalMultiplexerPanelProps {
    t: (key: string, options?: Record<string, string | number>) => string;
    hasActiveSession: boolean;
    multiplexerMode: MultiplexerMode;
    multiplexerSessionName: string;
    multiplexerSessions: MultiplexerSession[];
    isMultiplexerLoading: boolean;
    multiplexerError: string | null;
    closeMultiplexerPanel: () => void;
    setMultiplexerMode: (value: MultiplexerMode) => void;
    refreshMultiplexerSessions: (mode?: MultiplexerMode) => Promise<void>;
    setMultiplexerSessionName: (value: string) => void;
    createMultiplexerSession: () => Promise<void>;
    attachMultiplexerSession: (session: MultiplexerSession) => Promise<void>;
}

export function TerminalMultiplexerPanel({
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
}: TerminalMultiplexerPanelProps) {
    return (
        <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-2 w-[420px] max-w-[95vw]">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-semibold text-foreground">Multiplexer (tmux/screen)</div>
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
                    placeholder={t('placeholder.sessionName')}
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
                    <div className="px-2 py-2 text-xs text-muted-foreground">{t('common.loading')}</div>
                )}
                {!isMultiplexerLoading && multiplexerError && (
                    <div className="px-2 py-2 text-xs text-destructive whitespace-pre-wrap">
                        {multiplexerError}
                    </div>
                )}
                {!isMultiplexerLoading && !multiplexerError && multiplexerSessions.length === 0 && (
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
                            <div className="text-xs text-foreground truncate">{session.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                                {session.details ?? session.id}
                            </div>
                        </button>
                    ))}
            </div>
        </div>
    );
}
