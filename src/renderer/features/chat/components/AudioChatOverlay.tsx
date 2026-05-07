/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconLoader2, IconMicrophone, IconPlayerStop, IconVolume, IconX } from '@tabler/icons-react';
import { useEffect } from 'react';

import { Language, useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_AUDIOCHATOVERLAY_1 = "absolute top-8 right-8 p-4 rounded-full bg-muted/30 hover:bg-muted/40 transition-all z-50 hover:scale-110 active:scale-95 shadow-xl";


interface AudioChatOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    isListening: boolean;
    startListening: () => void;
    stopListening: () => void;
    isSpeaking: boolean;
    onStopSpeaking: () => void;
    language: Language;
}

type AudioState = 'listening' | 'speaking' | 'processing';

interface StateConfig {
    bgClass: string;
    blurClass: string;
    shadowStyle: string;
    icon: typeof IconMicrophone;
    iconClass?: string;
    title: string;
    desc: string;
}

function getAudioState(isListening: boolean, isSpeaking: boolean): AudioState {
    if (isListening) {
        return 'listening';
    }
    if (isSpeaking) {
        return 'speaking';
    }
    return 'processing';
}

function getStateConfig(state: AudioState, t: (key: string) => string): StateConfig {
    const configs: Record<AudioState, StateConfig> = {
        listening: {
            bgClass: 'bg-primary text-primary-foreground',
            blurClass: 'bg-primary/30',
            shadowStyle: '0 0 80px rgba(var(--primary), 0.4)',
            icon: IconMicrophone,
            title: t('frontend.audioChat.listening'),
            desc: t('frontend.audioChat.listeningDesc'),
        },
        speaking: {
            bgClass: 'bg-success text-foreground',
            blurClass: 'bg-success/30',
            shadowStyle: '0 0 80px hsl(var(--success) / 0.4)',
            icon: IconVolume,
            title: t('frontend.audioChat.speaking'),
            desc: t('frontend.audioChat.speakingDesc'),
        },
        processing: {
            bgClass: 'bg-muted text-muted-foreground',
            blurClass: '',
            shadowStyle: 'none',
            icon: IconLoader2,
            iconClass: 'animate-spin opacity-50',
            title: t('frontend.audioChat.thinking'),
            desc: t('frontend.audioChat.thinkingDesc'),
        },
    };
    return configs[state];
}

const PulseRings: React.FC<{ blurClass: string }> = ({ blurClass }) => (
    <>
        <motion.div
            animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3], rotate: [0, 90, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className={cn('absolute w-80 h-80 rounded-full blur-3xl', blurClass)}
        />
        <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className={cn(
                'absolute w-64 h-64 rounded-full blur-3xl',
                blurClass.replace('/30', '/20')
            )}
        />
    </>
);

interface CentralIconProps {
    isListening: boolean;
    config: StateConfig;
}

const CentralIcon: React.FC<CentralIconProps> = ({ isListening, config }) => {
    const Icon = config.icon;
    return (
        <motion.div
            animate={{ scale: isListening ? [1, 1.05, 1] : 1, boxShadow: config.shadowStyle }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={cn(
                'w-40 h-40 rounded-full flex items-center justify-center shadow-2xl transition-all duration-700 relative z-10 border border-border/50',
                config.bgClass
            )}
        >
            <Icon className={cn('w-16 h-16 drop-shadow-lg', config.iconClass)} />
        </motion.div>
    );
};

interface ControlButtonProps {
    onClick: () => void;
    className: string;
    icon: typeof IconMicrophone;
    label: string;
}

const ControlButton: React.FC<ControlButtonProps> = ({ onClick, className, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={cn(
            'px-10 py-4 rounded-2xl font-bold transition-all flex items-center gap-3 shadow-lg active:scale-95',
            className
        )}
    >
        <Icon className="w-6 h-6" />
        {label}
    </button>
);

interface ControlsProps {
    isListening: boolean;
    isSpeaking: boolean;
    startListening: () => void;
    stopListening: () => void;
    onStopSpeaking: () => void;
    t: (key: string) => string;
}

const Controls: React.FC<ControlsProps> = ({
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    onStopSpeaking,
    t,
}) => (
    <div className="flex gap-4">
        {isSpeaking && (
            <ControlButton
                onClick={onStopSpeaking}
                className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                icon={IconPlayerStop}
                label={t('frontend.audioChat.stopSpeaking')}
            />
        )}
        {!isListening && !isSpeaking && (
            <ControlButton
                onClick={startListening}
                className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                icon={IconMicrophone}
                label={t('frontend.audioChat.resumeListening')}
            />
        )}
        {isListening && (
            <ControlButton
                onClick={stopListening}
                className="bg-muted/30 text-muted-foreground border border-border/50 hover:bg-muted/40"
                icon={IconPlayerStop}
                label={t('frontend.audioChat.pauseListening')}
            />
        )}
    </div>
);

export function AudioChatOverlay({
    isOpen,
    onClose,
    isListening,
    startListening,
    stopListening,
    isSpeaking,
    onStopSpeaking,
    language,
}: AudioChatOverlayProps) {
    const { t } = useTranslation(language);

    useEffect(() => {
        if (isOpen && !isListening && !isSpeaking) {
            startListening();
        }
    }, [isOpen, isSpeaking, isListening, startListening]);

    if (!isOpen) {
        return null;
    }

    const state = getAudioState(isListening, isSpeaking);
    const config = getStateConfig(state, t);
    const showPulse = isListening || isSpeaking;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-2xl"
            >
                <button
                    onClick={onClose}
                    className={C_AUDIOCHATOVERLAY_1}
                >
                    <IconX className="w-8 h-8 text-foreground/50 hover:text-foreground" />
                </button>
                <div className="flex flex-col items-center gap-16 relative w-full max-w-lg mx-auto p-4">
                    <div className="relative flex items-center justify-center">
                        {showPulse && <PulseRings blurClass={config.blurClass} />}
                        <CentralIcon isListening={isListening} config={config} />
                    </div>
                    <div className="text-center space-y-6">
                        <motion.h2
                            key={state}
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="text-4xl font-bold font-sans"
                        >
                            {config.title}
                        </motion.h2>
                        <p className="text-muted-foreground/80 text-xl max-w-xs mx-auto font-medium leading-relaxed">
                            {config.desc}
                        </p>
                    </div>
                    <Controls
                        isListening={isListening}
                        isSpeaking={isSpeaking}
                        startListening={startListening}
                        stopListening={stopListening}
                        onStopSpeaking={onStopSpeaking}
                        t={t}
                    />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

