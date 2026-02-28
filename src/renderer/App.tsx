import { AppHeader } from '@renderer/components/layout/AppHeader';
import { AppModals } from '@renderer/components/layout/AppModals';
import { DragDropWrapper } from '@renderer/components/layout/DragDropWrapper';
import { LayoutManager } from '@renderer/components/layout/LayoutManager';
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
import { DetachedTerminalWindow } from '@renderer/features/terminal/components/DetachedTerminalWindow';
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

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { useProject } from '@/context/ProjectContext';

import '@renderer/App.css';

// Lazy load heavy layout components
const ExtensionInstallPrompt = lazy(() => import('@renderer/components/ExtensionInstallPrompt').then(m => ({ default: m.ExtensionInstallPrompt })));
const CommandPalette = lazy(() => import('@renderer/components/layout/CommandPalette').then(m => ({ default: m.CommandPalette })));
const UpdateNotification = lazy(() => import('@renderer/components/layout/UpdateNotification').then(m => ({ default: m.UpdateNotification })));
const QuickActionBar = lazy(() => import('@renderer/components/layout/QuickActionBar').then(m => ({ default: m.QuickActionBar })));
const ExtensionDevTools = lazy(() => import('@renderer/features/extensions/components/ExtensionDevTools').then(m => ({ default: m.ExtensionDevTools })));
const VoiceOverlay = lazy(() => import('@renderer/features/voice/components/VoiceOverlay').then(m => ({ default: m.VoiceOverlay })));

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

export default function App() {
    if (isDetachedTerminalWindow) {
        return <DetachedTerminalWindow />;
    }

    return <MainApp />;
}

