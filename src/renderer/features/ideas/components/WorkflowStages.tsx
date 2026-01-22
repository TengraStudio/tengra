import { IdeaSession, IdeaSessionConfig, ProjectIdea, ResearchStage } from '@shared/types/ideas'
import React from 'react'

import { WorkflowStage } from '../types'

import { IdeaGrid } from './IdeaGrid'
import { SessionInfo } from './SessionInfo'
import { SessionSetup } from './SessionSetup'
import { StageGeneration } from './StageGeneration'
import { StageResearch } from './StageResearch'

interface WorkflowStagesProps {
    workflowStage: WorkflowStage
    currentSession: IdeaSession | null
    researchStage: ResearchStage
    researchProgress: number
    researchMessage: string
    isSessionLoading: boolean
    isResearching: boolean
    isGenerating: boolean
    ideas: ProjectIdea[]
    setSelectedIdea: (idea: ProjectIdea) => void
    handleCreateSession: (config: IdeaSessionConfig) => Promise<void>
    startGeneration: (sessionId: string) => Promise<void>
    setWorkflowStage: (stage: WorkflowStage) => void
    t: (key: string) => string
}

const SetupStage: React.FC<Pick<WorkflowStagesProps, 'handleCreateSession' | 'isSessionLoading' | 'isResearching' | 'isGenerating'>> =
    ({ handleCreateSession, isSessionLoading, isResearching, isGenerating }) => (
        <SessionSetup
            onCreateSession={handleCreateSession}
            isLoading={isSessionLoading || isResearching || isGenerating}
        />
    )

const ReviewStage: React.FC<Pick<WorkflowStagesProps, 'currentSession' | 'ideas' | 'setSelectedIdea' | 't'>> =
    ({ currentSession, ideas, setSelectedIdea, t }) => (
        <div className="space-y-6">
            {currentSession && (
                <SessionInfo session={currentSession} ideasCount={ideas.length} t={t} />
            )}
            <IdeaGrid ideas={ideas} onSelectIdea={setSelectedIdea} />
        </div>
    )

export const WorkflowStages: React.FC<WorkflowStagesProps> = (props) => {
    const {
        workflowStage,
        currentSession,
        researchStage,
        researchProgress,
        researchMessage,
        isSessionLoading,
        isResearching,
        isGenerating,
        ideas,
        setSelectedIdea,
        handleCreateSession,
        startGeneration,
        setWorkflowStage,
        t
    } = props

    if (workflowStage === 'setup') {
        return <SetupStage handleCreateSession={handleCreateSession} isSessionLoading={isSessionLoading} isResearching={isResearching} isGenerating={isGenerating} />
    }
    if (workflowStage === 'research') {
        return (
            <StageResearch
                researchStage={researchStage}
                researchProgress={researchProgress}
                researchMessage={researchMessage}
                currentSessionId={currentSession?.id}
                isGenerating={isGenerating}
                startGeneration={startGeneration}
                setWorkflowStage={setWorkflowStage}
                t={t}
            />
        )
    }
    if (workflowStage === 'generation') {
        return (
            <StageGeneration
                isGenerating={isGenerating}
                ideasCount={ideas.length}
                maxIdeas={currentSession?.maxIdeas ?? 5}
                ideas={ideas}
                setSelectedIdea={setSelectedIdea}
                setWorkflowStage={setWorkflowStage}
                t={t}
            />
        )
    }
    return (
        <ReviewStage
            currentSession={currentSession}
            ideas={ideas}
            setSelectedIdea={setSelectedIdea}
            t={t}
        />
    )
}
