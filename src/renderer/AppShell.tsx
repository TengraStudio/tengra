import { AppHeader } from '@renderer/components/layout/AppHeader';
import { CommandPalette } from '@renderer/components/layout/CommandPalette';
import { LayoutManager } from '@renderer/components/layout/LayoutManager';
import { QuickActionBar } from '@renderer/components/layout/QuickActionBar';
import { Sidebar } from '@renderer/components/layout/Sidebar';
import { UpdateNotification } from '@renderer/components/layout/UpdateNotification';
import { KeyboardShortcutsModal } from '@renderer/components/shared/KeyboardShortcutsModal';
import { Modal } from '@renderer/components/ui/modal';
import { AudioChatOverlay } from '@renderer/features/chat/components/AudioChatOverlay';
import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech';
import { useVoiceInput } from '@renderer/features/chat/hooks/useVoiceInput';
import { ModelInfo } from '@renderer/features/models/utils/model-fetcher';
import { OnboardingFlow } from '@renderer/features/onboarding/OnboardingFlow';
import { SettingsCategory } from '@renderer/features/settings/types';
import { useAppState } from '@renderer/hooks/useAppState';
import { AppView } from '@renderer/hooks/useAppState';
import { useTranslation } from '@renderer/i18n';
import { ViewManager } from '@renderer/views/ViewManager';
import { useCallback, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useModel } from '@/context/ModelContext';
import { useProject } from '@/context/ProjectContext';
import { useTheme } from '@/context/ThemeContext';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { Chat, Project } from '@/types';

export function AppShell() {
    const { theme } = useTheme();
    const {
        language, isAuthModalOpen, setIsAuthModalOpen,
        handleAntigravityLogout, setSettingsCategory
    } = useAuth();
    const {
        createNewChat, currentChatId, setCurrentChatId, chats,
        clearMessages
    } = useChat();
    const {
        models, loadModels, selectedModel, setSelectedModel
    } = useModel();
    const { projects, setSelectedProject, loadProjects } = useProject();

    const { t } = useTranslation(language ?? 'en');
    const { isListening, stopListening, startListening } = useVoiceInput(() => { });
    const { stop: handleStopSpeak, isSpeaking } = useTextToSpeech();

    const {
        currentView, setCurrentView, isSidebarCollapsed, setIsSidebarCollapsed,
        showShortcuts, setShowShortcuts,
        showFileMenu, setShowFileMenu,
        showScrollButton, setShowScrollButton,
        messagesEndRef, fileInputRef, textareaRef,
        showCommandPalette, setShowCommandPalette,
        setShowSSHManager
    } = useAppState();

    const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
        return !localStorage.getItem('orbit-onboarding-complete');
    });

    // Handle navigation to a newly created project from Ideas page
    const handleNavigateToProject = useCallback(async (projectId: string) => {
        // Reload projects to ensure the new project is in the list
        await loadProjects();
        // Find and select the project
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setSelectedProject(project);
        }
        // Navigate to projects view
        setCurrentView('projects');
    }, [loadProjects, projects, setSelectedProject, setCurrentView]);

    const sidebar = (
        <Sidebar
            isCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            currentView={currentView}
            onChangeView={(view) => setCurrentView(view)}
            onOpenSettings={(cat?) => {
                setCurrentView('settings');
                if (cat) {
                    setSettingsCategory(cat);
                }
            }}
            onSearch={() => { }}
        />
    );

    const main = (
        <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden relative">
            <AppHeader
                currentView={currentView}
            />

            <main className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    <ViewManager
                        key={currentView}
                        currentView={currentView}
                        messagesEndRef={messagesEndRef}
                        fileInputRef={fileInputRef}
                        textareaRef={textareaRef}
                        onScrollToBottom={() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        showScrollButton={showScrollButton}
                        setShowScrollButton={setShowScrollButton}
                        showFileMenu={showFileMenu}
                        setShowFileMenu={setShowFileMenu}
                        templates={[]}
                        onNavigateToProject={handleNavigateToProject}
                    />
                </AnimatePresence>
            </main>

            <QuickActionBar
                language={language === 'tr' ? 'tr' : 'en'}
                onExplain={() => { }}
                onTranslate={() => { }}
            />
        </div>
    );

    return (
        <div className={`app-container overflow-hidden h-screen w-screen flex flex-col ${theme}`}>
            <LayoutManager
                sidebarContent={sidebar}
                mainContent={main}
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
            />

            <AppOverlays
                isListening={isListening}
                startListening={startListening}
                stopListening={stopListening}
                isSpeaking={isSpeaking}
                onStopSpeaking={handleStopSpeak}
                language={language ?? 'en'}
                showCommandPalette={showCommandPalette}
                setShowCommandPalette={setShowCommandPalette}
                chats={chats}
                projects={projects}
                onSelectChat={(id: string) => {
                    setCurrentChatId(id);
                    setCurrentView('chat');
                }}
                onNewChat={createNewChat}
                onSelectProject={(id: string) => {
                    const project = projects.find(p => p.id === id) ?? null;
                    setSelectedProject(project);
                    setCurrentView('projects');
                }}
                onOpenSettings={(cat?: SettingsCategory) => {
                    setCurrentView('settings');
                    if (cat) {
                        setSettingsCategory(cat);
                    }
                }}
                onOpenSSHManager={() => setShowSSHManager(true)}
                onRefreshModels={() => { void loadModels(); }}
                models={models}
                onSelectModel={(model: string) => setSelectedModel(model)}
                selectedModel={selectedModel ?? ''}
                onClearChat={() => { if (currentChatId) { void clearMessages(); } }}
                t={t}
                isAuthModalOpen={isAuthModalOpen}
                setIsAuthModalOpen={setIsAuthModalOpen}
                handleAntigravityLogout={handleAntigravityLogout}
                setSettingsCategory={setSettingsCategory}
                setCurrentView={setCurrentView}
                showShortcuts={showShortcuts}
                setShowShortcuts={setShowShortcuts}
                isOnboardingOpen={isOnboardingOpen}
                setIsOnboardingOpen={setIsOnboardingOpen}
            />
        </div>
    );
}

