import { VotingAnalytics, VotingConfiguration, VotingSession, VotingTemplate } from '@shared/types/project-agent';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

interface AgentVotingPanelProps {
    taskId?: string;
}

const VOTING_REFRESH_INTERVAL_MS = 4000;

export const AgentVotingPanel: React.FC<AgentVotingPanelProps> = ({ taskId }) => {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState<VotingSession[]>([]);
    const [analytics, setAnalytics] = useState<VotingAnalytics | null>(null);
    const [votingConfiguration, setVotingConfiguration] = useState<VotingConfiguration | null>(null);
    const [templates, setTemplates] = useState<VotingTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [overrideDecision, setOverrideDecision] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [isOverriding, setIsOverriding] = useState(false);

    const selectedSession = useMemo(
        () => sessions.find(session => session.id === selectedSessionId) ?? null,
        [sessions, selectedSessionId]
    );

    const disagreementDetails = useMemo(() => {
        if (!selectedSession) {
            return [];
        }
        const counts = new Map<string, number>();
        for (const vote of selectedSession.votes) {
            counts.set(vote.decision, (counts.get(vote.decision) ?? 0) + 1);
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [selectedSession]);

    const refreshVotingData = useCallback(async () => {
        try {
            const [sessionList, analyticsResult, configResult, templateResult] = await Promise.all([
                window.electron.projectAgent.listVotingSessions(taskId),
                window.electron.projectAgent.getVotingAnalytics(taskId),
                window.electron.projectAgent.getVotingConfiguration(),
                window.electron.projectAgent.listVotingTemplates()
            ]);
            setSessions(sessionList);
            setAnalytics(analyticsResult);
            setVotingConfiguration(configResult);
            setTemplates(templateResult);
            if (sessionList.length > 0 && !sessionList.some(session => session.id === selectedSessionId)) {
                setSelectedSessionId(sessionList[0]?.id ?? '');
            }
            if (templateResult.length > 0 && !templateResult.some(template => template.id === selectedTemplateId)) {
                setSelectedTemplateId(templateResult[0]?.id ?? '');
            }
        } catch (error) {
            appLogger.error('AgentVotingPanel', 'Failed to refresh voting data', error as Error);
        }
    }, [taskId, selectedSessionId, selectedTemplateId]);

    useEffect(() => {
        void refreshVotingData();
        const intervalId = window.setInterval(() => {
            void refreshVotingData();
        }, VOTING_REFRESH_INTERVAL_MS);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [refreshVotingData]);

    useEffect(() => {
        if (selectedSession && !overrideDecision) {
            setOverrideDecision(selectedSession.finalDecision ?? selectedSession.options[0] ?? '');
        }
    }, [selectedSession, overrideDecision]);

    const handleOverride = async (): Promise<void> => {
        if (!selectedSession || !overrideDecision || isOverriding) {
            return;
        }
        setIsOverriding(true);
        try {
            await window.electron.projectAgent.overrideVotingDecision({
                sessionId: selectedSession.id,
                finalDecision: overrideDecision,
                reason: overrideReason.trim() || undefined
            });
            setOverrideReason('');
            await refreshVotingData();
        } catch (error) {
            appLogger.error('AgentVotingPanel', 'Failed to override voting decision', error as Error);
        } finally {
            setIsOverriding(false);
        }
    };

    return (
        <div className="rounded-xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('projectAgent.votingPanel.title')}</h3>
                <span className="text-xs text-muted-foreground">
                    {t('projectAgent.votingPanel.sessionCount', { count: analytics?.totalSessions ?? 0 })}
                </span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-muted p-2 text-center">
                    <div className="font-semibold">{analytics?.pendingSessions ?? 0}</div>
                    <div className="text-muted-foreground">{t('projectAgent.votingPanel.pending')}</div>
                </div>
                <div className="rounded-md bg-muted p-2 text-center">
                    <div className="font-semibold">{analytics?.resolvedSessions ?? 0}</div>
                    <div className="text-muted-foreground">{t('projectAgent.votingPanel.resolved')}</div>
                </div>
                <div className="rounded-md bg-muted p-2 text-center">
                    <div className="font-semibold">{analytics?.deadlockedSessions ?? 0}</div>
                    <div className="text-muted-foreground">{t('projectAgent.votingPanel.deadlocked')}</div>
                </div>
            </div>
            {votingConfiguration && (
                <p className="mb-2 text-[11px] text-muted-foreground">
                    {t('projectAgent.votingPanel.configSummary', {
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
                <p className="text-xs text-muted-foreground">{t('projectAgent.votingPanel.noSessions')}</p>
            ) : (
                <>
                    <select
                        value={selectedSessionId}
                        onChange={event => setSelectedSessionId(event.target.value)}
                        className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                        {sessions.map(session => (
                            <option key={session.id} value={session.id}>
                                {`${session.question} (${t(`projectAgent.votingPanel.status.${session.status}`)})`}
                            </option>
                        ))}
                    </select>

                    {selectedSession && (
                        <>
                            <div className="mb-2 space-y-1 text-xs">
                                <p className="font-medium">{selectedSession.question}</p>
                                <p className="text-muted-foreground">
                                    {t('projectAgent.votingPanel.votesCount', { count: selectedSession.votes.length })}
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
                                <p className="mb-1 font-medium">{t('projectAgent.votingPanel.disagreementDetails')}</p>
                                {disagreementDetails.length === 0 ? (
                                    <p className="text-muted-foreground">{t('projectAgent.votingPanel.noDisagreement')}</p>
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
                                <p className="font-medium">{t('projectAgent.votingPanel.manualOverride')}</p>
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
                                    placeholder={t('projectAgent.votingPanel.overrideReasonPlaceholder')}
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
                                        ? t('projectAgent.votingPanel.applyingOverride')
                                        : t('projectAgent.votingPanel.applyOverride')}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
