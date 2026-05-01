/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMessageContent } from '@/features/chat/components/message/MessageUtils';

describe('useMessageContent', () => {
    it('preserves word boundaries when stripping think and function call blocks', () => {
        const raw = 'selam!<think>analiz</think>sana<function_calls><invoke name="x"></invoke></function_calls>nasil yardimci olabilirim?';
        const { result } = renderHook(() => useMessageContent(raw, undefined, undefined));

        expect(result.current.displayContent).toBe('selam! sana nasil yardimci olabilirim?');
    });

    it('does not inject extra space before punctuation when stripping think blocks', () => {
        const raw = 'merhaba<think>analiz</think>, nasilsin?';
        const { result } = renderHook(() => useMessageContent(raw, undefined, undefined));

        expect(result.current.displayContent).toBe('merhaba, nasilsin?');
    });

    it('extracts thinking tags as thought content', () => {
        const raw = '<thinking>copilot dusuncesi</thinking>Sonuc burada.';
        const { result } = renderHook(() => useMessageContent(raw, undefined, undefined));

        expect(result.current.thought).toBe('copilot dusuncesi');
        expect(result.current.displayContent).toBe('Sonuc burada.');
    });

    it('extracts planing typo tags as plan content', () => {
        const raw = '<planing>1. adim</planing>Devam.';
        const { result } = renderHook(() => useMessageContent(raw, undefined, undefined));

        expect(result.current.plan).toBe('1. adim');
        expect(result.current.displayContent).toBe('Devam.');
    });

    it('uses the streaming fast path for plain text content without structured markers', () => {
        const raw = 'Normal icerik akmaya devam ediyor.';
        const { result } = renderHook(() => useMessageContent(raw, undefined, 'Canli dusunce'));

        expect(result.current.thought).toBe('Canli dusunce');
        expect(result.current.plan).toBeNull();
        expect(result.current.displayContent).toBe(raw);
    });

    it('preserves completed plain text content without forcing structured cleanup', () => {
        const raw = 'I will inspect the repo function: not a tool trace, just plain text.';
        const { result } = renderHook(() => useMessageContent(raw, undefined, undefined));

        expect(result.current.displayContent).toBe(raw);
        expect(result.current.plan).toBeNull();
    });
});
