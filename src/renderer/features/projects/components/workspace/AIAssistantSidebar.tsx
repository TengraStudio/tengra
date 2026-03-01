import { MessageBubble } from '@renderer/features/chat/components/MessageBubble';
import { ChatErrorBanner } from '@renderer/features/projects/components/workspace/ChatErrorBanner';
import { AgentTaskHistoryItem } from '@shared/types/project-agent';
import { ArrowLeft, Check, ClipboardList, Play, Users } from 'lucide-react';
import React from 'react';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { Language } from '@/i18n';
import { motion } from '@/lib/framer-motion-compat';
import type { GroupedModels } from '@/types';
import { AppSettings, ChatError, CodexUsage, Message, QuotaResponse } from '@/types';

interface AIAssistantSidebarProps {
    projectId: string;
    selectedProvider: string;
    selectedModel: string;
    onSelectModel: (provider: string, model: string) => void;
    settings: AppSettings;
    groupedModels: GroupedModels;
    quotas: { accounts: QuotaResponse[] } | null;
    codexUsage: { accounts: { usage: CodexUsage }[] } | null;
    agentChatMessage: string;
    setAgentChatMessage: (val: string) => void;
    onSendMessage?: (content?: string) => void;
    t: (key: string) => string;
    messages?: Message[] | undefined;
    isLoading?: boolean | undefined;
    chatError?: ChatError | null;
    language: string;
    onSourceClick?: ((path: string) => void) | undefined;
}

type AssistantMode = 'agent' | 'plan' | 'council';

interface SessionSummary {
    id: string;
    title: string;
    status: AgentTaskHistoryItem['status'];
    updatedAt: number;
}

/**
 * AIAssistantSidebar Component
 *
 * The right panel of the workspace, which can show:
 * - AI Chat interface
 * - Integrated Model Selection
 */
