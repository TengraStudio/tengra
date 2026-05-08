/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Component, ErrorInfo, ReactNode } from 'react';

import { RuntimeBootstrapBoundary } from '@/components/runtime/RuntimeBootstrapBoundary';
import { DiagnosticsListener } from '@/components/system/DiagnosticsListener';
import { AuthProvider } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { LowPowerProvider } from '@/context/low-power.context';
import { ModelProvider } from '@/context/ModelContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { LanguageProvider, useTranslation } from '@/i18n';
import { RuntimeIconPackManager } from '@/themes/RuntimeIconPackManager';
import { RuntimeThemeManager } from '@/themes/RuntimeThemeManager';
import { appLogger } from '@/utils/renderer-logger';

interface ProviderBoundaryProps {
    providerName: string
    errorTitle: string
    providerFailedPrefix: string
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
                        <div className="text-destructive font-bold">{this.props.errorTitle}</div>
                        <p className="font-bold mb-1">
                            {this.props.providerFailedPrefix}: {this.props.providerName}
                        </p>
                        <p>{this.state.message}</p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

function LocalizedRuntimeProviders({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const errorTitle = t('frontend.appProviders.startupProviderCrash');
    const providerFailedPrefix = t('frontend.appProviders.providerFailedPrefix');

    return (
        <RuntimeBootstrapBoundary>
            <ProviderBoundary
                providerName="AuthProvider"
                errorTitle={errorTitle}
                providerFailedPrefix={providerFailedPrefix}
            >
                <AuthProvider>
                    <ProviderBoundary
                        providerName="ThemeProvider"
                        errorTitle={errorTitle}
                        providerFailedPrefix={providerFailedPrefix}
                    >
                        <ThemeProvider>
                            <ProviderBoundary
                                providerName="ModelProvider"
                                errorTitle={errorTitle}
                                providerFailedPrefix={providerFailedPrefix}
                            >
                                <ModelProvider>
                                    <ProviderBoundary
                                        providerName="WorkspaceProvider"
                                        errorTitle={errorTitle}
                                        providerFailedPrefix={providerFailedPrefix}
                                    >
                                        <WorkspaceProvider>
                                            <ProviderBoundary
                                                providerName="ChatProvider"
                                                errorTitle={errorTitle}
                                                providerFailedPrefix={providerFailedPrefix}
                                            >
                                                <ChatProvider>
                                                    <DiagnosticsListener />
                                                    <RuntimeThemeManager />
                                                    <RuntimeIconPackManager />
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
        </RuntimeBootstrapBoundary>
    );
}

export function AppProviders({ children }: { children: ReactNode }) {
    const { t: tEn } = useTranslation('en');
    const errorTitle = tEn('appProviders.startupProviderCrash');
    const providerFailedPrefix = tEn('appProviders.providerFailedPrefix');

    return (
        <ProviderBoundary
            providerName="SettingsProvider"
            errorTitle={errorTitle}
            providerFailedPrefix={providerFailedPrefix}
        >
            <SettingsProvider>
                <ProviderBoundary
                    providerName="LowPowerProvider"
                    errorTitle={errorTitle}
                    providerFailedPrefix={providerFailedPrefix}
                >
                    <LowPowerProvider>
                        <ProviderBoundary
                            providerName="LanguageProvider"
                            errorTitle={errorTitle}
                            providerFailedPrefix={providerFailedPrefix}
                        >
                            <LanguageProvider>
                                <LocalizedRuntimeProviders>{children}</LocalizedRuntimeProviders>
                            </LanguageProvider>
                        </ProviderBoundary>
                    </LowPowerProvider>
                </ProviderBoundary>
            </SettingsProvider>
        </ProviderBoundary>
    );
}