function MainApp() {
    const sessionTimeout = useSessionTimeout();
    const { language } = useLanguage();
    const { handleAntigravityLogout, isAuthModalOpen, setIsAuthModalOpen, setSettingsCategory } =
        useAuth();
    const {
        setInput,
        handleSend,
        processFile,
        createNewChat,
        currentChatId,
        setCurrentChatId,
        chats,
        setChats,
    } = useChat();
    const { t } = useTranslation();
    const handleVoiceInput = useCallback(
        (text: string) => {
            setInput(prev => prev + text);
        },
        [setInput]
    );
    const { isListening, startListening, stopListening } = useVoiceInput(handleVoiceInput);
    const { stop: handleStopSpeak, isSpeaking } = useTextToSpeech();
    const { models, loadModels, selectedModel, setSelectedModel } = useModel();
    const { projects, selectedProject, setSelectedProject } = useProject();
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
    const [settingsSearchQuery, setSettingsSearchQuery] = useState('');

    // Initialize global voice actions
    useVoiceActions({
        setCurrentView: (view) => setCurrentView(view),
        addToast: (toast) => addToast(toast),
        createNewChat,
        handleSend,
        setInput: (value) => setInput(value),
    });
    const [showExtensionModal, setShowExtensionModal] = useState(false);
    const [showLanguagePrompt, setShowLanguagePrompt] = useState(() => {
        // Show prompt only on first run if language wasn't explicitly selected
        return !localStorage.getItem('app.languageSelected');
    });

    useAppInitialization(); // Keep initialization but don't use auto-warning

    // Auto-collapse sidebar when entering projects view or selecting a project
    useEffect(() => {
        if (!isSidebarCollapsed && (currentView === 'projects' || selectedProject)) {
            setIsSidebarCollapsed(true);
        }
    }, [currentView, selectedProject, isSidebarCollapsed, setIsSidebarCollapsed]);

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

    const handleClearChat = useCallback(() => {
        const clear = async () => {
            if (currentChatId) {
                await window.electron.db.deleteMessages(currentChatId);
                const updatedChats = await window.electron.db.getAllChats();
                setChats(updatedChats);
            }
        };
        void clear();
    }, [currentChatId, setChats]);
    const handleToggleSidebar = useCallback(() => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    }, [isSidebarCollapsed, setIsSidebarCollapsed]);
    const handleOpenSettings = useCallback((category?: SettingsCategory) => {
        setCurrentView('settings');
        if (category) {
            setSettingsCategory(category);
        }
    }, [setCurrentView, setSettingsCategory]);

    const keyboardShortcutsConfig = useMemo(
        () => ({
            onCommandPalette: () => {
                setShowCommandPalette(!appState.showCommandPalette);
            },
            onNewChat: createNewChat,
            onOpenSettings: () => {
                setCurrentView('settings');
                setSettingsCategory('general');
            },
            onShowShortcuts: () => {
                appState.setShowShortcuts(true);
            },
            onClearChat: handleClearChat,
            onSwitchView: (view: AppView) => {
                setCurrentView(view);
            },
            onToggleSidebar: () => {
                handleToggleSidebar();
            },
            onCloseModals: () => {
                appState.setShowCommandPalette(false);
                appState.setShowShortcuts(false);
                appState.setShowSSHManager(false);
            },
            showCommandPalette: appState.showCommandPalette,
            showShortcuts: appState.showShortcuts,
            showSSHManager: appState.showSSHManager,
            currentChatId,
        }),
        [
            appState,
            createNewChat,
            currentChatId,
            handleToggleSidebar,
            handleClearChat,
            setCurrentView,
            setShowCommandPalette,
            setSettingsCategory
        ]
    );

    useKeyboardShortcuts(keyboardShortcutsConfig);
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
            (_event, payload: unknown) => {
                const data = (payload ?? {}) as {
                    provider?: string;
                    remaining?: number;
                    limit?: number;
                };
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

    useEffect(() => {
        if (selectedModel) {
            localStorage.setItem('app.lastModel', selectedModel);
        }
    }, [selectedModel]);

    useEffect(() => {
        if (selectedProject?.id) {
            localStorage.setItem('app.lastProjectId', selectedProject.id);
        }
    }, [selectedProject?.id]);

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
                                <Sidebar
                                    currentView={appState.currentView}
                                    onChangeView={setCurrentView}
                                    isCollapsed={appState.isSidebarCollapsed}
                                    toggleSidebar={handleToggleSidebar}
                                    onOpenSettings={handleOpenSettings}
                                    onSearch={() => { }}
                                />
                            }
                            mainContent={
                                <>
                                    <AppHeader
                                        currentView={appState.currentView}
                                        settingsSearchQuery={settingsSearchQuery}
                                        setSettingsSearchQuery={setSettingsSearchQuery}
                                        onExtensionClick={() => setShowExtensionModal(true)}
                                        onExtensionDevToolsClick={() => appState.setShowExtensionDevTools(!appState.showExtensionDevTools)}
                                    />
                                    <ErrorFallback
                                        error={error || new Error(t('errors.unexpected'))}
                                        resetErrorBoundary={() => {
                                            resetErrorBoundary();
                                            window.location.reload();
                                        }}
                                    />
                                </>
                            } />
                    </div>
                </div>
            )}
        >
            <div className="app-container h-screen w-full overflow-hidden">
                {showLanguagePrompt && (
                    <LanguageSelectionPrompt
                        onClose={() => {
                            localStorage.setItem('app.languageSelected', 'true');
                            setShowLanguagePrompt(false);
                        }}
                    />
                )}

                {showExtensionModal && (
                    <Suspense fallback={null}>
                        <ExtensionInstallPrompt
                            onClose={() => setShowExtensionModal(false)}
                            onDismiss={() => setShowExtensionModal(false)}
                        />
                    </Suspense>
                )}

                <AppModals
                    isAuthModalOpen={isAuthModalOpen}
                    setIsAuthModalOpen={setIsAuthModalOpen}
                    t={t}
                    handleAntigravityLogout={handleAntigravityLogout}
                    setSettingsCategory={setSettingsCategory}
                    setCurrentView={setCurrentView}
                    showShortcuts={appState.showShortcuts}
                    setShowShortcuts={appState.setShowShortcuts}
                    isAudioOverlayOpen={appState.isAudioOverlayOpen}
                    setIsAudioOverlayOpen={appState.setIsAudioOverlayOpen}
                    isListening={isListening}
                    startListening={startListening}
                    stopListening={stopListening}
                    isSpeaking={isSpeaking}
                    handleStopSpeak={handleStopSpeak}
                    language={language}
                    showSSHManager={appState.showSSHManager}
                    setShowSSHManager={appState.setShowSSHManager}
                />
                <Suspense fallback={null}>
                    <QuickActionBar
                        onExplain={text => {
                            setInput(`${t('quickAction.explainPrefix')}${text}`);
                            void handleSend();
                        }}
                        onTranslate={text => {
                            setInput(`${t('quickAction.translatePrefix')}${text}`);
                            void handleSend();
                        }}
                        language={language}
                    />
                </Suspense>
                <Suspense fallback={null}>
                    <UpdateNotification />
                </Suspense>
                <ToastsContainer toasts={appState.toasts} removeToast={appState.removeToast} />
                <Suspense fallback={null}>
                    <CommandPalette
                        isOpen={appState.showCommandPalette}
                        onClose={() => {
                            appState.setShowCommandPalette(false);
                        }}
                        chats={chats}
                        onSelectChat={setCurrentChatId}
                        onNewChat={createNewChat}
                        projects={projects}
                        onSelectProject={(id: string) => {
                            const p = projects.find(pro => pro.id === id);
                            if (p) {
                                setSelectedProject(p);
                                setCurrentView('projects');
                            }
                        }}
                        onOpenSettings={handleOpenSettings}
                        onOpenSSHManager={() => {
                            appState.setShowSSHManager(true);
                        }}
                        onRefreshModels={bypassCache => {
                            void loadModels(bypassCache);
                        }}
                        models={models}
                        onSelectModel={m => {
                            setSelectedModel(m);
                        }}
                        selectedModel={selectedModel}
                        onClearChat={handleClearChat}
                        t={t}
                    />
                </Suspense>
                <div className="absolute inset-0 flex flex-col overflow-hidden">
                    <LayoutManager
                        isSidebarCollapsed={appState.isSidebarCollapsed}
                        setIsSidebarCollapsed={appState.setIsSidebarCollapsed}
                        sidebarContent={
                            <Sidebar
                                currentView={appState.currentView}
                                onChangeView={setCurrentView}
                                isCollapsed={appState.isSidebarCollapsed}
                                toggleSidebar={handleToggleSidebar}
                                onOpenSettings={handleOpenSettings}
                                onSearch={() => { }}
                            />
                        }
                        mainContent={
                            <>
                                <AppHeader
                                    currentView={appState.currentView}
                                    settingsSearchQuery={settingsSearchQuery}
                                    setSettingsSearchQuery={setSettingsSearchQuery}
                                    onExtensionClick={() => setShowExtensionModal(true)}
                                    onExtensionDevToolsClick={() => appState.setShowExtensionDevTools(!appState.showExtensionDevTools)}
                                />
                                <DragDropWrapper
                                    isDragging={appState.isDragging}
                                    setIsDragging={appState.setIsDragging}
                                    onFileDrop={file => {
                                        void (async () => {
                                            // Validate file before processing
                                            const validation = await validateDroppedFile(file);
                                            if (!validation.valid) {
                                                appState.addToast({
                                                    type: 'error',
                                                    message: validation.error || 'Invalid file',
                                                });
                                                return;
                                            }
                                            void processFile(file);
                                        })();
                                    }}
                                >
                                    <ViewManager
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
                                    <div id="modal-root" />
                                </DragDropWrapper>
                            </>
                        }
                        showRightSidebar={appState.showExtensionDevTools}
                        rightSidebarContent={
                            <Suspense fallback={null}>
                                <ExtensionDevTools onClose={() => appState.setShowExtensionDevTools(false)} />
                            </Suspense>
                        }
                    />
                </div>
                <SessionLockOverlay
                    isOpen={sessionTimeout.isEnabled && sessionTimeout.isLocked}
                    lockedAt={sessionTimeout.lockedAt}
                    canUseBiometric={sessionTimeout.canUseBiometric}
                    onUnlock={sessionTimeout.unlock}
                />
                <Suspense fallback={null}>
                    <VoiceOverlay />
                </Suspense>
            </div>
        </ErrorBoundary>
    );
}