interface AppOverlaysProps {
    isListening: boolean;
    startListening: () => void;
    stopListening: () => void;
    isSpeaking: boolean;
    onStopSpeaking: () => void;
    language: string;
    showCommandPalette: boolean;
    setShowCommandPalette: (show: boolean) => void;
    chats: Chat[];
    projects: Project[];
    onSelectChat: (id: string) => void;
    onNewChat: () => void;
    onSelectProject: (id: string) => void;
    onOpenSettings: (cat?: SettingsCategory) => void;
    onOpenSSHManager: () => void;
    onRefreshModels: () => void;
    models: ModelInfo[];
    onSelectModel: (model: string) => void;
    selectedModel: string;
    onClearChat: () => void;
    t: (key: string) => string;
    isAuthModalOpen: boolean;
    setIsAuthModalOpen: (show: boolean) => void;
    handleAntigravityLogout: () => Promise<void>;
    setSettingsCategory: (cat: SettingsCategory) => void;
    setCurrentView: (view: AppView) => void;
    showShortcuts: boolean;
    setShowShortcuts: (show: boolean) => void;
    isOnboardingOpen: boolean;
    setIsOnboardingOpen: (show: boolean) => void;
}

function AppOverlays({
    isListening, startListening, stopListening, isSpeaking, onStopSpeaking, language,
    showCommandPalette, setShowCommandPalette, chats, projects, onSelectChat, onNewChat,
    onSelectProject, onOpenSettings, onOpenSSHManager, onRefreshModels, models,
    onSelectModel, selectedModel, onClearChat, t, isAuthModalOpen, setIsAuthModalOpen,
    handleAntigravityLogout, setSettingsCategory, setCurrentView, showShortcuts,
    setShowShortcuts, isOnboardingOpen, setIsOnboardingOpen
}: AppOverlaysProps) {
    return (
        <>
            <AudioChatOverlay
                isOpen={false}
                onClose={() => { }}
                isListening={isListening}
                startListening={startListening}
                stopListening={stopListening}
                isSpeaking={isSpeaking}
                onStopSpeaking={onStopSpeaking}
                language={language === 'tr' ? 'tr' : 'en'}
            />

            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                chats={chats}
                onSelectChat={onSelectChat}
                onNewChat={onNewChat}
                projects={projects}
                onSelectProject={onSelectProject}
                onOpenSettings={onOpenSettings}
                onOpenSSHManager={onOpenSSHManager}
                onRefreshModels={onRefreshModels}
                models={models}
                onSelectModel={onSelectModel}
                selectedModel={selectedModel}
                onClearChat={onClearChat}
                t={t}
            />

            <Modal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                title={t('auth.authError')}
            >
                <div className="space-y-4">
                    <p className="text-muted-foreground">{t('auth.connectionFailed')}</p>
                    <button
                        onClick={() => {
                            setIsAuthModalOpen(false);
                            setCurrentView('settings');
                            setSettingsCategory('general');
                        }}
                        className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-bold uppercase tracking-wider"
                    >
                        {t('auth.goToAccounts')}
                    </button>
                    <button
                        onClick={() => {
                            void handleAntigravityLogout();
                            setIsAuthModalOpen(false);
                        }}
                        className="w-full py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors font-bold uppercase tracking-wider"
                    >
                        LOGOUT
                    </button>
                </div>
            </Modal>

            <KeyboardShortcutsModal
                isOpen={showShortcuts}
                onClose={() => setShowShortcuts(false)}
                language={language === 'tr' ? 'tr' : 'en'}
            />

            <UpdateNotification />
            <OnboardingFlow
                isOpen={isOnboardingOpen}
                onClose={() => setIsOnboardingOpen(false)}
            />
        </>
    );
}
