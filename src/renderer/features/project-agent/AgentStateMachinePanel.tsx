import { ProjectState } from '@shared/types/project-agent';
import React from 'react';

import { useTranslation } from '@/i18n';

interface StateHistoryEntry {
    status: ProjectState['status'];
    timestamp: number;
}

interface AgentStateMachinePanelProps {
    currentStatus: ProjectState['status'];
    stateHistory: StateHistoryEntry[];
}

const STATE_ORDER: ProjectState['status'][] = [
    'idle',
    'planning',
    'waiting_for_approval',
    'running',
    'paused',
    'completed',
    'failed',
    'error'
];

const TRANSITIONS: Record<ProjectState['status'], ProjectState['status'][]> = {
    idle: ['planning'],
    planning: ['waiting_for_approval', 'running', 'failed', 'error'],
    waiting_for_approval: ['running', 'paused', 'failed'],
    running: ['paused', 'completed', 'failed', 'error'],
    paused: ['running', 'failed'],
    completed: ['idle'],
    failed: ['idle'],
    error: ['idle']
};

export const AgentStateMachinePanel: React.FC<AgentStateMachinePanelProps> = ({
    currentStatus,
    stateHistory
}) => {
    const { t } = useTranslation();
    const recentTransitions = [...stateHistory].reverse().slice(0, 6);
    const allowedTransitions = TRANSITIONS[currentStatus] ?? [];

    return (
        <div className="rounded-xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('projectAgent.statePanel.title')}</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                    {t(`projectAgent.statePanel.status.${currentStatus}`)}
                </span>
            </div>

            <div className="mb-3">
                <p className="mb-1 text-xs text-muted-foreground">
                    {t('projectAgent.statePanel.currentState')}
                </p>
                <div className="flex flex-wrap gap-1">
                    {STATE_ORDER.map(status => (
                        <span
                            key={status}
                            className={`rounded-md px-2 py-1 text-xs ${
                                status === currentStatus
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {t(`projectAgent.statePanel.status.${status}`)}
                        </span>
                    ))}
                </div>
            </div>

            <div className="mb-3">
                <p className="mb-1 text-xs text-muted-foreground">
                    {t('projectAgent.statePanel.allowedTransitions')}
                </p>
                {allowedTransitions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        {t('projectAgent.statePanel.noTransitions')}
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {allowedTransitions.map(status => (
                            <span key={status} className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                                {t(`projectAgent.statePanel.status.${status}`)}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <p className="mb-1 text-xs text-muted-foreground">
                    {t('projectAgent.statePanel.recentTransitions')}
                </p>
                {recentTransitions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        {t('projectAgent.statePanel.noHistory')}
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {recentTransitions.map((entry, index) => (
                            <li key={`${entry.status}-${entry.timestamp}-${index}`} className="flex items-center justify-between text-xs">
                                <span>{t(`projectAgent.statePanel.status.${entry.status}`)}</span>
                                <span className="text-muted-foreground">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
