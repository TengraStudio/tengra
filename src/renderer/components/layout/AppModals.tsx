/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { Suspense } from 'react';

import { KeyboardShortcutsModal } from '@/components/shared/KeyboardShortcutsModal';
import { Modal } from '@/components/ui/modal';
import { SettingsCategory } from '@/features/settings/types';
import { AppView } from '@/hooks/useAppState';
import { Language } from '@/i18n';
import { AnimatePresence } from '@/lib/framer-motion-compat';


// Lazy load heavy components
const SSHManager = React.lazy(() => import('@/features/ssh/SSHManager').then(m => ({ default: m.SSHManager })));
const AudioChatOverlay = React.lazy(() => import('@/features/chat/components/AudioChatOverlay').then(m => ({ default: m.AudioChatOverlay })));

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
            }} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">{t('auth.goToAccounts')}</button>}
        >
            <div className="p-6 flex flex-col items-center justify-center"><p className="text-base text-muted-foreground text-center">{t('auth.connectionFailed')}</p></div>
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
