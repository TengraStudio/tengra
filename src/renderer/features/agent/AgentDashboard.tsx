import { AgentChatRoom } from '@renderer/features/agent/AgentChatRoom';
import { AgentDefinition, CouncilSession } from '@shared/types/agent';
import { Bot, CheckCircle2, Clock, Pause, Play, RefreshCw, Sparkles } from 'lucide-react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface AgentDashboardProps {
    language: Language
}

const SessionSidebar = memo(({ sessions, activeSessionId, onSelect, t }: { sessions: CouncilSession[]; activeSessionId: string | null; onSelect: (id: string) => void; t: (key: string) => string }) => (
    <div className="w-64 border-r border-border/40 bg-zinc-950/30 flex flex-col shrink-0">
        <div className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">{t('agentDashboard.sessions')}</div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.slice().reverse().map(session => (
                <button
                    key={session.id}
                    onClick={() => onSelect(session.id)}
                    className={cn(
                        "w-full text-left p-2 rounded-md text-xs transition-colors mb-1 truncate",
                        activeSessionId === session.id ? "bg-primary/20 text-primary-foreground border border-primary/30" : "hover:bg-white/5 text-muted-foreground"
                    )}
                >
                    <div className="font-medium truncate">{session.goal}</div>
                    <div className="text-[10px] opacity-70 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(session.createdAt).toLocaleTimeString()}
                    </div>
                </button>
            ))}
        </div>
    </div>
));
SessionSidebar.displayName = 'SessionSidebar';

const GoalInput = memo(({ goal, setGoal, onStart, isLoading, t }: { goal: string; setGoal: (v: string) => void; onStart: () => void; isLoading: boolean; t: (key: string) => string }) => (
    <div className="p-4 border-b border-border/40 bg-card/30 shrink-0">
        <div className="flex gap-2">
            <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t('agents.complexGoalPlaceholder')}
                className="min-h-[60px] resize-none text-sm"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onStart();
                    }
                }}
            />
            <Button
                onClick={onStart}
                disabled={isLoading || !goal.trim()}
                className="h-auto shrink-0"
            >
                <Play className="w-4 h-4 mr-2" />
                {t('agentDashboard.start')}
            </Button>
        </div>
    </div>
));
GoalInput.displayName = 'GoalInput';

