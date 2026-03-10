import { LanguageProvider } from '@renderer/i18n';
import { Component, ErrorInfo, ReactNode } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { LowPowerProvider } from '@/context/low-power.context';
import { ModelProvider } from '@/context/ModelContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { appLogger } from '@/utils/renderer-logger';

interface ProviderBoundaryProps {
    providerName: string
    children: ReactNode
}

interface ProviderBoundaryState {
    hasError: boolean
    message: string
}

class ProviderBoundary extends Component<ProviderBoundaryProps, ProviderBoundaryState> {
    state: ProviderBoundaryState = {
        hasError: false,
        message: ''
    };

    static getDerivedStateFromError(error: Error): ProviderBoundaryState {
        return {
            hasError: true,
            message: error.message
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        appLogger.error(
            'ProviderBoundary',
            `Provider failed: ${this.props.providerName}`,
            error
        );
        appLogger.error(
            'ProviderBoundary',
            `Provider stack (${this.props.providerName}): ${errorInfo.componentStack}`,
            error
        );
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground p-6">
                    <div className="max-w-3xl rounded-lg border border-destructive/40 bg-card p-5 font-mono text-sm">
                        <div className="text-destructive font-bold">Startup Provider Crash</div>
                        <div className="mt-2">Provider: {this.props.providerName}</div>
                        <div className="mt-2 break-words">{this.state.message}</div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ProviderBoundary providerName="SettingsProvider">
            <SettingsProvider>
                <ProviderBoundary providerName="LowPowerProvider">
                    <LowPowerProvider>
                        <ProviderBoundary providerName="LanguageProvider">
                            <LanguageProvider>
                                <ProviderBoundary providerName="AuthProvider">
                                    <AuthProvider>
                                        <ProviderBoundary providerName="ThemeProvider">
                                            <ThemeProvider>
                                                <ProviderBoundary providerName="ModelProvider">
                                                    <ModelProvider>
                                                        <ProviderBoundary providerName="WorkspaceProvider">
                                                            <WorkspaceProvider>
                                                                <ProviderBoundary providerName="ChatProvider">
                                                                    <ChatProvider>
                                                                        {children}
                                                                    </ChatProvider>
                                                                </ProviderBoundary>
                                                            </WorkspaceProvider>
                                                        </ProviderBoundary>
                                                    </ModelProvider>
                                                </ProviderBoundary>
                                            </ThemeProvider>
                                        </ProviderBoundary>
                                    </AuthProvider>
                                </ProviderBoundary>
                            </LanguageProvider>
                        </ProviderBoundary>
                    </LowPowerProvider>
                </ProviderBoundary>
            </SettingsProvider>
        </ProviderBoundary>
    );
}
