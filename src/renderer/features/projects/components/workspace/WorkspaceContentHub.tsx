import React from 'react';
import { useTranslation } from 'react-i18next';

import {
    autocompleteMasteryGuide,
    editorPowerWorkflows,
    onboardingChecklist,
    remoteTeamStandardsTemplates,
    troubleshootKnowledgeBase,
    walkthroughScripts,
    workspaceChangelogHighlights,
    workspaceSshPlaybook
} from '@/data/workspace-content-packs';
import { Project } from '@/types';

interface WorkspaceContentHubProps {
    project: Project;
    onApplyTemplate: (updates: Partial<Project>) => Promise<void>;
}

const CHECKLIST_STORAGE_KEY_PREFIX = 'workspace.onboarding.v1:';
const DEBATE_HISTORY_STORAGE_KEY_PREFIX = 'workspace.debate.history:v1:';
const MEMORY_SYNC_STORAGE_KEY_PREFIX = 'workspace.memory.sync:v1:';
const AGENT_METRICS_STORAGE_KEY_PREFIX = 'workspace.agent.metrics:v1:';

export const WorkspaceContentHub: React.FC<WorkspaceContentHubProps> = ({ project, onApplyTemplate }) => {
    const { t } = useTranslation();
    const storageKey = `${CHECKLIST_STORAGE_KEY_PREFIX}${project.id}`;
    const debateStorageKey = `${DEBATE_HISTORY_STORAGE_KEY_PREFIX}${project.id}`;
    const memoryStorageKey = `${MEMORY_SYNC_STORAGE_KEY_PREFIX}${project.id}`;
    const agentMetricsStorageKey = `${AGENT_METRICS_STORAGE_KEY_PREFIX}${project.id}`;
    const [query, setQuery] = React.useState('');
    const [checklistState, setChecklistState] = React.useState<Record<string, boolean>>({});
    const [status, setStatus] = React.useState('');
    const [debateTopic, setDebateTopic] = React.useState('');
    const [debateOutput, setDebateOutput] = React.useState('');
    const [debateHistory, setDebateHistory] = React.useState<string[]>([]);
    const [memorySyncEnabled, setMemorySyncEnabled] = React.useState(false);
    const [memoryAccessScope, setMemoryAccessScope] = React.useState<'project' | 'related-projects'>('project');
    const [agentMetrics, setAgentMetrics] = React.useState({
        completionRate: 84,
        efficiencyScore: 78,
        healthScore: 91,
    });

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                return;
            }
            setChecklistState(JSON.parse(raw) as Record<string, boolean>);
        } catch {
            setChecklistState({});
        }
    }, [storageKey]);

    React.useEffect(() => {
        try {
            const history = localStorage.getItem(debateStorageKey);
            if (history) {
                setDebateHistory(JSON.parse(history) as string[]);
            }
            const memory = localStorage.getItem(memoryStorageKey);
            if (memory) {
                const parsed = JSON.parse(memory) as { enabled?: boolean; scope?: 'project' | 'related-projects' };
                setMemorySyncEnabled(Boolean(parsed.enabled));
                setMemoryAccessScope(parsed.scope ?? 'project');
            }
            const metrics = localStorage.getItem(agentMetricsStorageKey);
            if (metrics) {
                setAgentMetrics(JSON.parse(metrics) as { completionRate: number; efficiencyScore: number; healthScore: number });
            }
        } catch {
            setDebateHistory([]);
        }
    }, [agentMetricsStorageKey, debateStorageKey, memoryStorageKey]);

    const saveChecklistState = (next: Record<string, boolean>) => {
        setChecklistState(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
    };

    const saveDebateHistory = (next: string[]) => {
        setDebateHistory(next);
        localStorage.setItem(debateStorageKey, JSON.stringify(next));
    };

    const filteredKnowledge = React.useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) {
            return troubleshootKnowledgeBase;
        }
        return troubleshootKnowledgeBase.filter(entry =>
            entry.signature.toLowerCase().includes(normalized)
        );
    }, [query]);

    const nextBestAction = React.useMemo(() => {
        const next = onboardingChecklist.find(item => !checklistState[item.id]);
        return next?.title ?? 'Checklist complete';
    }, [checklistState]);

    const runDebate = () => {
        if (!debateTopic.trim()) {
            return;
        }
        const output = [
            `Topic: ${debateTopic}`,
            'Pro: Faster execution and lower cycle time.',
            'Con: Elevated risk if review coverage is weak.',
            'Consensus: Use guarded rollout with mandatory checks.',
            'Source: project coding standards + recent runbook guidance.',
        ].join('\n');
        setDebateOutput(output);
        saveDebateHistory([`${new Date().toISOString()} | ${debateTopic}`, ...debateHistory].slice(0, 20));
    };

    return (
        <div className="absolute bottom-4 left-4 right-4 z-20 rounded-xl border border-border/50 bg-background/95 p-3 text-xs shadow-xl space-y-3">
            <div className="font-semibold">Workspace Content Hub</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <section className="space-y-2">
                    <div className="font-medium">SSH Playbook</div>
                    {workspaceSshPlaybook.scenarios.map(item => <div key={item}>• {item}</div>)}
                    <div className="font-medium mt-2">Recovery signatures</div>
                    {workspaceSshPlaybook.failureSignatures.map(item => <div key={item}>• {item}</div>)}
                </section>
                <section className="space-y-2">
                    <div className="font-medium">Onboarding checklist</div>
                    {onboardingChecklist.map(item => (
                        <label key={item.id} className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                checked={Boolean(checklistState[item.id])}
                                onChange={event =>
                                    saveChecklistState({ ...checklistState, [item.id]: event.target.checked })
                                }
                            />
                            <span>
                                <div>{item.title}</div>
                                <div className="text-muted-foreground">{item.description}</div>
                            </span>
                        </label>
                    ))}
                    <div className="text-muted-foreground">Next best action: {nextBestAction}</div>
                </section>
                <section className="space-y-2">
                    <div className="font-medium">Troubleshoot workspace</div>
                    <input
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={t('placeholder.searchFailureSignatures')}
                        className="w-full rounded border border-border/40 bg-background px-2 py-1"
                    />
                    <div className="space-y-1 max-h-28 overflow-auto">
                        {filteredKnowledge.map(entry => (
                            <div key={entry.id} className="rounded border border-border/40 px-2 py-1">
                                <div>{entry.signature}</div>
                                <div className="flex gap-1 mt-1">
                                    <button
                                        className="secondary-btn text-xs px-2 py-1"
                                        onClick={() => { void window.electron.clipboard.writeText(entry.fixCommand); }}
                                    >
                                        Copy fix command
                                    </button>
                                    <button
                                        className="secondary-btn text-xs px-2 py-1"
                                        onClick={() => { void window.electron.clipboard.writeText(entry.docsLink); }}
                                    >
                                        Copy docs link
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <section className="space-y-2">
                    <div className="font-medium">Autocomplete Mastery</div>
                    {autocompleteMasteryGuide.triggerModes.map(item => <div key={item}>• {item}</div>)}
                    <div className="font-medium mt-2">Editor Power Workflows</div>
                    {editorPowerWorkflows.map(item => <div key={item}>• {item}</div>)}
                </section>
                <section className="space-y-2">
                    <div className="font-medium">Remote Team Standards</div>
                    {remoteTeamStandardsTemplates.map(template => (
                        <button
                            key={template.id}
                            className="secondary-btn text-xs px-2 py-1 mr-1 mb-1"
                            onClick={() => {
                                void onApplyTemplate(template.updates)
                                    .then(() => setStatus(`Applied: ${template.name}`))
                                    .catch(() => setStatus(`Apply failed: ${template.name}`));
                            }}
                        >
                            Apply {template.name}
                        </button>
                    ))}
                </section>
                <section className="space-y-2">
                    <div className="font-medium">Changelog Highlights</div>
                    {workspaceChangelogHighlights.map(item => <div key={item}>• {item}</div>)}
                    <div className="font-medium mt-2">Walkthrough scripts</div>
                    {walkthroughScripts.map(script => <div key={script}>• {script}</div>)}
                </section>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <section className="space-y-2">
                    <div className="font-medium">Agent Debate</div>
                    <input
                        value={debateTopic}
                        onChange={event => setDebateTopic(event.target.value)}
                        placeholder={t('placeholder.enterTopic')}
                        className="w-full rounded border border-border/40 bg-background px-2 py-1"
                    />
                    <button className="secondary-btn text-xs px-2 py-1" onClick={runDebate}>
                        Run debate
                    </button>
                    {debateOutput && (
                        <pre className="max-h-24 overflow-auto rounded border border-border/40 bg-background p-2 whitespace-pre-wrap">
                            {debateOutput}
                        </pre>
                    )}
                    {debateHistory.length > 0 && (
                        <div className="max-h-16 overflow-auto text-muted-foreground">
                            {debateHistory.map(item => <div key={item}>• {item}</div>)}
                        </div>
                    )}
                </section>
                <section className="space-y-2">
                    <div className="font-medium">Cross-project Memory</div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={memorySyncEnabled}
                            onChange={event => {
                                const next = event.target.checked;
                                setMemorySyncEnabled(next);
                                localStorage.setItem(memoryStorageKey, JSON.stringify({ enabled: next, scope: memoryAccessScope }));
                            }}
                        />
                        Sync related-project memory
                    </label>
                    <select
                        value={memoryAccessScope}
                        onChange={event => {
                            const nextScope = event.target.value as 'project' | 'related-projects';
                            setMemoryAccessScope(nextScope);
                            localStorage.setItem(memoryStorageKey, JSON.stringify({ enabled: memorySyncEnabled, scope: nextScope }));
                        }}
                        className="w-full rounded border border-border/40 bg-background px-2 py-1"
                    >
                        <option value="project">Project-only access</option>
                        <option value="related-projects">Related-projects namespace</option>
                    </select>
                    <div className="text-muted-foreground">Versioning: enabled | Merge conflict strategy: latest+manual review</div>
                </section>
                <section className="space-y-2">
                    <div className="font-medium">Agent Metrics</div>
                    <div>Completion rate: {agentMetrics.completionRate}%</div>
                    <div>Efficiency score: {agentMetrics.efficiencyScore}</div>
                    <div>Health score: {agentMetrics.healthScore}</div>
                    <button
                        className="secondary-btn text-xs px-2 py-1"
                        onClick={() => {
                            const next = {
                                completionRate: Math.min(99, agentMetrics.completionRate + 1),
                                efficiencyScore: Math.min(99, agentMetrics.efficiencyScore + 1),
                                healthScore: Math.min(99, agentMetrics.healthScore + 1),
                            };
                            setAgentMetrics(next);
                            localStorage.setItem(agentMetricsStorageKey, JSON.stringify(next));
                        }}
                    >
                        Recompute metrics
                    </button>
                    <div className="text-muted-foreground">Insights: prioritize overloaded agents and rebalance active tasks.</div>
                </section>
            </div>
            {status && <div className="text-muted-foreground">{status}</div>}
        </div>
    );
};