const SessionStatus = memo(({ session, isRunning, toggleAutoRun, onRunStep, t }: { session: CouncilSession; isRunning: boolean; toggleAutoRun: () => void; onRunStep: () => void; t: (key: string) => string }) => (
    <div className="grid grid-cols-3 gap-4 shrink-0">
        <div className="bg-card/50 border border-border/40 rounded-xl p-4 flex items-center justify-between">
            <div>
                <div className="text-xs text-muted-foreground uppercase">{t('agentDashboard.status')}</div>
                <div className={cn("text-lg font-bold capitalize",
                    session.status === 'completed' ? "text-green-400" :
                        session.status === 'failed' ? "text-red-400" :
                            "text-blue-400"
                )}>{session.status}</div>
            </div>
            {(session.status === 'executing' || isRunning) && <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />}
            {session.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
        </div>

        <div className="bg-card/50 border border-border/40 rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase">{t('agentDashboard.activeAgents')}</div>
            <div className="flex -space-x-2 mt-2">
                {session.agents.map((agent: AgentDefinition) => (
                    <div key={agent.id} className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-xs font-bold" title={agent.name}>
                        {agent.name[0]}
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-card/50 border border-border/40 rounded-xl p-4 flex flex-col justify-center gap-2">
            <div className="flex gap-2">
                <Button size="sm" variant={isRunning ? "destructive" : "default"} onClick={toggleAutoRun} disabled={session.status === 'completed' || session.status === 'failed'} className="flex-1">
                    {isRunning ? (<><Pause className="w-3 h-3 mr-2" />{t('agentDashboard.stopAuto')}</>) : (<><Play className="w-3 h-3 mr-2" />{t('agentDashboard.autoRun')}</>)}
                </Button>
                <Button size="sm" variant="outline" onClick={onRunStep} disabled={session.status === 'completed' || isRunning}>
                    {t('agentDashboard.step')}
                </Button>
            </div>
        </div>
    </div>
));
SessionStatus.displayName = 'SessionStatus';

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ language }) => {
    const { t } = useTranslation(language);
    const [goal, setGoal] = useState('');
    const [sessions, setSessions] = useState<CouncilSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<CouncilSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);

    const loadSessions = useCallback(async () => {
        try {
            const list = await window.electron.council.getSessions();
            setSessions(list);
        } catch (error) {
            window.electron.log.error('Failed to load sessions', error as Error);
        }
    }, []);

    const loadSession = useCallback(async (id: string) => {
        try {
            const session = await window.electron.council.getSession(id);
            setActiveSession(session);
            if (session && (session.status === 'completed' || session.status === 'failed')) {
                setIsRunning(false);
            }
        } catch (error) {
            window.electron.log.error('Failed to load session', error as Error);
        }
    }, []);

    useEffect(() => { void loadSessions(); }, [loadSessions]);
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeSessionId) {
            void loadSession(activeSessionId);
            interval = setInterval(() => { void loadSession(activeSessionId); }, 1000);
        }
        return () => { clearInterval(interval); };
    }, [activeSessionId, loadSession]);
    useEffect(() => { if (logEndRef.current) { logEndRef.current.scrollIntoView({ behavior: 'smooth' }); } }, [activeSession?.logs.length]);

    const handleCreateSession = async () => {
        if (!goal.trim()) { return; }
        setIsLoading(true);
        try {
            const session = await window.electron.council.createSession(goal);
            setSessions(prev => [...prev, session]);
            setActiveSessionId(session.id);
            setGoal('');
            setIsRunning(false);
        } catch (error) {
            window.electron.log.error('Failed to create session', error as Error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAutoRun = () => {
        if (!activeSessionId) { return; }
        if (isRunning) {
            window.electron.council.stopLoop(activeSessionId);
            setIsRunning(false);
        } else {
            window.electron.council.startLoop(activeSessionId);
            setIsRunning(true);
        }
    };

    return (
        <div className="h-full flex flex-col bg-background/50 backdrop-blur-xl">
            <div className="h-14 border-b border-border/40 flex items-center justify-between px-4 bg-muted/10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Bot className="w-5 h-5 text-primary" /></div>
                    <div>
                        <h2 className="text-sm font-bold flex items-center gap-2">{t('agentDashboard.title')}<span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">ALPHA</span></h2>
                        <p className="text-[10px] text-muted-foreground">{t('agentDashboard.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <SessionSidebar sessions={sessions} activeSessionId={activeSessionId} onSelect={setActiveSessionId} t={t} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <GoalInput goal={goal} setGoal={setGoal} onStart={() => { void handleCreateSession(); }} isLoading={isLoading} t={t} />
                    {activeSession ? (
                        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
                            <SessionStatus session={activeSession} isRunning={isRunning} toggleAutoRun={toggleAutoRun} onRunStep={() => { if (activeSessionId) { window.electron.council.runStep(activeSessionId); } }} t={t} />
                            {activeSession.plan && (
                                <div className="bg-zinc-950/50 border border-border/40 rounded-xl p-4 shrink-0 max-h-[150px] overflow-y-auto">
                                    <div className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2"><Sparkles className="w-3 h-3 text-purple-400" />{t('agentDashboard.currentPlan')}</div>
                                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans">{activeSession.plan}</pre>
                                </div>
                            )}
                            <AgentChatRoom sessionId={activeSession.id} initialLogs={activeSession.logs} isRunning={isRunning} />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <Bot className="w-12 h-12 opacity-20 mb-4" />
                            <p>{t('agentDashboard.selectSession')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
