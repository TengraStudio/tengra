import { ReactNode } from 'react'
import { AuthProvider } from './AuthContext'
import { ModelProvider } from './ModelContext'
import { ChatProvider } from './ChatContext'
import { ProjectProvider } from './ProjectContext'

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            <ModelProvider>
                <ProjectProvider>
                    <ChatProvider>
                        {children}
                    </ChatProvider>
                </ProjectProvider>
            </ModelProvider>
        </AuthProvider>
    )
}
