import { useWorkspaceListManager } from '@renderer/features/workspace/hooks/useWorkspaceListManager';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type WorkspaceContextType = ReturnType<typeof useWorkspaceListManager>

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const workspaceManager = useWorkspaceListManager();

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => workspaceManager, [workspaceManager]);

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
