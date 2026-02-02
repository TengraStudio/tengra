import React from 'react';

import { cn } from '@/lib/utils';
import { ActivityEntry,CouncilAgent } from '@/types';

interface CouncilPanelProps {
    councilEnabled: boolean;
    toggleCouncil: () => void;
    agents: CouncilAgent[];
    toggleAgent: (id: string) => void;
    addAgent: () => void;
    runCouncil: () => void;
    activityLog: ActivityEntry[];
    clearLogs: () => void;
    t: (key: string) => string;
    goal: string;
    setGoal: (val: string) => void;
}

type LogType = 'error' | 'success' | 'plan' | 'info';
type AgentId = 'planner' | 'executor' | 'reviewer' | string;

const LOG_DOT_COLORS: Record<LogType, string> = {
    error: 'bg-destructive',
    success: 'bg-success',
    plan: 'bg-primary',
    info: 'bg-muted'
};

const AGENT_TITLE_COLORS: Record<AgentId, string> = {
    planner: 'text-primary',
    executor: 'text-warning',
    reviewer: 'text-purple'
};

const getLogDotColor = (log: ActivityEntry): string => {
    if (log.type === 'error') { return LOG_DOT_COLORS.error; }
    if (log.type === 'success') { return LOG_DOT_COLORS.success; }
    if (log.type === 'plan') { return LOG_DOT_COLORS.plan; }
    if (log.agentId === 'reviewer') { return 'bg-purple'; }
    return LOG_DOT_COLORS.info;
};

const getAgentTitleColor = (log: ActivityEntry): string => {
    const agentId = log.agentId ?? '';
    const title = log.title;
    if (agentId === 'planner' || title === 'PLANNER') { return AGENT_TITLE_COLORS.planner; }
    if (agentId === 'executor' || title === 'EXECUTOR') { return AGENT_TITLE_COLORS.executor; }
    if (agentId === 'reviewer' || title === 'REVIEWER') { return AGENT_TITLE_COLORS.reviewer; }
    return 'text-muted-foreground';
};

interface StatsCardsProps {
    councilEnabled: boolean;
    toggleCouncil: () => void;
    enabledAgents: CouncilAgent[];
    localCount: number;
    cloudCount: number;
    addAgent: () => void;
    goal: string;
    setGoal: (val: string) => void;
    runCouncil: () => void;
    t: (key: string) => string;
}

const StatsCards: React.FC<StatsCardsProps> = ({ councilEnabled, toggleCouncil, enabledAgents, localCount, cloudCount, addAgent, goal, setGoal, runCouncil, t }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="text-xs uppercase text-muted-foreground tracking-widest">{t('agents.council')}</div>
            <div className="text-2xl font-bold text-foreground">{councilEnabled ? t('agents.enabled') : t('agents.disabled')}</div>
            <button
                onClick={toggleCouncil}
                className={cn(
                    "w-full px-3 py-2 rounded-lg text-xs font-semibold border transition-colors",
                    councilEnabled ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground hover:bg-white/10"
                )}
            >
                {councilEnabled ? t('agents.disableCouncil') : t('agents.enableCouncil')}
            </button>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="text-xs uppercase text-muted-foreground tracking-widest">{t('agents.agents')}</div>
            <div className="text-2xl font-bold text-foreground">{enabledAgents.length}</div>
            <div className="text-xs text-muted-foreground">{localCount} {t('agents.local')} / {cloudCount} {t('agents.cloud')}</div>
            <button onClick={addAgent} className="w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">{t('agents.addAgent')}</button>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="text-xs uppercase text-muted-foreground tracking-widest">{t('agents.goal')}</div>
            <textarea className="w-full h-16 bg-black/20 border border-white/10 rounded-lg p-2 text-xs text-zinc-300 resize-none focus:outline-none focus:border-primary/50 custom-scrollbar" placeholder={t('agents.describeObjective')} value={goal} onChange={e => setGoal(e.target.value)} />
            <button
                onClick={runCouncil}
                disabled={!councilEnabled || !goal.trim()}
                className={cn("w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 transition-colors", (councilEnabled && goal.trim()) ? "hover:bg-white/10" : "opacity-60 cursor-not-allowed")}
            >
                {t('agents.runCouncil')}
            </button>
        </div>
    </div>
);

