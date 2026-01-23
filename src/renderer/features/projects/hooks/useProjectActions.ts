import { ActivityEntry, CouncilSession, Project } from '@/types'

export interface ProjectActionsProps {
    project: Project
    notify: (type: 'success' | 'error' | 'info', message: string) => void
    t: (key: string) => string
    onUpdateProject?: (updates: Partial<Project>) => Promise<void>
    agentChatMessage?: string
    setCouncilSession: (session: CouncilSession | null) => void
    setActivityLog: (log: ActivityEntry[] | ((prev: ActivityEntry[]) => ActivityEntry[])) => void
}

export function useProjectActions({
    project,
    notify,
    t,
    onUpdateProject,
    agentChatMessage,
    setCouncilSession,
    setActivityLog
}: ProjectActionsProps) {
    const handleUpdateProject = async (updates: Partial<Project>) => {
        try {
            if (onUpdateProject) {
                await onUpdateProject(updates)
            }
        } catch (error) {
            console.error('[ProjectActions] Update failed:', error)
            notify('error', t('projectDashboard.updateFailed') || 'Failed to update project')
        }
    }

    const runCouncil = async () => {
        if (!agentChatMessage) {
            notify('error', 'Please provide a message for the agents')
            return
        }

        try {
            notify('info', t('projectDashboard.startingCouncil') || 'Starting Council AI session...')
            const session = await window.electron.ipcRenderer.invoke('council:create', agentChatMessage) as CouncilSession
            setCouncilSession(session)
            setActivityLog([])
            window.electron.ipcRenderer.send('council:start-loop', session.id)
            notify('success', t('projectDashboard.councilStarted') || 'Council AI session started')
        } catch (error) {
            console.error('[ProjectActions] Start Council failed:', error)
            notify('error', t('projectDashboard.councilFailed') || 'Failed to start Council session')
        }
    }

    return {
        handleUpdateProject,
        runCouncil
    }
}
