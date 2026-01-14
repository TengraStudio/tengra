import { ReactNode } from 'react'
import { AuthProvider } from '@renderer/context/AuthContext'
import { ThemeProvider } from '@renderer/context/ThemeContext'
import { ModelProvider } from '@renderer/context/ModelContext'
import { ChatProvider } from '@renderer/context/ChatContext'
import { ProjectProvider } from '@renderer/context/ProjectContext'

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
