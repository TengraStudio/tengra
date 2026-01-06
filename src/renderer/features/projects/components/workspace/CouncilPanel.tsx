import React from 'react';
import { cn } from '@/lib/utils';
import { CouncilAgent, ActivityEntry } from '@/types';

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
}

/**
 * CouncilPanel Component
 * 
 * Manages the Agent Council:
 * - Stats and status indicators
 * - Agent management (enable/disable/add)
 * - Council execution controls
 * - Specialized strategy and rule displays
 */
export const CouncilPanel: React.FC<CouncilPanelProps> = ({
    councilEnabled,
    toggleCouncil,
    agents,
    toggleAgent,
    addAgent,
    runCouncil,
    activityLog,
    clearLogs,
    t
}) => {
    const enabledAgents = agents.filter((agent) => agent.enabled);
    const localCount = enabledAgents.filter((agent) => agent.kind === 'local').length;
    const cloudCount = enabledAgents.filter((agent) => agent.kind === 'cloud').length;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                    <div className="text-xs uppercase text-zinc-500 tracking-widest">Council</div>
                    <div className="text-2xl font-bold text-white">{councilEnabled ? 'Enabled' : 'Disabled'}</div>
                    <button
                        onClick={toggleCouncil}
                        className={cn(
                            "w-full px-3 py-2 rounded-lg text-xs font-semibold border transition-colors",
                            councilEnabled
                                ? "bg-primary/20 text-primary border-primary/40"
                                : "bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10"
                        )}
                    >
                        {councilEnabled ? 'Disable council' : 'Enable council'}
                    </button>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                    <div className="text-xs uppercase text-zinc-500 tracking-widest">Agents</div>
                    <div className="text-2xl font-bold text-white">{enabledAgents.length}</div>
                    <div className="text-xs text-zinc-500">{localCount} local / {cloudCount} cloud</div>
                    <button
                        onClick={addAgent}
                        className="w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                    >
                        Add agent
                    </button>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                    <div className="text-xs uppercase text-zinc-500 tracking-widest">Consensus</div>
                    <div className="text-2xl font-bold text-white">2/3</div>
                    <div className="text-xs text-zinc-500">Default voting threshold</div>
                    <button
                        onClick={runCouncil}
                        disabled={!councilEnabled}
                        className={cn(
                            "w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 transition-colors",
                            councilEnabled ? "hover:bg-white/10" : "opacity-60 cursor-not-allowed"
                        )}
                    >
                        Run council
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-white">Agents</div>
                    <div className="text-xs text-zinc-500">{enabledAgents.length} active</div>
                </div>
                <div className="space-y-3">
                    {agents.map((agent) => (
                        <div key={agent.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <div className={cn(
                                "h-2.5 w-2.5 rounded-full",
                                agent.status === 'ready' ? "bg-emerald-400" : "bg-amber-400"
                            )} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white truncate">{agent.name}</div>
                                <div className="text-xs text-zinc-500 truncate">{agent.role}</div>
                            </div>
                            <span className="text-xs uppercase font-semibold text-zinc-400">{agent.kind}</span>
                            <button
                                onClick={() => toggleAgent(agent.id)}
                                className={cn(
                                    "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                                    agent.enabled
                                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                        : "bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10"
                                )}
                            >
                                {agent.enabled ? 'On' : 'Off'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="text-sm font-semibold text-white mb-3">Task routing</div>
                    <div className="space-y-2 text-xs text-zinc-500">
                        <div className="flex items-center justify-between">
                            <span>Strategy</span>
                            <span className="text-zinc-300">Round robin</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Soft deadline</span>
                            <span className="text-zinc-300">4s</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Hard deadline</span>
                            <span className="text-zinc-300">25s</span>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="text-sm font-semibold text-white mb-3">Decision rules</div>
                    <div className="space-y-2 text-xs text-zinc-500">
                        <div className="flex items-center justify-between">
                            <span>Confidence gate</span>
                            <span className="text-zinc-300"> {'>'}= 0.7</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Conflict handling</span>
                            <span className="text-zinc-300">Escalate to user</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Late suggestions</span>
                            <span className="text-zinc-300">Allowed</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
