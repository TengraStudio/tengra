import { useProjectManager } from '@renderer/features/projects/hooks/useProjectManager';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type ProjectContextType = ReturnType<typeof useProjectManager>

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
    const projectManager = useProjectManager();

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => projectManager, [projectManager]);

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
}
