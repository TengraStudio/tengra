/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as React from 'react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { LayoutManager } from '@/components/layout/LayoutManager';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { SessionLockOverlay } from '@/components/layout/SessionLockOverlay';
import { StatusBarProvider } from '@/components/layout/StatusBar';
import StatusBar from '@/components/layout/StatusBar';
import { ToastsContainer } from '@/components/layout/ToastsContainer';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ErrorFallback } from '@/components/shared/ErrorFallback';
import { useAuthSettingsUi } from '@/context/AuthContext';
import {
    useChatComposer,
    useChatHeader,
    useChatShell,
    useChatWindowCommand,
} from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { useWorkspaceSelection } from '@/context/WorkspaceContext';
import { useTextToSpeech } from '@/features/chat/hooks/useTextToSpeech';
import { useVoiceInput } from '@/features/chat/hooks/useVoiceInput';
import { ChatTemplate } from '@/features/chat/types';
import { SettingsCategory } from '@/features/settings/types';
import { useVoiceActions } from '@/features/voice/hooks/useVoiceActions';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { AppView, useAppState } from '@/hooks/useAppState';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useLanguage, useTranslation } from '@/i18n';
import { useBreakpoint } from '@/lib/responsive';
import { useMarketplaceStore } from '@/store/marketplace.store';
import { trackResponsiveBreakpoint } from '@/store/responsive-analytics.store';


// Lazy load heavy layout components
const AppHeader = lazy(() => import('@/components/layout/AppHeader').then(m => ({ default: m.MemoizedAppHeader })));
const AppModals = lazy(() => import('@/components/layout/AppModals').then(m => ({ default: m.AppModals })));
const Sidebar = lazy(() => import('@/components/layout/Sidebar').then(m => ({ default: m.Sidebar })));
const UpdateNotification = lazy(() => import('@/components/layout/UpdateNotification').then(m => ({ default: m.UpdateNotification })));
const VoiceOverlay = lazy(() => import('@/features/voice/components/VoiceOverlay').then(m => ({ default: m.VoiceOverlay })));
const DetachedTerminalWindow = lazy(() => import('@/features/terminal/components/DetachedTerminalWindow').then(m => ({ default: m.DetachedTerminalWindow })));
const ViewManager = lazy(() => import('@/views/ViewManager').then(m => ({ default: m.ViewManager })));

const shellFallback = <div className="h-full w-full bg-background" />;
const layoutSectionFallback = <div className="h-full min-h-0 flex-1 bg-background" />;


function useDeferredNonCriticalUi(): boolean {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let timeoutId: number | null = null;
        let frameId = 0;

        const setReady = () => {
            if (cancelled) {
                return;
            }
            setIsReady(true);
        };

        frameId = window.requestAnimationFrame(() => {
            const requestIdle = (window as Window & {
                requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
            }).requestIdleCallback;
            if (requestIdle) {
                requestIdle(() => {
                    setReady();
                }, { timeout: 2_000 });
            } else {
                timeoutId = window.setTimeout(() => {
                    setReady();
                }, 1_500);
            }
        });

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(frameId);
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, []);

    return isReady;
}

const getChatTemplates = (t: (key: string) => string): ChatTemplate[] => [
    {
        id: 'code',
        icon: 'Code',
        iconColor: 'text-primary',
        title: t('frontend.templates.code.title'),
        description: t('frontend.templates.code.description'),
        prompt: t('frontend.templates.code.prompt'),
    },
    {
        id: 'analyze',
        icon: 'FileSearch',
        iconColor: 'text-success',
        title: t('frontend.templates.analyze.title'),
        description: t('frontend.templates.analyze.description'),
        prompt: t('frontend.templates.analyze.prompt'),
    },
    {
        id: 'creative',
        icon: 'Sparkles',
        iconColor: 'text-purple',
        title: t('frontend.templates.creative.title'),
        description: t('frontend.templates.creative.description'),
        prompt: t('frontend.templates.creative.prompt'),
    },
    {
        id: 'debug',
        icon: 'Bug',
        iconColor: 'text-destructive',
        title: t('frontend.templates.debug.title'),
        description: t('frontend.templates.debug.description'),
        prompt: t('frontend.templates.debug.prompt'),
    },
];

