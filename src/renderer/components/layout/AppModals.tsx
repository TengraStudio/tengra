import { KeyboardShortcutsModal } from '@renderer/components/shared/KeyboardShortcutsModal';
import { Modal } from '@renderer/components/ui/modal';
import { SettingsCategory } from '@renderer/features/settings/types';
import { AppView } from '@renderer/hooks/useAppState';
import { Language } from '@renderer/i18n';
import React, { Suspense } from 'react';

import { AnimatePresence } from '@/lib/framer-motion-compat';

import './app-modals.css';

// Lazy load heavy components
const SSHManager = React.lazy(() => import('@renderer/features/ssh/SSHManager').then(m => ({ default: m.SSHManager })));
const AudioChatOverlay = React.lazy(() => import('@renderer/features/chat/components/AudioChatOverlay').then(m => ({ default: m.AudioChatOverlay })));

export interface AppModalsProps {
    isAuthModalOpen: boolean
    setIsAuthModalOpen: (open: boolean) => void
    t: (key: string) => string
    handleAntigravityLogout: () => Promise<void>
    setSettingsCategory: (cat: SettingsCategory) => void
    setCurrentView: (view: AppView) => void
    showShortcuts: boolean
    setShowShortcuts: (show: boolean) => void
    isAudioOverlayOpen: boolean
    setIsAudioOverlayOpen: (open: boolean) => void
    isListening: boolean
    startListening: () => void
    stopListening: () => void
    isSpeaking: boolean
    handleStopSpeak: () => void
    language: Language
    showSSHManager: boolean
    setShowSSHManager: (show: boolean) => void
}

export function AppModals({
    isAuthModalOpen, setIsAuthModalOpen, t, handleAntigravityLogout, setSettingsCategory, setCurrentView,
    showShortcuts, setShowShortcuts, isAudioOverlayOpen, setIsAudioOverlayOpen,
    isListening, startListening, stopListening, isSpeaking, handleStopSpeak, language, showSSHManager, setShowSSHManager
}: AppModalsProps) {
    return (<>
        <Modal
            isOpen={isAuthModalOpen} onClose={() => { setIsAuthModalOpen(false); }} title={t('auth.authError')}
            footer={<button onClick={() => {
                void (async () => {
                    await handleAntigravityLogout();
                    setIsAuthModalOpen(false);
                    setCurrentView('settings');
                    setSettingsCategory('accounts');
                })();
            }} className="tengra-app-modals__auth-footer-button">{t('auth.goToAccounts')}</button>}
        >
            <div className="tengra-app-modals__auth-body"><p className="tengra-app-modals__auth-body-text">{t('auth.connectionFailed')}</p></div>
        </Modal>
        <AnimatePresence>
            {showShortcuts && <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => { setShowShortcuts(false); }} language={language} />}
        </AnimatePresence>
        <AnimatePresence>
            {isAudioOverlayOpen && (
                <Suspense fallback={null}>
                    <AudioChatOverlay
                        isOpen={isAudioOverlayOpen} onClose={() => { setIsAudioOverlayOpen(false); }} isListening={isListening}
                        startListening={startListening} stopListening={stopListening} isSpeaking={isSpeaking}
                        onStopSpeaking={() => { handleStopSpeak(); }} language={language}
                    />
                </Suspense>
            )}
        </AnimatePresence>
        <AnimatePresence>
            {showSSHManager && (
                <Suspense fallback={null}>
                    <SSHManager isOpen={showSSHManager} onClose={() => { setShowSSHManager(false); }} language={language} />
                </Suspense>
            )}
        </AnimatePresence>
    </>);
}
