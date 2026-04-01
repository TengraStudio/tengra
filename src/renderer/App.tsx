import { MemoizedAppHeader as AppHeader } from '@renderer/components/layout/AppHeader';
import { AppModals } from '@renderer/components/layout/AppModals';
import { DragDropWrapper } from '@renderer/components/layout/DragDropWrapper';
import { LayoutManager } from '@renderer/components/layout/LayoutManager';
import { OfflineBanner } from '@renderer/components/layout/OfflineBanner';
import { SessionLockOverlay } from '@renderer/components/layout/SessionLockOverlay';
import { Sidebar } from '@renderer/components/layout/Sidebar';
import { ToastsContainer } from '@renderer/components/layout/ToastsContainer';
import { ErrorBoundary } from '@renderer/components/shared/ErrorBoundary';
import { ErrorFallback } from '@renderer/components/shared/ErrorFallback';
import { LanguageSelectionPrompt } from '@renderer/components/shared/LanguageSelectionPrompt';
import { validateDroppedFile } from '@renderer/features/chat/hooks/useAttachments';
import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech';
import { useVoiceInput } from '@renderer/features/chat/hooks/useVoiceInput';
import { ChatTemplate } from '@renderer/features/chat/types';
import { SettingsCategory } from '@renderer/features/settings/types';
import { useVoiceActions } from '@renderer/features/voice/hooks/useVoiceActions';
import { useAppInitialization } from '@renderer/hooks/useAppInitialization';
import { AppView, useAppState } from '@renderer/hooks/useAppState';
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts';
import { useSessionTimeout } from '@renderer/hooks/useSessionTimeout';
import { useLanguage, useTranslation } from '@renderer/i18n';
import { useBreakpoint } from '@renderer/lib/responsive';
import { trackResponsiveBreakpoint } from '@renderer/store/responsive-analytics.store';
import { ViewManager } from '@renderer/views/ViewManager';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { useAuthSettingsUi } from '@/context/AuthContext';
import {
    useChatComposer,
    useChatHeader,
    useChatLibrary,
    useChatShell,
    useChatWindowCommand,
} from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { useWorkspaceLibrary, useWorkspaceSelection } from '@/context/WorkspaceContext';

import '@renderer/App.css';

// Lazy load heavy layout components
const CommandPalette = lazy(() => import('@renderer/components/layout/CommandPalette').then(m => ({ default: m.CommandPalette })));
const UpdateNotification = lazy(() => import('@renderer/components/layout/UpdateNotification').then(m => ({ default: m.UpdateNotification })));
const QuickActionBar = lazy(() => import('@renderer/components/layout/QuickActionBar').then(m => ({ default: m.QuickActionBar })));
const VoiceOverlay = lazy(() => import('@renderer/features/voice/components/VoiceOverlay').then(m => ({ default: m.VoiceOverlay })));
const DetachedTerminalWindow = lazy(() => import('@renderer/features/terminal/components/DetachedTerminalWindow').then(m => ({ default: m.DetachedTerminalWindow })));
const OnboardingFlow = lazy(() => import('@renderer/features/onboarding/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })));

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
                }, { timeout: 500 });
            } else {
                timeoutId = window.setTimeout(() => {
                    setReady();
                }, 120);
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
        title: t('templates.code.title'),
        description: t('templates.code.description'),
        prompt: t('templates.code.prompt'),
    },
    {
        id: 'analyze',
        icon: 'FileSearch',
        iconColor: 'text-success',
        title: t('templates.analyze.title'),
        description: t('templates.analyze.description'),
        prompt: t('templates.analyze.prompt'),
    },
    {
        id: 'creative',
        icon: 'Sparkles',
        iconColor: 'text-purple',
        title: t('templates.creative.title'),
        description: t('templates.creative.description'),
        prompt: t('templates.creative.prompt'),
    },
    {
        id: 'debug',
        icon: 'Bug',
        iconColor: 'text-destructive',
        title: t('templates.debug.title'),
        description: t('templates.debug.description'),
        prompt: t('templates.debug.prompt'),
    },
];

const isDetachedTerminalWindow = new URLSearchParams(window.location.search).get('detachedTerminal') === '1';

interface RateLimitWarningPayload {
    provider?: string
    remaining?: number
    limit?: number
}

