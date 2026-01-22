/**
 * Main Ideas Page component with workflow state machine
 */
import { IdeaSession, IdeaSessionConfig, IdeaSessionStatus, ProjectIdea } from '@shared/types/ideas'
import React, { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@/i18n'

import {
    IdeaDetailsModal,
    IdeasHeader,
    SessionHistory,
    WorkflowStages
} from './components'
import { useIdeaApproval, useIdeaGeneration, useIdeaSession, useLogoGeneration } from './hooks'
import { WorkflowStage } from './types'

const IdeasError: React.FC<{ error: string | null }> = ({ error }) => {
    if (!error) {
        return null
    }
    return (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
            {error}
        </div>
    )
}

/**
 * Custom hook to sync workflow stage with current session status.
 * Uses the adjustment during render pattern to avoid useEffect cascading renders.
 */
function useWorkflowSync(currentSession: IdeaSession | null) {
    const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('setup')
    const [prevSessionId, setPrevSessionId] = useState<string | undefined>(undefined)
    const [prevStatus, setPrevStatus] = useState<IdeaSessionStatus | undefined>(undefined)

    if (currentSession?.id !== prevSessionId || currentSession?.status !== prevStatus) {
        setPrevSessionId(currentSession?.id)
        setPrevStatus(currentSession?.status)
        if (currentSession?.status) {
            const nextStage: WorkflowStage =
                currentSession.status === 'completed'
                    ? 'review'
                    : currentSession.status === 'generating'
                        ? 'generation'
                        : 'research'
            setWorkflowStage(nextStage)
        } else if (!currentSession) {
            setWorkflowStage('setup')
        }
    }

    return [workflowStage, setWorkflowStage] as const
}

interface IdeasPageProps {
    language: string
}

export const IdeasPage: React.FC<IdeasPageProps> = ({ language: _language }) => {
    const { t } = useTranslation()

    // Hooks
    const {
        sessions,
        currentSession,
        isLoading: isSessionLoading,
        error: sessionError,
        createSession,
        loadSessions,
        selectSession
    } = useIdeaSession()

    const {
        researchStage,
        researchProgress,
        researchMessage,
        isResearching,
        ideas,
        isGenerating,
        startResearch,
        startGeneration,
        loadIdeas,
        error: generationError
    } = useIdeaGeneration()

    const { isApproving, isRejecting, approveIdea, rejectIdea, error: approvalError } = useIdeaApproval()
    const { canGenerateLogo } = useLogoGeneration()

    // State management
    const [workflowStage, setWorkflowStage] = useWorkflowSync(currentSession)
    const [selectedIdea, setSelectedIdea] = useState<ProjectIdea | null>(null)

    // Load ideas when session changes
    useEffect(() => {
        if (currentSession?.id) {
            void loadIdeas(currentSession.id)
        }
    }, [currentSession?.id, loadIdeas])

    // Handle session creation
    const handleCreateSession = useCallback(
        async (config: IdeaSessionConfig) => {
            const session = await createSession(config)
            if (session) {
                setWorkflowStage('research')
                const researchData = await startResearch(session.id)
                if (researchData) {
                    setWorkflowStage('generation')
                    await startGeneration(session.id)
                    setWorkflowStage('review')
                }
            }
        },
        [createSession, startResearch, startGeneration, setWorkflowStage]
    )

    // Handle approval
    const handleApprove = useCallback(
        async (projectPath: string, selectedName?: string) => {
            if (!selectedIdea || !currentSession?.id) {
                return
            }
            const project = await approveIdea(selectedIdea.id, projectPath, selectedName)
            if (project) {
                setSelectedIdea(null)
                void loadIdeas(currentSession.id)
            }
        },
        [selectedIdea, approveIdea, currentSession, loadIdeas]
    )

    // Handle rejection
    const handleReject = useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return
        }
        const success = await rejectIdea(selectedIdea.id)
        if (success) {
            setSelectedIdea(null)
            void loadIdeas(currentSession.id)
        }
    }, [selectedIdea, rejectIdea, currentSession, loadIdeas])

    // Reset to start new session
    const handleNewSession = useCallback(() => {
        setWorkflowStage('setup')
        setSelectedIdea(null)
    }, [setWorkflowStage])

    // Show history view
    const handleShowHistory = useCallback(() => {
        void loadSessions()
        setWorkflowStage('history')
    }, [setWorkflowStage, loadSessions])

    // Select session from history
    const handleSelectSession = useCallback(async (sessionId: string) => {
        await selectSession(sessionId)
        setWorkflowStage('review')
    }, [selectSession, setWorkflowStage])

    const error = sessionError ?? generationError ?? approvalError

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto p-6">
                <IdeasHeader
                    workflowStage={workflowStage}
                    handleNewSession={handleNewSession}
                    handleShowHistory={handleShowHistory}
                    loadSessions={loadSessions}
                    t={t}
                />

                <IdeasError error={error} />

                {workflowStage === 'history' ? (
                    <SessionHistory
                        sessions={sessions}
                        onSelectIdea={setSelectedIdea}
                        onSelectSession={(id) => void handleSelectSession(id)}
                        t={t}
                    />
                ) : (
                    <WorkflowStages
                        workflowStage={workflowStage}
                        currentSession={currentSession}
                        researchStage={researchStage}
                        researchProgress={researchProgress}
                        researchMessage={researchMessage}
                        isSessionLoading={isSessionLoading}
                        isResearching={isResearching}
                        isGenerating={isGenerating}
                        ideas={ideas}
                        setSelectedIdea={setSelectedIdea}
                        handleCreateSession={handleCreateSession}
                        startGeneration={startGeneration}
                        setWorkflowStage={setWorkflowStage}
                        t={t}
                    />
                )}

                {selectedIdea && (
                    <IdeaDetailsModal
                        idea={selectedIdea}
                        onClose={() => setSelectedIdea(null)}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        isApproving={isApproving}
                        isRejecting={isRejecting}
                        canGenerateLogo={canGenerateLogo}
                    />
                )}
            </div>
        </div>
    )
}
