import {
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
} from '@shared/types/automation-workflow';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

const VOTING_REFRESH_INTERVAL_MS = 4000;

interface UseSessionCouncilVotingResult {
    analytics: VotingAnalytics | null;
    disagreementDetails: Array<[string, number]>;
    handleOverride: () => Promise<void>;
    isOverriding: boolean;
    overrideDecision: string;
    overrideReason: string;
    selectedSession: VotingSession | null;
    selectedSessionId: string;
    selectedTemplateId: string;
    sessions: VotingSession[];
    templates: VotingTemplate[];
    votingConfiguration: VotingConfiguration | null;
    setOverrideDecision: (decision: string) => void;
    setOverrideReason: (reason: string) => void;
    setSelectedSessionId: (sessionId: string) => void;
    setSelectedTemplateId: (templateId: string) => void;
}

interface CouncilVotingSnapshot {
    analytics: VotingAnalytics;
    sessions: VotingSession[];
    templates: VotingTemplate[];
    votingConfiguration: VotingConfiguration;
}

function buildDisagreementDetails(selectedSession: VotingSession | null): Array<[string, number]> {
    if (!selectedSession) {
        return [];
    }

    const counts = new Map<string, number>();
    for (const vote of selectedSession.votes) {
        counts.set(vote.decision, (counts.get(vote.decision) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
}

function selectActiveId<T extends { id: string }>(currentId: string, records: T[]): string {
    if (records.length === 0) {
        return '';
    }
    if (records.some(record => record.id === currentId)) {
        return currentId;
    }
    return records[0]?.id ?? '';
}

async function fetchCouncilVotingSnapshot(taskId?: string): Promise<CouncilVotingSnapshot> {
    const [sessions, analytics, votingConfiguration, templates] = await Promise.all([
        window.electron.session.council.listVotingSessions(taskId),
        window.electron.session.council.getVotingAnalytics(taskId),
        window.electron.session.council.getVotingConfiguration(),
        window.electron.session.council.listVotingTemplates(),
    ]);
    return {
        analytics,
        sessions,
        templates,
        votingConfiguration,
    };
}

export function useSessionCouncilVoting(taskId?: string): UseSessionCouncilVotingResult {
    const [sessions, setSessions] = useState<VotingSession[]>([]);
    const [analytics, setAnalytics] = useState<VotingAnalytics | null>(null);
    const [votingConfiguration, setVotingConfiguration] = useState<VotingConfiguration | null>(null);
    const [templates, setTemplates] = useState<VotingTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [overrideDecision, setOverrideDecision] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [isOverriding, setIsOverriding] = useState(false);

    const selectedSession = useMemo(() => {
        return sessions.find(session => session.id === selectedSessionId) ?? null;
    }, [sessions, selectedSessionId]);

    const disagreementDetails = useMemo(() => {
        return buildDisagreementDetails(selectedSession);
    }, [selectedSession]);

    const refreshVotingData = useCallback(async () => {
        try {
            const snapshot = await fetchCouncilVotingSnapshot(taskId);
            setSessions(snapshot.sessions);
            setAnalytics(snapshot.analytics);
            setVotingConfiguration(snapshot.votingConfiguration);
            setTemplates(snapshot.templates);
            setSelectedSessionId(currentId => selectActiveId(currentId, snapshot.sessions));
            setSelectedTemplateId(currentId => selectActiveId(currentId, snapshot.templates));
        } catch (error) {
            appLogger.error('useSessionCouncilVoting', 'Failed to refresh voting data', error as Error);
        }
    }, [taskId]);

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
    }, [overrideDecision, selectedSession]);

    const handleOverride = useCallback(async (): Promise<void> => {
        if (!selectedSession || !overrideDecision || isOverriding) {
            return;
        }

        setIsOverriding(true);
        try {
            await window.electron.session.council.overrideVotingDecision({
                sessionId: selectedSession.id,
                finalDecision: overrideDecision,
                reason: overrideReason.trim() || undefined,
            });
            setOverrideReason('');
            await refreshVotingData();
        } catch (error) {
            appLogger.error('useSessionCouncilVoting', 'Failed to override voting decision', error as Error);
        } finally {
            setIsOverriding(false);
        }
    }, [isOverriding, overrideDecision, overrideReason, refreshVotingData, selectedSession]);

    return {
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
    };
}

