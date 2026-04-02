/**
 * VoiceOverlay Component - Visual feedback for voice-first interface
 * UI-11: Voice-first interface option
 */

import { AlertCircle, Command,Mic, MicOff } from 'lucide-react';
import React from 'react';
import { useSyncExternalStore } from 'react';

import { useTranslation } from '@/i18n';
import { voiceStore } from '@/store/voice.store';

export const VoiceOverlay: React.FC = () => {
    const { t } = useTranslation();
    const session = useSyncExternalStore(
        voiceStore.subscribe,
        voiceStore.getSnapshot
    );
    const settings = voiceStore.getSettings();

    if (!settings.enabled || !settings.visualFeedback) {
        return null;
    }

    if (!session.isListening && !session.isSpeaking && !session.lastTranscript && !session.error) {
        return null;
    }

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
                {/* Listening/Status Indicator */}
                <div className={`
                    flex items-center gap-3 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-md
                    transition-all duration-300 transform
                    ${session.isListening ? 'bg-primary/20 border-primary/30 scale-110' : 'bg-background/80 border-border/50 scale-100'}
                `}>
                    <div className="relative">
                        {session.isListening && (
                            <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                        )}
                        {session.error ? (
                            <AlertCircle className="w-5 h-5 text-destructive" />
                        ) : session.isListening ? (
                            <Mic className="w-5 h-5 text-primary animate-pulse" />
                        ) : (
                            <MicOff className="w-5 h-5 text-muted-foreground" />
                        )}
                    </div>

                    <span className="text-sm font-medium">
                        {session.error
                            ? session.error
                            : session.isProcessing
                                ? t('voice.status.processing')
                                : session.isListening
                                    ? t('voice.status.listening')
                                    : t('voice.status.standby')}
                    </span>
                </div>

                {/* Transcript / Command History */}
                {(session.lastTranscript || session.lastCommand) && (
                    <div className="max-w-md bg-background/90 border border-border/50 rounded-2xl p-4 shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300">
                        {session.lastTranscript && (
                            <p className="text-sm text-foreground/80 line-clamp-2">
                                "{session.lastTranscript}"
                            </p>
                        )}

                        {session.lastCommand && (
                            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-primary">
                                <Command className="w-3 h-3" />
                                <span>{t('voice.feedback.executedPrefix')}: {session.lastCommand.description}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
