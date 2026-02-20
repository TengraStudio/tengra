/**
 * VoiceControl Component - Main voice control interface
 * UI-11: Voice-first interface option
 */

import { VoiceCommand } from '@shared/types/voice';
import { useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

import { isSpeechRecognitionAvailable,useVoice } from '../hooks/useVoice';

/** Props for VoiceControl component */
interface VoiceControlProps {
    /** Show compact mode (just button) */
    compact?: boolean;
    /** Custom class name */
    className?: string;
    /** Callback when command is recognized */
    onCommand?: (command: VoiceCommand) => void;
    /** Callback when navigation is triggered */
    onNavigate?: (target: string) => void;
    /** Show visual feedback */
    showVisualFeedback?: boolean;
}

/** Voice control button and status indicator */
export function VoiceControl({
    compact = false,
    className = '',
    onCommand,
    onNavigate,
    showVisualFeedback = true,
}: VoiceControlProps) {
    const { t } = useTranslation();
    const {
        session,
        toggleListening,
        speak,
        settings,
    } = useVoice();

    const [showHelp, setShowHelp] = useState(false);

    // Handle voice events
    useEffect(() => {
        const handleNavigate = (event: CustomEvent<string>) => {
            if (onNavigate) {
                onNavigate(event.detail);
            }
            // Provide audio feedback
            if (settings.audioFeedback) {
                speak({ text: t('voice.feedback.navigating', { target: event.detail }) });
            }
        };

        const handleCommand = (event: CustomEvent<VoiceCommand>) => {
            if (onCommand) {
                onCommand(event.detail);
            }
        };

        window.addEventListener('voice:navigate', handleNavigate as EventListener);
        window.addEventListener('voice:command', handleCommand as EventListener);

        return () => {
            window.removeEventListener('voice:navigate', handleNavigate as EventListener);
            window.removeEventListener('voice:command', handleCommand as EventListener);
        };
    }, [onCommand, onNavigate, settings.audioFeedback, speak, t]);

    // Keyboard shortcut to toggle voice
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.shiftKey && event.key === 'V') {
                toggleListening();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleListening]);

    if (!isSpeechRecognitionAvailable()) {
        return (
            <div className={`voice-control voice-control--unsupported ${className}`}>
                <span className="voice-control__message">
                    {t('voice.notSupported')}
                </span>
            </div>
        );
    }

    const getStatusColor = (): string => {
        if (session.error) {return 'red';}
        if (session.isSpeaking) {return 'blue';}
        if (session.isProcessing) {return 'yellow';}
        if (session.isListening) {return 'green';}
        return 'gray';
    };

    const getStatusText = (): string => {
        if (session.error) {return t('voice.status.error');}
        if (session.isSpeaking) {return t('voice.status.speaking');}
        if (session.isProcessing) {return t('voice.status.processing');}
        if (session.isListening) {return t('voice.status.listening');}
        return t('voice.status.idle');
    };

    if (compact) {
        return (
            <button
                className={`voice-control voice-control--compact ${className}`}
                onClick={toggleListening}
                title={session.isListening ? t('voice.stopListening') : t('voice.startListening')}
                aria-label={session.isListening ? t('voice.stopListening') : t('voice.startListening')}
                aria-pressed={session.isListening}
            >
                <span className={`voice-control__icon voice-control__icon--${getStatusColor()}`}>
                    {session.isListening ? '🎤' : '🎙️'}
                </span>
                {showVisualFeedback && session.isListening && (
                    <span className="voice-control__pulse" />
                )}
            </button>
        );
    }

    return (
        <div className={`voice-control ${className}`}>
            <div className="voice-control__header">
                <button
                    className={`voice-control__button voice-control__button--${getStatusColor()}`}
                    onClick={toggleListening}
                    aria-pressed={session.isListening}
                >
                    <span className="voice-control__icon">
                        {session.isListening ? '🎤' : '🎙️'}
                    </span>
                    <span className="voice-control__label">
                        {session.isListening ? t('voice.stop') : t('voice.start')}
                    </span>
                </button>

                <button
                    className="voice-control__help-button"
                    onClick={() => setShowHelp(!showHelp)}
                    aria-expanded={showHelp}
                    aria-label={t('voice.showCommands')}
                >
                    ?
                </button>
            </div>

            {showVisualFeedback && (
                <div className="voice-control__status">
                    <span className={`voice-control__status-dot voice-control__status-dot--${getStatusColor()}`} />
                    <span className="voice-control__status-text">{getStatusText()}</span>
                </div>
            )}

            {showVisualFeedback && session.lastTranscript && (
                <div className="voice-control__transcript">
                    <span className="voice-control__transcript-label">
                        {t('voice.lastHeard')}:
                    </span>
                    <span className="voice-control__transcript-text">
                        {session.lastTranscript}
                    </span>
                </div>
            )}

            {session.error && (
                <div className="voice-control__error">
                    {session.error}
                </div>
            )}

            {showHelp && (
                <VoiceCommandsHelp onClose={() => setShowHelp(false)} />
            )}
        </div>
    );
}

/** Voice commands help panel */
function VoiceCommandsHelp({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { getCommands } = useVoice();
    const [commands, setCommands] = useState<VoiceCommand[]>([]);

    useEffect(() => {
        void getCommands()
            .then(setCommands)
            .catch(error => appLogger.error('VoiceControl', 'Failed to load voice commands', error as Error));
    }, [getCommands]);

    const groupedCommands = commands.reduce((acc, cmd) => {
        const category = cmd.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(cmd);
        return acc;
    }, {} as Record<string, VoiceCommand[]>);

    return (
        <div className="voice-help">
            <div className="voice-help__header">
                <h3>{t('voice.commands.title')}</h3>
                <button onClick={onClose} aria-label={t('common.close')}>
                    ✕
                </button>
            </div>

            <div className="voice-help__content">
                {Object.entries(groupedCommands).map(([category, cmds]) => (
                    <div key={category} className="voice-help__category">
                        <h4>{t(`voice.commands.categories.${category}`)}</h4>
                        <ul className="voice-help__list">
                            {cmds.map((cmd) => (
                                <li key={cmd.id} className="voice-help__item">
                                    <span className="voice-help__phrase">
                                        "{cmd.phrase}"
                                    </span>
                                    <span className="voice-help__description">
                                        {cmd.description}
                                    </span>
                                    {cmd.aliases.length > 0 && (
                                        <span className="voice-help__aliases">
                                            {t('voice.commands.aliases')}: {cmd.aliases.join(', ')}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default VoiceControl;
