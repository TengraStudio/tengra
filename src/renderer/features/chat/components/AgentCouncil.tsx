import { getErrorMessage } from '@shared/utils/error.util';
import { AlertCircle, Brain, Loader2, Play, Terminal, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { JsonValue } from '@/types/common';

// Types aligned with backend CouncilSession
interface AgentConfig {
    id: string
    name: string
    role: string
    model: string
    provider: string
    status?: 'thinking' | 'working' | 'waiting'
}

interface LogEntry {
    timestamp: number
    agent: string
    message: string
    type?: 'thought' | 'tool' | 'chat' | 'system'
}

interface LocalCouncilSession {
    id: string
    projectId: string
    status: 'planning' | 'working' | 'reviewing' | 'waiting_for_approval' | 'completed' | 'failed'
    plan: JsonValue
    task: string
    agents: AgentConfig[]
    logs: LogEntry[]
}

const statusConfig = {
    planning: { label: 'planning', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    working: { label: 'working', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    reviewing: { label: 'reviewing', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    waiting_for_approval: { label: 'waiting_for_approval', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    completed: { label: 'completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    failed: { label: 'failed', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' }
};

const AgentStatusBadge = ({ status }: { status: 'thinking' | 'working' | 'waiting' }) => {
    const statusColors = {
        thinking: 'bg-blue-500',
        working: 'bg-amber-500',
        waiting: 'bg-zinc-500'
    };

    return (
        <span className={cn(
            "px-2 py-1 text-[10px] font-medium rounded-md flex items-center gap-1",
            statusColors[status],
            "text-foreground"
        )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[status])} />
            {status}
        </span>
    );
};

const AgentCard = ({ agent, active }: { agent: AgentConfig; active: boolean }) => (
    <div
        className={cn(
            "relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-300",
            "bg-card/50 backdrop-blur-sm",
            active
                ? "border-primary/50 shadow-lg shadow-primary/5 ring-2 ring-primary/20"
                : "border-border/50 hover:border-border",
            active && "scale-[1.02]"
        )}
        role="article"
        aria-label={`Agent ${agent.name}`}
    >
        <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn(
                    "relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                    active ? "bg-primary/20" : "bg-muted/50"
                )}>
                    <User className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground")} />
                    {active && (
                        <div
                            className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse ring-2 ring-background"
                            role="status"
                            aria-label="Active"
                        />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className={cn(
                        "text-sm font-semibold truncate",
                        active ? "text-foreground" : "text-muted-foreground"
                    )}>
                        {agent.name}
                    </h3>
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                        {agent.role}
                    </p>
                </div>
            </div>
        </div>

        <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 text-[10px] font-medium rounded-md bg-background/50 border border-border/50 text-muted-foreground">
                {agent.model}
            </span>
            <span className="px-2 py-1 text-[10px] font-medium rounded-md bg-background/50 border border-border/50 text-muted-foreground">
                {agent.provider}
            </span>
            {agent.status && <AgentStatusBadge status={agent.status} />}
        </div>

        {active && (
            <div className="absolute inset-0 rounded-xl border-2 border-primary/30 pointer-events-none animate-pulse" aria-hidden="true" />
        )}
    </div>
);

const AgentList = ({
    agents,
    activeAgentName
}: {
    agents: AgentConfig[];
    activeAgentName: string | null
}) => {
    if (agents.length === 0) { return null; }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="list" aria-label="Agents">
            {agents.map((agent) => (
                <AgentCard
                    key={agent.id}
                    agent={agent}
                    active={activeAgentName === agent.name}
                />
            ))}
        </div>
    );
};

const AgentCouncilHeader = ({
    session,
    isGenerating,
    taskInput,
    setTaskInput,
    handleStart,
    t,
    statusInfo
}: {
    session: LocalCouncilSession | null;
    isGenerating: boolean;
    taskInput: string;
    setTaskInput: (v: string) => void;
    handleStart: () => Promise<void>;
    t: (key: string) => string;
    statusInfo: { label: string; color: string; bg: string; border: string } | null;
}) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 md:p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
                <h2 className="text-lg md:text-xl font-bold text-foreground">{t('council.title')}</h2>
                <p className="text-xs text-muted-foreground hidden sm:block">
                    {t('council.subtitle')}
                </p>
            </div>
        </div>

        {(!session || session.status === 'completed' || session.status === 'failed') ? (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:min-w-[400px]">
                <input
                    type="text"
                    placeholder={t('council.taskPlaceholder')}
                    aria-label={t('council.taskPlaceholder')}
                    className="flex-1 px-4 py-2.5 bg-background/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isGenerating && taskInput.trim()) {
                            void handleStart();
                        }
                    }}
                    disabled={isGenerating}
                />
                <button
                    onClick={() => void handleStart()}
                    disabled={isGenerating || !taskInput.trim()}
                    aria-label={isGenerating ? t('council.starting') : t('council.start')}
                    className={cn(
                        "px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all",
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50"
                    )}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="hidden sm:inline">{t('council.starting')}</span>
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            <span>{t('council.start')}</span>
                        </>
                    )}
                </button>
            </div>
        ) : (
            statusInfo && (
                <div
                    className={cn(
                        "px-4 py-2 rounded-lg border flex items-center gap-2",
                        statusInfo.bg,
                        statusInfo.border
                    )}
                    role="status"
                >
                    <div className={cn("w-2 h-2 rounded-full", statusInfo.color.replace('text-', 'bg-'))} />
                    <span className={cn("text-sm font-medium", statusInfo.color)}>
                        {t(`council.status.${statusInfo.label}`)}
                    </span>
                </div>
            )
        )}
    </div>
);

