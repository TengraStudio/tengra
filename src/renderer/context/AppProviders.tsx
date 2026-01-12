import { ReactNode } from 'react'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from './ThemeContext'
import { ModelProvider } from './ModelContext'
import { ChatProvider } from './ChatContext'
import { ProjectProvider } from './ProjectContext'

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
