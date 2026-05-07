/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useVoice hook
vi.mock('@/features/voice/hooks/useVoice', () => ({
    isSpeechRecognitionAvailable: vi.fn(() => false),
    useVoice: () => ({
        session: {
            isListening: false,
            isSpeaking: false,
            isProcessing: false,
            error: null,
            lastTranscript: '',
            lastCommand: null,
        },
        toggleListening: vi.fn(),
        speak: vi.fn(),
        settings: { audioFeedback: false },
    }),
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/utils/renderer-logger', () => ({
    appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { VoiceControl } from '@/features/voice/components/VoiceControl';
import { isSpeechRecognitionAvailable } from '@/features/voice/hooks/useVoice';

describe('VoiceControl', () => {
    it('shows not-supported message when speech recognition unavailable', () => {
        vi.mocked(isSpeechRecognitionAvailable).mockReturnValue(false);
        render(<VoiceControl />);
        expect(screen.getByText('voice.notSupported')).toBeInTheDocument();
    });

    it('renders compact mode button when speech recognition is available', () => {
        vi.mocked(isSpeechRecognitionAvailable).mockReturnValue(true);
        render(<VoiceControl compact />);
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders full mode with status when speech recognition is available', () => {
        vi.mocked(isSpeechRecognitionAvailable).mockReturnValue(true);
        render(<VoiceControl />);
        expect(screen.getByText('voice.status.idle')).toBeInTheDocument();
    });

    it('renders without crashing with all props', () => {
        vi.mocked(isSpeechRecognitionAvailable).mockReturnValue(true);
        const { container } = render(
            <VoiceControl
                compact={false}
                className="custom-class"
                onCommand={vi.fn()}
                onNavigate={vi.fn()}
                showVisualFeedback={true}
            />
        );
        expect(container.firstChild).toBeTruthy();
    });
});