const isDetachedTerminalWindow = new URLSearchParams(window.location.search).get('detachedTerminal') === '1';

const SidebarConnector: React.FC<{
    currentView: AppView;
    isCollapsed: boolean;
    onChangeView: (view: AppView) => void;
    toggleSidebar: () => void;
}> = ({ currentView, isCollapsed, onChangeView, toggleSidebar }) => {
    return (
        <Suspense fallback={layoutSectionFallback}>
            <Sidebar
                currentView={currentView}
                onChangeView={onChangeView}
                isCollapsed={isCollapsed}
                toggleSidebar={toggleSidebar}
                onSearch={() => { }}
            />
        </Suspense>
    );
};

const AppModalsConnector: React.FC<{
    t: (key: string) => string;
    language: ReturnType<typeof useLanguage>['language'];
    setCurrentView: (view: AppView) => void;
    showShortcuts: boolean;
    setShowShortcuts: (show: boolean) => void;
    isAudioOverlayOpen: boolean;
    setIsAudioOverlayOpen: (open: boolean) => void;
    showSSHManager: boolean;
    setShowSSHManager: (show: boolean) => void;
}> = ({
    t,
    language,
    setCurrentView,
    showShortcuts,
    setShowShortcuts,
    isAudioOverlayOpen,
    setIsAudioOverlayOpen,
    showSSHManager,
    setShowSSHManager,
}) => {
        const { handleAntigravityLogout, isAuthModalOpen, setIsAuthModalOpen, setSettingsCategory } =
            useAuthSettingsUi();
        const { setInput } = useChatComposer();
        const handleVoiceInput = useCallback((text: string) => {
            setInput(prev => prev + text);
        }, [setInput]);
        const { isListening, startListening, stopListening } = useVoiceInput(handleVoiceInput);
        const { stop: handleStopSpeak, isSpeaking } = useTextToSpeech();

        return (
            <Suspense fallback={null}>
                <AppModals
                    isAuthModalOpen={isAuthModalOpen}
                    setIsAuthModalOpen={setIsAuthModalOpen}
                    t={t}
                    handleAntigravityLogout={handleAntigravityLogout}
                    setSettingsCategory={setSettingsCategory}
                    setCurrentView={setCurrentView}
                    showShortcuts={showShortcuts}
                    setShowShortcuts={setShowShortcuts}
                    isAudioOverlayOpen={isAudioOverlayOpen}
                    setIsAudioOverlayOpen={setIsAudioOverlayOpen}
                    isListening={isListening}
                    startListening={startListening}
                    stopListening={stopListening}
                    isSpeaking={isSpeaking}
                    handleStopSpeak={handleStopSpeak}
                    language={language}
                    showSSHManager={showSSHManager}
                    setShowSSHManager={setShowSSHManager}
                />
            </Suspense>
        );
    };

const VoiceActionsConnector: React.FC<{
    setCurrentView: (view: AppView) => void;
    addToast: (toast: { type: 'info'; message: string }) => void;
}> = ({ setCurrentView, addToast }) => {
    const { createNewChat } = useChatShell();
    const { handleSend, setInput } = useChatComposer();

    useVoiceActions({
        setCurrentView: view => setCurrentView(view),
        addToast: toast => addToast(toast),
        createNewChat,
        handleSend,
        setInput: value => setInput(value),
    });

    return null;
};