const SidebarConnector: React.FC<{
    currentView: AppView;
    isCollapsed: boolean;
    onChangeView: (view: AppView) => void;
    toggleSidebar: () => void;
}> = ({ currentView, isCollapsed, onChangeView, toggleSidebar }) => {
    const { setSettingsCategory } = useAuthSettingsUi();

    const handleOpenSettings = useCallback((category?: SettingsCategory) => {
        onChangeView('settings');
        if (category) {
            setSettingsCategory(category);
        }
    }, [onChangeView, setSettingsCategory]);

    return (
        <Sidebar
            currentView={currentView}
            onChangeView={onChangeView}
            isCollapsed={isCollapsed}
            toggleSidebar={toggleSidebar}
            onOpenSettings={handleOpenSettings}
            onSearch={() => { }}
        />
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
    showCommandPalette: boolean;
    setShowCommandPalette: (show: boolean) => void;
    showShortcuts: boolean;
    setShowShortcuts: (show: boolean) => void;
    showSSHManager: boolean;
    setShowSSHManager: (show: boolean) => void;
    setCurrentView: (view: AppView) => void;
    onToggleSidebar: () => void;
}> = ({
    showCommandPalette,
    setShowCommandPalette,
    showShortcuts,
    setShowShortcuts,
    showSSHManager,
    setShowSSHManager,
    setCurrentView,
    onToggleSidebar,
}) => {
    const { createNewChat } = useChatShell();
    const { currentChatId, clearMessages } = useChatHeader();
    const { setSettingsCategory } = useAuthSettingsUi();

    const keyboardShortcutsConfig = useMemo(
        () => ({
            onCommandPalette: () => {
                setShowCommandPalette(!showCommandPalette);
            },
            onNewChat: createNewChat,
            onOpenSettings: () => {
                setCurrentView('settings');
                setSettingsCategory('general');
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
                setShowCommandPalette(false);
                setShowShortcuts(false);
                setShowSSHManager(false);
            },
            showCommandPalette,
            showShortcuts,
            showSSHManager,
            currentChatId,
        }),
        [
            clearMessages,
            createNewChat,
            currentChatId,
            onToggleSidebar,
            setCurrentView,
            setSettingsCategory,
            setShowCommandPalette,
            setShowShortcuts,
            setShowSSHManager,
            showCommandPalette,
            showShortcuts,
            showSSHManager,
        ]
    );

    useKeyboardShortcuts(keyboardShortcutsConfig);
    return null;
};

const QuickActionBarConnector: React.FC<{
    language: ReturnType<typeof useLanguage>['language'];
    explainPrefix: string;
    translatePrefix: string;
}> = ({ language, explainPrefix, translatePrefix }) => {
    const { handleSend, setInput } = useChatComposer();

    return (
        <QuickActionBar
            onExplain={text => {
                setInput(`${explainPrefix}${text}`);
                void handleSend();
            }}
            onTranslate={text => {
                setInput(`${translatePrefix}${text}`);
                void handleSend();
            }}
            language={language}
        />
    );
};

const CommandPaletteConnector: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    setCurrentView: (view: AppView) => void;
    t: (key: string) => string;
}> = ({ isOpen, onClose, setCurrentView, t }) => {
    const { chats, setCurrentChatId } = useChatLibrary();
    const { clearMessages } = useChatHeader();
    const { createNewChat } = useChatShell();
    const { workspaces } = useWorkspaceLibrary();
    const { setSelectedWorkspace } = useWorkspaceSelection();
    const { models, loadModels, selectedModel, setSelectedModel } = useModel();
    const { setSettingsCategory } = useAuthSettingsUi();

    return (
        <CommandPalette
            isOpen={isOpen}
            onClose={onClose}
            chats={chats}
            onSelectChat={(chatId: string) => {
                setCurrentChatId(chatId);
                setCurrentView('chat');
            }}
            onNewChat={createNewChat}
            workspaces={workspaces}
            onSelectWorkspace={(id: string) => {
                const workspace = workspaces.find(item => item.id === id);
                if (workspace) {
                    setSelectedWorkspace(workspace);
                    setCurrentView('workspace');
                }
            }}
            onOpenSettings={(category?: SettingsCategory) => {
                setCurrentView('settings');
                if (category) {
                    setSettingsCategory(category);
                }
            }}
            onOpenSSHManager={() => {
                window.dispatchEvent(new CustomEvent('app:open-ssh-manager'));
            }}
            onRefreshModels={bypassCache => {
                void loadModels(bypassCache);
            }}
            models={models}
            onSelectModel={setSelectedModel}
            selectedModel={selectedModel}
            onClearChat={() => {
                void clearMessages();
            }}
            t={t}
        />
    );
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

const SelectionPersistenceConnector: React.FC = () => {
    const { selectedModel } = useModel();
    const { selectedWorkspace } = useWorkspaceSelection();

    useEffect(() => {
        if (selectedModel) {
            localStorage.setItem('app.lastModel', selectedModel);
        }
    }, [selectedModel]);

    useEffect(() => {
        if (selectedWorkspace?.id) {
            localStorage.setItem('app.lastWorkspaceId', selectedWorkspace.id);
        }
    }, [selectedWorkspace?.id]);

    return null;
};

const DragDropContent: React.FC<{
    isDragging: boolean;
    setIsDragging: (dragging: boolean) => void;
    addToast: (toast: { type: 'error'; message: string }) => void;
    currentView: AppView;
    templates: ChatTemplate[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    onScrollToBottom: () => void;
    showScrollButton: boolean;
    setShowScrollButton: (show: boolean) => void;
    showFileMenu: boolean;
    setShowFileMenu: (show: boolean) => void;
    settingsSearchQuery?: string;
}> = ({
    isDragging,
    setIsDragging,
    addToast,
    currentView,
    templates,
    messagesEndRef,
    fileInputRef,
    textareaRef,
    onScrollToBottom,
    showScrollButton,
    setShowScrollButton,
    showFileMenu,
    setShowFileMenu,
    settingsSearchQuery,
}) => {
    const { processFile } = useChatComposer();
    const { t } = useTranslation();

    return (
        <DragDropWrapper
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            onFileDrop={file => {
                void (async () => {
                    const validation = await validateDroppedFile(file, t);
                    if (!validation.valid) {
                        addToast({
                            type: 'error',
                            message: validation.error || t('common.invalidInput'),
                        });
                        return;
                    }
                    void processFile(file);
                })();
            }}
        >
            <ViewManager
                currentView={currentView}
                templates={templates}
                messagesEndRef={messagesEndRef}
                fileInputRef={fileInputRef}
                textareaRef={textareaRef}
                onScrollToBottom={onScrollToBottom}
                showScrollButton={showScrollButton}
                setShowScrollButton={setShowScrollButton}
                showFileMenu={showFileMenu}
                setShowFileMenu={setShowFileMenu}
                settingsSearchQuery={settingsSearchQuery}
            />
            <div id="modal-root" />
        </DragDropWrapper>
    );
};

export default function App() {
    if (isDetachedTerminalWindow) {
        return <DetachedTerminalWindow />;
    }

    return <MainApp />;
}

function MainApp() {
    const sessionTimeout = useSessionTimeout();
    const { language } = useLanguage();
    const { t } = useTranslation();
    const appState = useAppState();
    const {
        currentView,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        setShowCommandPalette,
        addToast,
        setCurrentView,
    } = appState;
    const breakpoint = useBreakpoint();
    const settingsSearchQuery = '';

    const [showOnboarding, setShowOnboarding] = useState(false);
    const nonCriticalUiReady = useDeferredNonCriticalUi();
    const [showLanguagePrompt, setShowLanguagePrompt] = useState(() => {
        // Show prompt only on first run if language wasn't explicitly selected
        return !localStorage.getItem('app.languageSelected');
    });

    useAppInitialization();

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const settings = await window.electron.getSettings();
                const shouldShowOnboarding =
                    localStorage.getItem('Tengra-onboarding-complete') !== 'true' &&
                    settings.general?.onboardingCompleted !== true;
                if (!cancelled) {
                    setShowOnboarding(shouldShowOnboarding);
                }
            } catch {
                if (!cancelled) {
                    setShowOnboarding(localStorage.getItem('Tengra-onboarding-complete') !== 'true');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // Auto-collapse sidebar when entering the workspace view.
    useEffect(() => {
        if (!isSidebarCollapsed && currentView === 'workspace') {
            setIsSidebarCollapsed(true);
        }
    }, [currentView, isSidebarCollapsed, setIsSidebarCollapsed]);

    useEffect(() => {
        trackResponsiveBreakpoint({
            breakpoint,
            width: window.innerWidth,
            height: window.innerHeight,
        });
        document.documentElement.setAttribute('data-breakpoint', breakpoint);
        if (breakpoint === 'mobile' && !isSidebarCollapsed) {
            setIsSidebarCollapsed(true);
        }
    }, [breakpoint, isSidebarCollapsed, setIsSidebarCollapsed]);

    const handleScrollToBottom = () => {
        const ref = appState.messagesEndRef.current;
        if (ref) {
            ref.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleToggleSidebar = useCallback(() => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    }, [isSidebarCollapsed, setIsSidebarCollapsed]);
    const chatTemplates = useMemo(() => getChatTemplates(t), [t]);

    useEffect(() => {
        const openPalette = () => {
            setShowCommandPalette(true);
        };
        window.addEventListener('app:open-command-palette', openPalette as EventListener);
        return () => {
            window.removeEventListener('app:open-command-palette', openPalette as EventListener);
        };
    }, [setShowCommandPalette]);

    useEffect(() => {
        const remove = window.electron.ipcRenderer.on(
            'proxy:rate-limit-warning',
            (_event, payload: RateLimitWarningPayload | null | undefined) => {
                const data = payload ?? {};
                const provider = data.provider ?? 'provider';
                const remaining = typeof data.remaining === 'number' ? data.remaining : 0;
                const limit = typeof data.limit === 'number' ? data.limit : 0;
                addToast({
                    type: 'warning',
                    message: t('errors.rateLimitWarning', { provider, remaining, limit })
                });
            }
        );
        return () => {
            if (typeof remove === 'function') {
                remove();
            }
        };
    }, [addToast, t]);

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
                                    <AppHeader
                                        currentView={appState.currentView}
                                    />
                                    <ErrorFallback
                                        error={error || new Error(t('errors.unexpected'))}
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
            <div className="app-container h-screen w-full overflow-hidden">
                <OfflineBanner />
                {showLanguagePrompt && (
                    <LanguageSelectionPrompt
                        onClose={() => {
                            localStorage.setItem('app.languageSelected', 'true');
                            setShowLanguagePrompt(false);
                        }}
                    />
                )}

                {showOnboarding && (
                    <Suspense fallback={null}>
                        <OnboardingFlow
                            isOpen={showOnboarding}
                            onClose={() => setShowOnboarding(false)}
                        />
                    </Suspense>
                )}

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
                <WindowAppCommandConnector
                    setShowSSHManager={appState.setShowSSHManager}
                />
                {nonCriticalUiReady && (
                    <>
                        <SelectionPersistenceConnector />
                        <VoiceActionsConnector
                            setCurrentView={setCurrentView}
                            addToast={toast => addToast(toast)}
                        />
                        <KeyboardShortcutsConnector
                            showCommandPalette={appState.showCommandPalette}
                            setShowCommandPalette={appState.setShowCommandPalette}
                            showShortcuts={appState.showShortcuts}
                            setShowShortcuts={appState.setShowShortcuts}
                            showSSHManager={appState.showSSHManager}
                            setShowSSHManager={appState.setShowSSHManager}
                            setCurrentView={setCurrentView}
                            onToggleSidebar={handleToggleSidebar}
                        />
                        <Suspense fallback={null}>
                            <QuickActionBarConnector
                                explainPrefix={t('quickAction.explainPrefix')}
                                translatePrefix={t('quickAction.translatePrefix')}
                                language={language}
                            />
                        </Suspense>
                        <Suspense fallback={null}>
                            <UpdateNotification />
                        </Suspense>
                    </>
                )}
                <ToastsContainer toasts={appState.toasts} removeToast={appState.removeToast} />
                {nonCriticalUiReady && (
                    <Suspense fallback={null}>
                        <CommandPaletteConnector
                            isOpen={appState.showCommandPalette}
                            onClose={() => {
                                appState.setShowCommandPalette(false);
                            }}
                            setCurrentView={setCurrentView}
                            t={t}
                        />
                    </Suspense>
                )}
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
                                <AppHeader
                                    currentView={appState.currentView}
                                />
                                <DragDropContent
                                    isDragging={appState.isDragging}
                                    setIsDragging={appState.setIsDragging}
                                    addToast={toast => appState.addToast(toast)}
                                    currentView={appState.currentView}
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
        </ErrorBoundary>
    );
}
