export type WorkflowStage = 'setup' | 'research' | 'generation' | 'review' | 'history'

export interface IdeasPageProps {
    language: string
}

export interface IdeaWithSession {
    sessionId: string
    sessionStatus: string
    sessionCreatedAt: number
    ideas: import('@shared/types/ideas').ProjectIdea[]
}
