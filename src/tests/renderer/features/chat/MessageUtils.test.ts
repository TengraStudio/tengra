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

    it('uses the streaming fast path for plain text content without structured markers', () => {
        const raw = 'Normal icerik akmaya devam ediyor.';
        const { result } = renderHook(() => useMessageContent(raw, undefined, 'Canli dusunce'));

        expect(result.current.thought).toBe('Canli dusunce');
        expect(result.current.plan).toBeNull();
        expect(result.current.displayContent).toBe(raw);
    });
});