const LogItem = ({ log }: { log: LogEntry }) => {
    const logType = log.type ?? 'chat';
    const typeConfig = {
        thought: { icon: Brain, color: 'text-blue-400', bg: 'bg-blue-500/5' },
        tool: { icon: Terminal, color: 'text-amber-400', bg: 'bg-amber-500/5' },
        chat: { icon: User, color: 'text-primary', bg: 'bg-primary/5' },
        system: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/5' }
    };

    const config = (typeConfig as Record<string, typeof typeConfig.chat>)[logType] ?? typeConfig.chat;
    const Icon = config.icon;

    return (
        <div
            className={cn(
                "flex gap-3 p-3 rounded-lg border transition-all animate-in fade-in slide-in-from-bottom-2 duration-300",
                config.bg,
                "border-border/50 hover:border-border"
            )}
            role="log"
        >
            <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", config.bg)}>
                <Icon className={cn("w-4 h-4", config.color)} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", config.color)}>
                        {log.agent}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {log.message}
                </div>
            </div>
        </div>
    );
};

const AgentCouncilActivity = ({ session, t }: { session: LocalCouncilSession | null; t: (key: string) => string }) => (
    <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden" role="region" aria-label={t('council.liveActivity')}>
        <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{t('council.liveActivity')}</h3>
            </div>
            {session?.logs && session.logs.length > 0 && (
                <span className="text-xs text-muted-foreground">
                    {session.logs.length} {session.logs.length === 1 ? t('council.entry') : t('council.entries')}
                </span>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {session?.logs && session.logs.length > 0 ? (
                session.logs.map((log, i) => (
                    <LogItem key={i} log={log} />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                        <Brain className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                        {t('council.noActiveSession')}
                    </h3>
                    <p className="text-xs text-muted-foreground/60 max-w-md">
                        {t('council.noActiveSessionDesc')}
                    </p>
                </div>
            )}
        </div>
    </div>
);

interface AgentCouncilProps {
    language?: Language
}

export const AgentCouncil: React.FC<AgentCouncilProps> = ({ language = 'en' }) => {
    const { t } = useTranslation(language);
    const [session, setSession] = useState<LocalCouncilSession | null>(null);
    const [taskInput, setTaskInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        // Listen for IPC updates (placeholder for future implementation)
    }, []);

    const handleStart = async () => {
        if (!taskInput.trim()) { return; }
        setIsGenerating(true);
        try {
            const newSession = await window.electron.council.createSession(taskInput);
            if (newSession) {
                setSession(newSession as LocalCouncilSession);
            }
        } catch (err) {
            console.error('Failed to create council session', getErrorMessage(err as Error));
        } finally {
            setIsGenerating(false);
        }
    };

    const lastLog = session?.logs ? session.logs[session.logs.length - 1] : undefined;
    const activeAgentName = lastLog?.agent ?? null;
    const statusInfo = session ? statusConfig[session.status] : null;

    return (
        <div className="h-full flex flex-col gap-4 p-4 md:p-6 overflow-hidden">
            <AgentCouncilHeader
                session={session}
                isGenerating={isGenerating}
                taskInput={taskInput}
                setTaskInput={setTaskInput}
                handleStart={handleStart}
                t={t}
                statusInfo={statusInfo}
            />

            <AgentList
                agents={session?.agents ?? []}
                activeAgentName={activeAgentName}
            />

            <AgentCouncilActivity session={session} t={t} />
        </div>
    );
};
