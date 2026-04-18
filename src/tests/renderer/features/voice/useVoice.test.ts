/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
