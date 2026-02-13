import { ExtensionInstallPrompt } from '@renderer/components/ExtensionInstallPrompt';
import { AppHeader } from '@renderer/components/layout/AppHeader';
import { AppModals } from '@renderer/components/layout/AppModals';
import { CommandPalette } from '@renderer/components/layout/CommandPalette';
import { DragDropWrapper } from '@renderer/components/layout/DragDropWrapper';
import { LayoutManager } from '@renderer/components/layout/LayoutManager';
import { QuickActionBar } from '@renderer/components/layout/QuickActionBar';
import { SessionLockOverlay } from '@renderer/components/layout/SessionLockOverlay';
import { Sidebar } from '@renderer/components/layout/Sidebar';
import { ToastsContainer } from '@renderer/components/layout/ToastsContainer';
import { UpdateNotification } from '@renderer/components/layout/UpdateNotification';
import { ErrorBoundary } from '@renderer/components/shared/ErrorBoundary';
import { ErrorFallback } from '@renderer/components/shared/ErrorFallback';
import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech';
import { useVoiceInput } from '@renderer/features/chat/hooks/useVoiceInput';
import { validateDroppedFile } from '@renderer/features/chat/hooks/useAttachments';
import { ChatTemplate } from '@renderer/features/chat/types';
import { SettingsCategory } from '@renderer/features/settings/types';
import { DetachedTerminalWindow } from '@renderer/features/terminal/components/DetachedTerminalWindow';
import { useAppInitialization } from '@renderer/hooks/useAppInitialization';
import { AppView, useAppState } from '@renderer/hooks/useAppState';
import { useKeyboardShortcuts } from '@renderer/hooks/useKeyboardShortcuts';
import { useSessionTimeout } from '@renderer/hooks/useSessionTimeout';
import { useLanguage, useTranslation } from '@renderer/i18n';
import { useBreakpoint } from '@renderer/lib/responsive';
import { trackResponsiveBreakpoint } from '@renderer/store/responsive-analytics.store';
import { ViewManager } from '@renderer/views/ViewManager';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { useProject } from '@/context/ProjectContext';

import '@renderer/App.css';

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

export default function App() {
    if (new URLSearchParams(window.location.search).get('detachedTerminal') === '1') {
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
    const breakpoint = useBreakpoint();
    const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
    const [showExtensionModal, setShowExtensionModal] = useState(false);

    useAppInitialization(); // Keep initialization but don't use auto-warning

    // Auto-collapse sidebar when entering projects view or selecting a project
    useEffect(() => {
        if (appState.currentView === 'projects' || selectedProject) {
            appState.setIsSidebarCollapsed(true);
        }
    }, [appState, appState.currentView, selectedProject]);

    useEffect(() => {
        trackResponsiveBreakpoint({
            breakpoint,
            width: window.innerWidth,
            height: window.innerHeight,
        });
        document.documentElement.setAttribute('data-breakpoint', breakpoint);
        if (breakpoint === 'mobile') {
            appState.setIsSidebarCollapsed(true);
        }
    }, [appState, breakpoint]);

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

    const keyboardShortcutsConfig = useMemo(
        () => ({
            onCommandPalette: () => {
                appState.setShowCommandPalette(!appState.showCommandPalette);
            },
            onNewChat: createNewChat,
            onOpenSettings: () => {
                appState.setCurrentView('settings');
                setSettingsCategory('general');
            },
            onShowShortcuts: () => {
                appState.setShowShortcuts(true);
            },
            onClearChat: handleClearChat,
            onSwitchView: (view: AppView) => {
                appState.setCurrentView(view);
            },
            onToggleSidebar: () => {
                appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed);
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
        [appState, createNewChat, currentChatId, handleClearChat, setSettingsCategory]
    );

    useKeyboardShortcuts(keyboardShortcutsConfig);
    const chatTemplates = useMemo(() => getChatTemplates(t), [t]);

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
                appState.addToast({
                    type: 'warning',
                    message: `Rate limit warning (${provider}): ${remaining}/${limit} remaining`
                });
            }
        );
        return () => {
            if (typeof remove === 'function') {
                remove();
            }
        };
    }, [appState]);

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
            fallback={
                <ErrorFallback
                    error={new Error(t('errors.unexpected'))}
                    resetErrorBoundary={() => window.location.reload()}
                />
            }
        >
            <div className="app-container h-screen w-full overflow-hidden">
                {showExtensionModal && (
                    <ExtensionInstallPrompt
                        onClose={() => setShowExtensionModal(false)}
                        onDismiss={() => setShowExtensionModal(false)}
                    />
                )}

                <AppModals
                    isAuthModalOpen={isAuthModalOpen}
                    setIsAuthModalOpen={setIsAuthModalOpen}
                    t={t}
                    handleAntigravityLogout={handleAntigravityLogout}
                    setSettingsCategory={setSettingsCategory}
                    setCurrentView={appState.setCurrentView}
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
                <UpdateNotification />
                <ToastsContainer toasts={appState.toasts} removeToast={appState.removeToast} />
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
                            appState.setCurrentView('projects');
                        }
                    }}
                    onOpenSettings={(cat?: SettingsCategory) => {
                        appState.setCurrentView('settings');
                        if (cat) {
                            setSettingsCategory(cat);
                        }
                    }}
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
                <div className="absolute inset-0 flex flex-col overflow-hidden">
                    <LayoutManager
                        isSidebarCollapsed={appState.isSidebarCollapsed}
                        setIsSidebarCollapsed={appState.setIsSidebarCollapsed}
                        sidebarContent={
                            <Sidebar
                                currentView={appState.currentView}
                                onChangeView={appState.setCurrentView}
                                isCollapsed={appState.isSidebarCollapsed}
                                toggleSidebar={() => {
                                    appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed);
                                }}
                                onOpenSettings={(cat?: SettingsCategory) => {
                                    appState.setCurrentView('settings');
                                    if (cat) {
                                        setSettingsCategory(cat);
                                    }
                                }}
                                onSearch={() => {}}
                            />
                        }
                        mainContent={
                            <>
                                <AppHeader
                                    currentView={appState.currentView}
                                    settingsSearchQuery={settingsSearchQuery}
                                    setSettingsSearchQuery={setSettingsSearchQuery}
                                    onExtensionClick={() => setShowExtensionModal(true)}
                                />
                                <DragDropWrapper
                                    isDragging={appState.isDragging}
                                    setIsDragging={appState.setIsDragging}
                                    onFileDrop={file => {
                                        // Validate file before processing
                                        const validation = validateDroppedFile(file);
                                        if (!validation.valid) {
                                            appState.addToast({
                                                type: 'error',
                                                message: validation.error || 'Invalid file',
                                            });
                                            return;
                                        }
                                        void processFile(file);
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
                    />
                </div>
                <SessionLockOverlay
                    isOpen={sessionTimeout.isEnabled && sessionTimeout.isLocked}
                    lockedAt={sessionTimeout.lockedAt}
                    canUseBiometric={sessionTimeout.canUseBiometric}
                    onUnlock={sessionTimeout.unlock}
                />
            </div>
        </ErrorBoundary>
    );
}
