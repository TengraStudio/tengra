/**
 * Simplified workflow sync hook with reduced complexity
 */
import type { IdeaSessionStatus } from '@shared/types/ideas';
import { IdeaSession } from '@shared/types/ideas';
import { useMemo, useState } from 'react';

import type { WorkflowStage } from '../types';

/**
 * Maps session status to workflow stage
 */
function statusToStage(status: IdeaSessionStatus | undefined): WorkflowStage {
    if (!status) {
        return 'setup';
    }
    if (status === 'completed') {
        return 'review';
    }
    if (status === 'generating') {
        return 'generation';
    }
    return 'research';
}

/**
 * Custom hook to sync workflow stage with current session status.
 * Derives stage from session status without needing effects.
 */
export function useWorkflowSync(currentSession: IdeaSession | null): [WorkflowStage, (stage: WorkflowStage) => void] {
    const [overrideStage, setOverrideStage] = useState<WorkflowStage | null>(null);

    // Derive workflow stage from session or use override
    const workflowStage = useMemo(() => {
        if (overrideStage !== null) {
            return overrideStage;
        }
        return statusToStage(currentSession?.status);
    }, [currentSession?.status, overrideStage]);

    return [workflowStage, setOverrideStage];
}
