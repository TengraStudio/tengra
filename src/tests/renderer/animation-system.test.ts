import {
    ANIMATION_PRESETS,
    getAnimationDurationMs,
    resolveAnimationPreset,
} from '@renderer/lib/animation-system';
import { describe, expect, it } from 'vitest';

describe('animation system', () => {
    it('returns configured preset timing values', () => {
        const preset = resolveAnimationPreset('page', false);
        expect(preset).toEqual(ANIMATION_PRESETS.page);
        expect(getAnimationDurationMs('tooltip', false)).toBe(160);
    });

    it('returns zero-duration animation in reduced motion mode', () => {
        const preset = resolveAnimationPreset('emphasized', true);
        expect(preset.duration).toBe(0);
        expect(preset.ease).toEqual([0, 0, 1, 1]);
        expect(getAnimationDurationMs('emphasized', true)).toBe(0);
    });
});
