import { AuthProvider } from '@renderer/context/AuthContext'
import { ChatProvider } from '@renderer/context/ChatContext'
import { ModelProvider } from '@renderer/context/ModelContext'
import { ProjectProvider } from '@renderer/context/ProjectContext'
import { ThemeProvider } from '@renderer/context/ThemeContext'
import { ReactNode } from 'react'

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <AuthProvider>
            <ThemeProvider>
                <ModelProvider>
                    <ProjectProvider>
                        <ChatProvider>
                            {children}
                        </ChatProvider>
                    </ProjectProvider>
                </ModelProvider>
            </ThemeProvider>
        </AuthProvider>
    )
}
