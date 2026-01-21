import { useEffect, useState } from 'react'

import { Language, useTranslation } from '@/i18n'
import { CouncilSession, Project } from '@/types'

import { useCouncilWS } from './useCouncilWS'
import { useProjectActions } from './useProjectActions'
import { useProjectState } from './useProjectState'
import { useWorkspaceManager } from './useWorkspaceManager'

interface UseProjectWorkspaceControllerProps {
    project: Project
    language: Language
    onUpdateProject?: (updates: Partial<Project>) => Promise<void>
}

export function useProjectWorkspaceController({
    project,
    language,
    onUpdateProject
}: UseProjectWorkspaceControllerProps) {
    const { t } = useTranslation(language)
    const ps = useProjectState()
    const { notify, logActivity } = ps

    const wm = useWorkspaceManager({ project, notify, logActivity })

    const [councilSession, setCouncilSession] = useState<CouncilSession | null>(null)
    const { activityLog, setActivityLog } = useCouncilWS({ councilSession, notify })

    const { handleUpdateProject, runCouncil } = useProjectActions({
        project,
        notify,
        t,
        onUpdateProject,
        agentChatMessage: ps.agentChatMessage,
        setCouncilSession,
        setActivityLog
    })

    useEffect(() => {
        if (wm.dashboardTab === 'council') {
            const timer = setTimeout(() => ps.setViewTab('council'), 0)
            return () => clearTimeout(timer)
        } else if (wm.dashboardTab === 'overview' || wm.dashboardTab === 'editor') {
            const timer = setTimeout(() => ps.setViewTab('editor'), 0)
            return () => clearTimeout(timer)
        }
        return undefined
    }, [wm.dashboardTab, ps])

    const toggleAgent = (id: string) => {
        ps.setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
    }

    return {
        ps,
        wm,
        councilSession,
        activityLog,
        setActivityLog,
        handleUpdateProject,
        runCouncil,
        toggleAgent,
        t
    }
}
