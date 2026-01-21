import { ActivityEntry, CouncilSession, Project } from '@/types'

interface UseProjectActionsProps {
    project: Project
    notify: (type: 'success' | 'error' | 'info', message: string) => void
    t: (key: string) => string
    onUpdateProject?: (updates: Partial<Project>) => Promise<void>
    agentChatMessage: string
    setCouncilSession: (session: CouncilSession | null) => void
    setActivityLog: (logs: ActivityEntry[]) => void
}

export function useProjectActions({
    project: _project,
    notify,
    t,
    onUpdateProject,
    agentChatMessage,
    setCouncilSession,
    setActivityLog
}: UseProjectActionsProps) {
    const handleUpdateProject = async (updates: Partial<Project>) => {
        if (onUpdateProject) {
            await onUpdateProject(updates)
            notify('success', t('workspace.projectUpdated'))
        }
    }

    const runCouncil = async () => {
        if (!agentChatMessage.trim()) { return }
        try {
            notify('info', 'Initializing Council Session...')
            const session = await window.electron.council.createSession(agentChatMessage)
            if (session) {
                setCouncilSession(session)
                setActivityLog([])
                window.electron.council.startLoop(session.id)
                notify('success', 'Council started.')
            }
        } catch (e: unknown) {
            notify('error', 'Failed to start council: ' + (e instanceof Error ? e.message : 'Unknown error'))
        }
    }

    return { handleUpdateProject, runCouncil }
}
