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
    ANIMATION_PRESETS,
    getAnimationDurationMs,
    resolveAnimationPreset,
} from '@/lib/animation-system';

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
