import { ReactNode } from 'react'

import { AuthProvider } from '@/context/AuthContext'
import { ChatProvider } from '@/context/ChatContext'
import { ModelProvider } from '@/context/ModelContext'
import { ProjectProvider } from '@/context/ProjectContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { ThemeProvider } from '@/context/ThemeContext'

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <SettingsProvider>
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
        </SettingsProvider>
    )
}
