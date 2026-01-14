import { useProjectManager } from '@renderer/features/projects/hooks/useProjectManager'
import { createContext, ReactNode,useContext } from 'react'

type ProjectContextType = ReturnType<typeof useProjectManager>

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
    const projectManager = useProjectManager()

    return (
        <ProjectContext.Provider value={projectManager}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const context = useContext(ProjectContext)
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider')
    }
    return context
}
