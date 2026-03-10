import type { FC } from 'react';

import { useTranslation } from '@/i18n';

import { useSessionCouncilVoting } from './hooks/useSessionCouncilVoting';

interface AgentVotingPanelProps {
    taskId?: string;
}

export const AgentVotingPanel: FC<AgentVotingPanelProps> = ({ taskId }) => {
    const { t } = useTranslation();
    const {
        analytics,
        disagreementDetails,
        handleOverride,
        isOverriding,
        overrideDecision,
        overrideReason,
        selectedSession,
        selectedSessionId,
        selectedTemplateId,
        sessions,
        templates,
        votingConfiguration,
        setOverrideDecision,
        setOverrideReason,
        setSelectedSessionId,
        setSelectedTemplateId,
    } = useSessionCouncilVoting(taskId);

    return (
        <div className="rounded-xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('workspaceAgent.votingPanel.title')}</h3>
                <span className="text-xs text-muted-foreground">
                    {t('workspaceAgent.votingPanel.sessionCount', { count: analytics?.totalSessions ?? 0 })}
                </span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-muted p-2 text-center">
                    <div className="font-semibold">{analytics?.pendingSessions ?? 0}</div>
                    <div className="text-muted-foreground">{t('workspaceAgent.votingPanel.pending')}</div>
                </div>
                <div className="rounded-md bg-muted p-2 text-center">
                    <div className="font-semibold">{analytics?.resolvedSessions ?? 0}</div>
                    <div className="text-muted-foreground">{t('workspaceAgent.votingPanel.resolved')}</div>
                </div>
                <div className="rounded-md bg-muted p-2 text-center">
                    <div className="font-semibold">{analytics?.deadlockedSessions ?? 0}</div>
                    <div className="text-muted-foreground">{t('workspaceAgent.votingPanel.deadlocked')}</div>
                </div>
            </div>
            {votingConfiguration && (
                <p className="mb-2 text-[11px] text-muted-foreground">
                    {t('workspaceAgent.votingPanel.configSummary', {
                        minVotes: votingConfiguration.minimumVotes,
                        deadlock: Math.round(votingConfiguration.deadlockThreshold * 100)
                    })}
                </p>
            )}
            {templates.length > 0 && (
                <select
                    value={selectedTemplateId}
                    onChange={event => setSelectedTemplateId(event.target.value)}
                    className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                    {templates.map(template => (
                        <option key={template.id} value={template.id}>
                            {template.name}
                        </option>
                    ))}
                </select>
            )}

            {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('workspaceAgent.votingPanel.noSessions')}</p>
            ) : (
                <>
                    <select
                        value={selectedSessionId}
                        onChange={event => setSelectedSessionId(event.target.value)}
                        className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                        {sessions.map(session => (
                            <option key={session.id} value={session.id}>
                                {`${session.question} (${t(`workspaceAgent.votingPanel.status.${session.status}`)})`}
                            </option>
                        ))}
                    </select>

                    {selectedSession && (
                        <>
                            <div className="mb-2 space-y-1 text-xs">
                                <p className="font-medium">{selectedSession.question}</p>
                                <p className="text-muted-foreground">
                                    {t('workspaceAgent.votingPanel.votesCount', { count: selectedSession.votes.length })}
                                </p>
                            </div>

                            <ul className="mb-2 max-h-28 space-y-1 overflow-y-auto text-xs">
                                {selectedSession.votes.map(vote => (
                                    <li key={`${vote.modelId}-${vote.timestamp}`} className="rounded-md border border-border p-2">
                                        <div className="flex justify-between">
                                            <span>{`${vote.provider}/${vote.modelId}`}</span>
                                            <span className="text-muted-foreground">{`${vote.confidence}%`}</span>
                                        </div>
                                        <div>{vote.decision}</div>
                                    </li>
                                ))}
                            </ul>

                            <div className="mb-2 rounded-md border border-border p-2 text-xs">
                                <p className="mb-1 font-medium">{t('workspaceAgent.votingPanel.disagreementDetails')}</p>
                                {disagreementDetails.length === 0 ? (
                                    <p className="text-muted-foreground">{t('workspaceAgent.votingPanel.noDisagreement')}</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {disagreementDetails.map(([decision, count]) => (
                                            <li key={decision} className="flex justify-between">
                                                <span>{decision}</span>
                                                <span className="text-muted-foreground">{count}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="space-y-1 text-xs">
                                <p className="font-medium">{t('workspaceAgent.votingPanel.manualOverride')}</p>
                                <select
                                    value={overrideDecision}
                                    onChange={event => setOverrideDecision(event.target.value)}
                                    className="w-full rounded-md border border-border bg-background px-2 py-1"
                                >
                                    {selectedSession.options.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                                <input
                                    value={overrideReason}
                                    onChange={event => setOverrideReason(event.target.value)}
                                    placeholder={t('workspaceAgent.votingPanel.overrideReasonPlaceholder')}
                                    className="w-full rounded-md border border-border bg-background px-2 py-1"
                                />
                                <button
                                    onClick={() => {
                                        void handleOverride();
                                    }}
                                    className="w-full rounded-md bg-primary px-2 py-1 text-primary-foreground"
                                    disabled={isOverriding || !overrideDecision}
                                >
                                    {isOverriding
                                        ? t('workspaceAgent.votingPanel.applyingOverride')
                                        : t('workspaceAgent.votingPanel.applyOverride')}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