const KeyboardShortcutsConnector: React.FC<{
    showShortcuts: boolean;
    setShowShortcuts: (show: boolean) => void;
    showSSHManager: boolean;
    setShowSSHManager: (show: boolean) => void;
    setCurrentView: (view: AppView) => void;
    onToggleSidebar: () => void;
    onOpenSettings: (category?: SettingsCategory) => void;
}> = ({
    showShortcuts,
    setShowShortcuts,
    showSSHManager,
    setShowSSHManager,
    setCurrentView,
    onToggleSidebar,
    onOpenSettings,
}) => {
        const { createNewChat } = useChatShell();
        const { currentChatId, clearMessages } = useChatHeader();

        const keyboardShortcutsConfig = useMemo(
            () => ({
                onNewChat: createNewChat,
                onOpenSettings: () => {
                    onOpenSettings('general');
                },
                onShowShortcuts: () => {
                    setShowShortcuts(true);
                },
                onClearChat: () => {
                    void clearMessages();
                },
                onSwitchView: (view: AppView) => {
                    setCurrentView(view);
                },
                onToggleSidebar: () => {
                    onToggleSidebar();
                },
                onZoomIn: () => {
                    void window.electron.stepZoomFactor(1);
                },
                onZoomOut: () => {
                    void window.electron.stepZoomFactor(-1);
                },
                onResetZoom: () => {
                    void window.electron.resetZoomFactor();
                },
                onCloseModals: () => {
                    setShowShortcuts(false);
                    setShowSSHManager(false);
                },
                showShortcuts,
                showSSHManager,
                currentChatId,
            }),
            [
                clearMessages,
                createNewChat,
                currentChatId,
                onOpenSettings,
                onToggleSidebar,
                setCurrentView,
                setShowShortcuts,
                setShowSSHManager,
                showShortcuts,
                showSSHManager,
            ]
        );

        useKeyboardShortcuts(keyboardShortcutsConfig);
        return null;
    };

const WindowAppCommandConnector: React.FC<{
    setShowSSHManager: (show: boolean) => void;
}> = ({ setShowSSHManager }) => {
    const { clearMessages, lastAssistantMessageText } = useChatWindowCommand();

    useEffect(() => {
        const handleClearChat = () => {
            void clearMessages();
        };
        const handleOpenSshManager = () => {
            setShowSSHManager(true);
        };
        const handleCopyLastResponse = () => {
            if (lastAssistantMessageText.trim()) {
                void navigator.clipboard.writeText(lastAssistantMessageText);
            }
        };

        window.addEventListener('app:clear-chat', handleClearChat as EventListener);
        window.addEventListener('app:open-ssh-manager', handleOpenSshManager as EventListener);
        window.addEventListener('app:copy-last-response', handleCopyLastResponse as EventListener);

        return () => {
            window.removeEventListener('app:clear-chat', handleClearChat as EventListener);
            window.removeEventListener('app:open-ssh-manager', handleOpenSshManager as EventListener);
            window.removeEventListener('app:copy-last-response', handleCopyLastResponse as EventListener);
        };
    }, [clearMessages, lastAssistantMessageText, setShowSSHManager]);

    return null;
};

const SelectionPersistenceConnector: React.FC<{
    setIsSidebarCollapsed: (collapsed: boolean) => void;
}> = ({ setIsSidebarCollapsed }) => {
    const { selectedModel } = useModel();
    const { selectedWorkspace } = useWorkspaceSelection();
    const lastWorkspaceId = React.useRef<string | null>(null);

    useEffect(() => {
        if (selectedModel) {
            localStorage.setItem('app.lastModel', selectedModel);
        }
    }, [selectedModel]);

    useEffect(() => {
        if (selectedWorkspace?.id) {
            localStorage.setItem('app.lastWorkspaceId', selectedWorkspace.id);
            
            // Auto-collapse sidebar when entering a specific workspace
            if (selectedWorkspace.id !== lastWorkspaceId.current) {
                setIsSidebarCollapsed(true);
                lastWorkspaceId.current = selectedWorkspace.id;
            }
        } else if (!selectedWorkspace) {
            lastWorkspaceId.current = null;
        }
    }, [selectedWorkspace, setIsSidebarCollapsed]);

    return null;
};

export default function App() {
    if (isDetachedTerminalWindow) {
        return (
            <Suspense fallback={shellFallback}>
                <DetachedTerminalWindow />
            </Suspense>
        );
    }

    return <MainApp />;
}