export const AIAssistantSidebar: React.FC<AIAssistantSidebarProps> = ({
    projectId,
    selectedProvider,
    selectedModel,
    onSelectModel,
    settings,
    groupedModels,
    quotas,
    codexUsage,
    agentChatMessage,
    setAgentChatMessage,
    onSendMessage,
    t,
    messages = [],
    isLoading,
    chatError,
    language,
    onSourceClick,
}) => {
    const [assistantMode, setAssistantMode] = React.useState<AssistantMode>('agent');
    const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
    const [selectedSessionId, setSelectedSessionId] = React.useState<string>('');
    const [proposalSteps, setProposalSteps] = React.useState<Array<{ id: string; text: string; status?: string }>>([]);
    const [timelineEvents, setTimelineEvents] = React.useState<Array<Record<string, unknown>>>([]);
    const [approvalChecked, setApprovalChecked] = React.useState(false);
    const [rejectReason, setRejectReason] = React.useState('');
    const [rejectionHistory, setRejectionHistory] = React.useState<string[]>([]);
    const [timelineFilter, setTimelineFilter] = React.useState({
        stage: '',
        agent: '',
        model: '',
        interrupt: '',
    });

    const loadProjectSessions = React.useCallback(async () => {
        const history = await window.electron.projectAgent.getTaskHistory(projectId);
        const mapped = history
            .map(item => ({
                id: item.id,
                title: item.description || item.id,
                status: item.status,
                updatedAt: item.updatedAt,
            }))
            .sort((left, right) => right.updatedAt - left.updatedAt);
        setSessions(mapped);
        setSelectedSessionId(prev => prev || mapped[0]?.id || '');
    }, [projectId]);

    React.useEffect(() => {
        void loadProjectSessions();
    }, [loadProjectSessions]);

    React.useEffect(() => {
        const key = `workspace.council.reject.history:${projectId}`;
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                setRejectionHistory(JSON.parse(stored) as string[]);
            }
        } catch {
            setRejectionHistory([]);
        }
    }, [projectId]);

    React.useEffect(() => {
        const loadModeData = async () => {
            if (!selectedSessionId) {
                setProposalSteps([]);
                setTimelineEvents([]);
                return;
            }
            if (assistantMode === 'plan') {
                const proposal = await window.electron.projectAgent.council.getProposal(selectedSessionId);
                const steps = (proposal.plan ?? []).map((step, index) => ({
                    id: step.id ?? `step-${index + 1}`,
                    text: step.text ?? '',
                    status: step.status,
                }));
                setProposalSteps(steps);
            }
            if (assistantMode === 'council') {
                const timeline = await window.electron.projectAgent.council.getTimeline(selectedSessionId);
                setTimelineEvents(timeline.events ?? []);
            }
        };
        void loadModeData();
    }, [assistantMode, selectedSessionId]);

    const fallbackChain = React.useMemo(() => {
        const providerGroup = groupedModels[selectedProvider];
        if (!providerGroup) {
            return [] as string[];
        }
        return providerGroup.models.slice(0, 3).map(model => `${selectedProvider}/${model.id}`);
    }, [groupedModels, selectedProvider]);

    const filteredTimelineEvents = React.useMemo(() => {
        return timelineEvents.filter(event => {
            const stage = String(event['stageId'] ?? '');
            const agent = String(event['agentId'] ?? event['actor'] ?? '');
            const model = String(event['model'] ?? '');
            const interrupt = String(event['interruptType'] ?? '');
            return (
                (!timelineFilter.stage || stage.includes(timelineFilter.stage))
                && (!timelineFilter.agent || agent.includes(timelineFilter.agent))
                && (!timelineFilter.model || model.includes(timelineFilter.model))
                && (!timelineFilter.interrupt || interrupt.includes(timelineFilter.interrupt))
            );
        });
    }, [timelineEvents, timelineFilter]);

    const handleSend = () => {
        if (!agentChatMessage.trim() || !onSendMessage) {
            return;
        }
        onSendMessage(agentChatMessage);
        setAgentChatMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const renderModeContent = () => {
        if (assistantMode === 'agent') {
            return (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {chatError && (
                            <ChatErrorBanner
                                errorKind={chatError.kind}
                                onRetry={() => {
                                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                                    if (lastUserMsg) {
                                        onSendMessage?.(typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '');
                                    }
                                }}
                            />
                        )}
                        {messages.length === 0 ? (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 text-primary" />
                                </div>
                                <div className="bg-muted/30 rounded-2xl rounded-tl-none p-3 text-sm text-muted-foreground">
                                    {t('agents.welcomeMessage')}
                                </div>
                            </div>
                        ) : (
                            messages.map((m: Message, idx: number) => (
                                <MessageBubble
                                    key={m.id || idx}
                                    message={m}
                                    isLast={idx === messages.length - 1}
                                    language={language as Language}
                                    isStreaming={Boolean(
                                        isLoading &&
                                        idx === messages.length - 1 &&
                                        m.role === 'assistant'
                                    )}
                                    onSourceClick={onSourceClick}
                                />
                            ))
                        )}
                    </div>

                    <div className="p-3 border-t border-white/5 bg-background/50 shrink-0">
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                className="flex-1 bg-muted/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                                placeholder={t('workspace.writeSomething')}
                                value={agentChatMessage}
                                onChange={e => setAgentChatMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!agentChatMessage.trim() || isLoading || !onSendMessage}
                                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ArrowLeft className="w-4 h-4 rotate-180" />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (assistantMode === 'plan') {
            const estimatedMinutes = Math.max(1, proposalSteps.length * 2);
            const quotaImpact = `${proposalSteps.length * 1500} tokens`;
            return (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    <div className="rounded-xl border border-white/10 bg-muted/20 p-3 space-y-2">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Execution Proposal</div>
                        <div className="text-xs text-muted-foreground">
                            {selectedProvider}/{selectedModel}
                        </div>
                        <div className="text-xs text-muted-foreground">Fallback: {fallbackChain.join(' -> ') || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                            Quota impact: {quotaImpact} | ETA: {estimatedMinutes}m
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-background/40 p-3">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Stages</div>
                        <div className="space-y-2">
                            {proposalSteps.length === 0 && (
                                <div className="text-xs text-muted-foreground">No proposal loaded for this session.</div>
                            )}
                            {proposalSteps.map((step, index) => (
                                <div key={step.id} className="rounded-lg border border-white/10 px-2 py-2 text-xs">
                                    <div className="font-medium">{index + 1}. {step.text || step.id}</div>
                                    <div className="text-muted-foreground">{step.status || 'pending'}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={approvalChecked}
                            onChange={event => setApprovalChecked(event.target.checked)}
                        />
                        <span>I approve this plan and model usage</span>
                    </label>

                    <div className="flex gap-2">
                        <button
                            className="flex-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold disabled:opacity-50"
                            disabled={!selectedSessionId || !approvalChecked}
                            onClick={() => {
                                void window.electron.projectAgent.council.approveProposal(selectedSessionId);
                                void window.electron.projectAgent.council.startExecution(selectedSessionId);
                            }}
                        >
                            <Play className="inline-block w-3 h-3 mr-1" />
                            Approve and Start
                        </button>
                        <button
                            className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs"
                            disabled={!selectedSessionId}
                            onClick={() => {
                                const reason = rejectReason || 'Rejected by operator';
                                const nextHistory = [
                                    `${new Date().toISOString()} | ${selectedSessionId} | ${reason}`,
                                    ...rejectionHistory,
                                ].slice(0, 30);
                                setRejectionHistory(nextHistory);
                                localStorage.setItem(
                                    `workspace.council.reject.history:${projectId}`,
                                    JSON.stringify(nextHistory)
                                );
                                void window.electron.projectAgent.council.rejectProposal(
                                    selectedSessionId,
                                    reason
                                );
                            }}
                        >
                            Reject
                        </button>
                    </div>
                    <input
                        className="w-full bg-muted/20 border border-white/10 rounded-lg px-3 py-2 text-xs"
                        value={rejectReason}
                        onChange={event => setRejectReason(event.target.value)}
                        placeholder={t('placeholder.rejectReason')}
                    />
                    {rejectionHistory.length > 0 && (
                        <div className="rounded-lg border border-white/10 p-2 space-y-1 max-h-24 overflow-y-auto">
                            {rejectionHistory.map(item => (
                                <div key={item} className="text-xxs text-muted-foreground truncate">{item}</div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="grid grid-cols-2 gap-2">
                    <input
                        className="bg-muted/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs"
                        value={timelineFilter.stage}
                        onChange={event => setTimelineFilter(prev => ({ ...prev, stage: event.target.value }))}
                        placeholder={t('placeholder.stage')}
                    />
                    <input
                        className="bg-muted/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs"
                        value={timelineFilter.agent}
                        onChange={event => setTimelineFilter(prev => ({ ...prev, agent: event.target.value }))}
                        placeholder={t('placeholder.agent')}
                    />
                    <input
                        className="bg-muted/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs"
                        value={timelineFilter.model}
                        onChange={event => setTimelineFilter(prev => ({ ...prev, model: event.target.value }))}
                        placeholder={t('placeholder.model')}
                    />
                    <input
                        className="bg-muted/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs"
                        value={timelineFilter.interrupt}
                        onChange={event => setTimelineFilter(prev => ({ ...prev, interrupt: event.target.value }))}
                        placeholder={t('placeholder.interrupt')}
                    />
                </div>

                <div className="rounded-xl border border-white/10 bg-background/40 p-3 space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Live Assignment Board</div>
                    {proposalSteps.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No active assignments.</div>
                    ) : (
                        proposalSteps.map((step, index) => (
                            <div key={step.id} className="flex items-center justify-between text-xs border-b border-white/5 py-1">
                                <span>{index + 1}. {step.text || step.id}</span>
                                <span className="text-muted-foreground">{step.status || 'pending'}</span>
                            </div>
                        ))
                    )}
                </div>

                <div className="rounded-xl border border-white/10 bg-background/40 p-3 space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Agent Health</div>
                    <div className="text-xs text-muted-foreground">Heartbeat: {timelineEvents.length > 0 ? 'active' : 'idle'}</div>
                    <div className="text-xs text-muted-foreground">Last output: {timelineEvents.length > 0 ? 'recent' : 'none'}</div>
                    <div className="text-xs text-muted-foreground">Failure count: {filteredTimelineEvents.filter(event => String(event['type'] ?? '').includes('failed')).length}</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-background/40 p-3 space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Timeline</div>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                        {filteredTimelineEvents.length === 0 && (
                            <div className="text-xs text-muted-foreground">No timeline events for selected filters.</div>
                        )}
                        {filteredTimelineEvents.map((event, index) => (
                            <div key={`${event['id'] ?? index}`} className="rounded border border-white/10 px-2 py-2 text-xs">
                                <div className="font-medium">{String(event['type'] ?? 'event')}</div>
                                <div className="text-muted-foreground truncate">{JSON.stringify(event)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    className="w-full rounded-lg border border-warning/50 text-warning px-3 py-2 text-xs font-semibold"
                    disabled={!selectedSessionId}
                    onClick={() => {
                        void window.electron.projectAgent.council.pauseExecution(selectedSessionId);
                    }}
                >
                    Manual Intervention
                </button>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-white/5 bg-background/40 backdrop-blur-xl flex flex-col shrink-0 shadow-2xl overflow-visible h-full"
        >
            <div className="h-12 border-b border-white/5 flex items-center px-4 bg-white/[0.02] shrink-0 overflow-visible relative z-50">
                <div className="flex items-center gap-2 shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-xxs font-bold uppercase tracking-widest text-muted-foreground">
                        {t('workspace.aiLabel')}
                    </span>
                </div>
                <div className="flex-1 flex justify-end">
                    <ModelSelector
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSelect={onSelectModel}
                        settings={settings}
                        groupedModels={groupedModels}
                        quotas={quotas}
                        codexUsage={codexUsage}
                    />
                </div>
            </div>

            <div className="h-10 border-b border-white/5 grid grid-cols-3 gap-1 p-1">
                {(['agent', 'plan', 'council'] as AssistantMode[]).map(mode => (
                    <button
                        key={mode}
                        className={`rounded-md text-xs font-medium capitalize transition-colors ${assistantMode === mode
                            ? 'bg-primary/20 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            }`}
                        onClick={() => setAssistantMode(mode)}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 flex">
                <div className="w-36 border-r border-white/5 p-2 space-y-2 overflow-y-auto">
                    <button
                        className="w-full rounded-md border border-white/10 px-2 py-1.5 text-xs text-left hover:bg-white/5"
                        onClick={() => {
                            void loadProjectSessions();
                        }}
                    >
                        <Check className="inline-block w-3 h-3 mr-1" />
                        Refresh
                    </button>
                    <div className="text-xxs uppercase tracking-wider text-muted-foreground px-1">
                        <ClipboardList className="inline-block w-3 h-3 mr-1" />
                        Sessions
                    </div>
                    <div className="space-y-1">
                        {sessions.length === 0 && (
                            <div className="text-xs text-muted-foreground px-1">No project sessions yet.</div>
                        )}
                        {sessions.map(session => (
                            <button
                                key={session.id}
                                onClick={() => {
                                    setSelectedSessionId(session.id);
                                    setApprovalChecked(false);
                                }}
                                className={`w-full text-left rounded-md px-2 py-1.5 border text-xs transition-colors ${session.id === selectedSessionId
                                    ? 'bg-primary/10 border-primary/30 text-foreground'
                                    : 'bg-background/20 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                <div className="truncate font-medium">{session.title}</div>
                                <div className="truncate text-xxs opacity-80">{session.status}</div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                    {renderModeContent()}
                </div>
            </div>

            <div className="h-8 border-t border-white/5 px-3 flex items-center justify-between text-xxs text-muted-foreground">
                <span>{selectedSessionId ? selectedSessionId.slice(0, 8) : 'No session'}</span>
                <span>{assistantMode}</span>
            </div>
        </motion.div>
    );
};
