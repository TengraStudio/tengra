import { describe, expect, it } from 'vitest';

import {
    isSpeechRecognitionAvailable,
    isSpeechSynthesisAvailable,
} from '@/features/voice/hooks/useVoice';

describe('Voice utility functions', () => {
    describe('isSpeechRecognitionAvailable', () => {
        it('returns a boolean', () => {
            const result = isSpeechRecognitionAvailable();
            expect(typeof result).toBe('boolean');
        });

        it('returns false in jsdom (no SpeechRecognition)', () => {
            expect(isSpeechRecognitionAvailable()).toBe(false);
        });
    });

    describe('isSpeechSynthesisAvailable', () => {
        it('returns a boolean', () => {
            const result = isSpeechSynthesisAvailable();
            expect(typeof result).toBe('boolean');
        });
    });
});