function MainApp() {
    const sessionTimeout = useSessionTimeout();
    const { language } = useLanguage();
    const { t } = useTranslation();
    const { isAuthModalOpen, setSettingsCategory } = useAuthSettingsUi();
    const { selectedWorkspace } = useWorkspaceSelection();
    const appState = useAppState();
    const {
        currentView,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        addToast,
        setCurrentView,
    } = appState;
    const breakpoint = useBreakpoint();
    const settingsSearchQuery = '';
    const updateCount = useMarketplaceStore(s => s.updateCount);
    const setSettingsCategoryRef = React.useRef(setSettingsCategory);
    useEffect(() => {
        setSettingsCategoryRef.current = setSettingsCategory;
    }, [setSettingsCategory]);

    const hasNavigatedToUpdates = React.useRef(false);

    const nonCriticalUiReady = useDeferredNonCriticalUi();
    useAppInitialization();
    const shouldRenderAppModals =
        nonCriticalUiReady ||
        isAuthModalOpen ||
        appState.showShortcuts ||
        appState.isAudioOverlayOpen ||
        appState.showSSHManager;



    const lastBreakpoint = React.useRef(breakpoint);
    const lastViewRef = React.useRef(currentView);

    useEffect(() => {
        if (lastBreakpoint.current !== breakpoint || !isSidebarCollapsed) {
            trackResponsiveBreakpoint({
                breakpoint,
                width: window.innerWidth,
                height: window.innerHeight,
            });
            lastBreakpoint.current = breakpoint;
        }
        document.documentElement.setAttribute('data-breakpoint', breakpoint);
        if (breakpoint === 'mobile' && !isSidebarCollapsed) {
            setIsSidebarCollapsed(true);
        }
    }, [breakpoint, isSidebarCollapsed, setIsSidebarCollapsed]);

    useEffect(() => {
        if (currentView === 'workspace' && lastViewRef.current !== 'workspace') {
            setIsSidebarCollapsed(true);
        }
        lastViewRef.current = currentView;
    }, [currentView, setIsSidebarCollapsed]);

    const handleScrollToBottom = () => {
        const ref = appState.messagesEndRef.current;
        if (ref) {
            ref.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleToggleSidebar = useCallback(() => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    }, [isSidebarCollapsed, setIsSidebarCollapsed]);

    const openSettings = useCallback((category?: SettingsCategory) => {
        if (category) {
            setSettingsCategory(category);
        }
        setCurrentView('settings');
    }, [setCurrentView, setSettingsCategory]);

    // Auto-navigate to extensions if updates are available on startup
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (nonCriticalUiReady && updateCount > 0 && !hasNavigatedToUpdates.current) {
            hasNavigatedToUpdates.current = true;
            // Delay slightly to ensure UI is ready
            timer = setTimeout(() => {
                setSettingsCategoryRef.current('extensions');
                setCurrentView('settings');
            }, 500); // Increased delay for stability
        }
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [nonCriticalUiReady, updateCount, setCurrentView]);

    const chatTemplates = useMemo(() => getChatTemplates(t), [t]);

    return (
        <ErrorBoundary
            resetKeys={[appState.currentView]}
            fallbackRender={({ error, resetErrorBoundary }) => (
                <div className="app-container h-screen w-full overflow-hidden">
                    <div className="absolute inset-0 flex flex-col overflow-hidden">
                        <LayoutManager
                            isSidebarCollapsed={appState.isSidebarCollapsed}
                            setIsSidebarCollapsed={appState.setIsSidebarCollapsed}
                            sidebarContent={
                                <SidebarConnector
                                    currentView={appState.currentView}
                                    onChangeView={setCurrentView}
                                    isCollapsed={appState.isSidebarCollapsed}
                                    toggleSidebar={handleToggleSidebar}
                                />
                            }
                            mainContent={
                                <>
                                    <Suspense fallback={null}>
                                        <AppHeader
                                            currentView={appState.currentView}
                                            onOpenSettings={() => { openSettings(); }}
                                        />
                                    </Suspense>
                                    <ErrorFallback
                                        error={error || new Error(t('frontend.errors.unexpected'))}
                                        resetErrorBoundary={() => {
                                            resetErrorBoundary();
                                            window.location.reload();
                                        }}
                                    />
                                </>
                            }
                        />
                    </div>
                </div>
            )}
        >
            <StatusBarProvider>
                <div className="app-container h-screen w-full overflow-hidden">
                    <OfflineBanner />

                    {shouldRenderAppModals && (
                        <AppModalsConnector
                            t={t}
                            setCurrentView={setCurrentView}
                            showShortcuts={appState.showShortcuts}
                            setShowShortcuts={appState.setShowShortcuts}
                            isAudioOverlayOpen={appState.isAudioOverlayOpen}
                            setIsAudioOverlayOpen={appState.setIsAudioOverlayOpen}
                            language={language}
                            showSSHManager={appState.showSSHManager}
                            setShowSSHManager={appState.setShowSSHManager}
                        />
                    )}
                    <WindowAppCommandConnector
                        setShowSSHManager={appState.setShowSSHManager}
                    />
                    {nonCriticalUiReady && (
                        <>
                            <SelectionPersistenceConnector setIsSidebarCollapsed={setIsSidebarCollapsed} />
                            <VoiceActionsConnector
                                setCurrentView={setCurrentView}
                                addToast={toast => addToast(toast)}
                            />
                            <KeyboardShortcutsConnector
                                showShortcuts={appState.showShortcuts}
                                setShowShortcuts={appState.setShowShortcuts}
                                showSSHManager={appState.showSSHManager}
                                setShowSSHManager={appState.setShowSSHManager}
                                setCurrentView={setCurrentView}
                                onToggleSidebar={handleToggleSidebar}
                                onOpenSettings={openSettings}
                            />
                            <Suspense fallback={null}>
                                <UpdateNotification />
                            </Suspense>
                        </>
                    )}
                    <ToastsContainer toasts={appState.toasts} removeToast={appState.removeToast} />
                    <div className="absolute inset-0 flex flex-col overflow-hidden">
                        <LayoutManager
                            isSidebarCollapsed={appState.isSidebarCollapsed}
                            setIsSidebarCollapsed={appState.setIsSidebarCollapsed}
                            sidebarContent={
                                <SidebarConnector
                                    currentView={appState.currentView}
                                    onChangeView={setCurrentView}
                                    isCollapsed={appState.isSidebarCollapsed}
                                    toggleSidebar={handleToggleSidebar}
                                />
                            }
                                mainContent={
                                    <>
                                        <Suspense fallback={null}>
                                            <AppHeader
                                                currentView={appState.currentView}
                                                onOpenSettings={() => { openSettings(); }}
                                            />
                                        </Suspense>
                                        <Suspense fallback={layoutSectionFallback}>
                                            <ViewManager
                                                currentView={currentView}
                                                templates={chatTemplates}
                                                messagesEndRef={appState.messagesEndRef}
                                                fileInputRef={appState.fileInputRef}
                                                textareaRef={appState.textareaRef}
                                                onScrollToBottom={handleScrollToBottom}
                                                showScrollButton={appState.showScrollButton}
                                                setShowScrollButton={appState.setShowScrollButton}
                                                showFileMenu={appState.showFileMenu}
                                                setShowFileMenu={appState.setShowFileMenu}
                                                settingsSearchQuery={settingsSearchQuery}
                                            />
                                        </Suspense>
                                        <div id="modal-root" />
                                    </>
                                }
                            />
                    </div>
                    <SessionLockOverlay
                        isOpen={sessionTimeout.isEnabled && sessionTimeout.isLocked}
                        lockedAt={sessionTimeout.lockedAt}
                        canUseBiometric={sessionTimeout.canUseBiometric}
                        onUnlock={sessionTimeout.unlock}
                    />
                    {nonCriticalUiReady && (
                        <Suspense fallback={null}>
                            <VoiceOverlay />
                        </Suspense>
                    )}
                </div>
            </StatusBarProvider>
        </ErrorBoundary>
    );
}