interface AgentListProps {
    agents: CouncilAgent[];
    enabledAgents: CouncilAgent[];
    toggleAgent: (id: string) => void;
    t: (key: string) => string;
}

const AgentList: React.FC<AgentListProps> = ({ agents, enabledAgents, toggleAgent, t }) => (
    <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-foreground">{t('agents.agents')}</div>
            <div className="text-xs text-muted-foreground">{enabledAgents.length} {t('agents.active')}</div>
        </div>
        <div className="space-y-3">
            {agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className={cn("h-2.5 w-2.5 rounded-full", agent.status === 'ready' ? "bg-success" : "bg-warning")} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{agent.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{agent.role}</div>
                    </div>
                    <span className="text-xs uppercase font-semibold text-muted-foreground">{agent.kind}</span>
                    <button
                        onClick={() => toggleAgent(agent.id)}
                        className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors", agent.enabled ? "bg-success/10 text-emerald-300 border-success/30" : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground hover:bg-white/10")}
                    >
                        {agent.enabled ? t('agents.on') : t('agents.off')}
                    </button>
                </div>
            ))}
        </div>
    </div>
);

const ActivityLogEntry: React.FC<{ log: ActivityEntry }> = ({ log }) => (
    <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className={cn("shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full", getLogDotColor(log))} />
        <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className={cn("uppercase font-bold tracking-wider text-[10px]", getAgentTitleColor(log))}>{log.agentId ?? log.title}</span>
                <span className="text-[10px] text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed break-words">
                {log.message.split('```').map((part: string, i: number) => (
                    i % 2 === 1 ? <code key={i} className="block my-2 p-2 bg-white/5 rounded border border-white/5 text-amber-200/80">{part.trim()}</code> : <span key={i}>{part}</span>
                ))}
            </div>
        </div>
    </div>
);

/**
 * CouncilPanel Component
 * Manages the Agent Council: Stats, agent management, execution controls
 */
export const CouncilPanel: React.FC<CouncilPanelProps> = ({
    councilEnabled, toggleCouncil, agents, toggleAgent, addAgent, runCouncil, activityLog, clearLogs, goal, setGoal, t
}) => {
    const enabledAgents = agents.filter((agent) => agent.enabled);
    const localCount = enabledAgents.filter((agent) => agent.kind === 'local').length;
    const cloudCount = enabledAgents.filter((agent) => agent.kind === 'cloud').length;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            <StatsCards councilEnabled={councilEnabled} toggleCouncil={toggleCouncil} enabledAgents={enabledAgents} localCount={localCount} cloudCount={cloudCount} addAgent={addAgent} goal={goal} setGoal={setGoal} runCouncil={runCouncil} t={t} />
            <AgentList agents={agents} enabledAgents={enabledAgents} toggleAgent={toggleAgent} t={t} />

            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">{t('agents.thoughtStream')}</div>
                    <button onClick={clearLogs} className="text-xs text-muted-foreground hover:text-zinc-300">{t('agents.clear')}</button>
                </div>
                <div className="h-64 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl bg-black/40 p-4 space-y-3 font-mono text-xs">
                    {activityLog.length === 0 ? (
                        <div className="text-zinc-600 italic text-center py-10">{t('agents.waitingActivity')}</div>
                    ) : (
                        activityLog.map((log: ActivityEntry) => <ActivityLogEntry key={log.id} log={log} />)
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="text-sm font-semibold text-foreground mb-3">{t('agents.taskRouting')}</div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between"><span>{t('agents.strategy')}</span><span className="text-zinc-300">{t('agents.roundRobin')}</span></div>
                        <div className="flex items-center justify-between"><span>{t('agents.softDeadline')}</span><span className="text-zinc-300">4s</span></div>
                        <div className="flex items-center justify-between"><span>{t('agents.hardDeadline')}</span><span className="text-zinc-300">25s</span></div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="text-sm font-semibold text-foreground mb-3">{t('agents.decisionRules')}</div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between"><span>{t('agents.confidenceGate')}</span><span className="text-zinc-300"> {'>'}= 0.7</span></div>
                        <div className="flex items-center justify-between"><span>{t('agents.conflictHandling')}</span><span className="text-zinc-300">{t('agents.escalateToUser')}</span></div>
                        <div className="flex items-center justify-between"><span>{t('agents.lateSuggestions')}</span><span className="text-zinc-300">{t('agents.allowed')}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
