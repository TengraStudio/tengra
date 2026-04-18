/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    createCustomSplitPreset,
    DEFAULT_SPLIT_ANALYTICS,
    incrementSplitAnalytics,
    sanitizeSplitAnalytics,
    sanitizeSplitLayout,
    sanitizeSplitPresets,
    serializeSplitPresets,
} from '@renderer/features/terminal/utils/split-config';
import { describe, expect, it } from 'vitest';

describe('terminal split config utils', () => {
    it('sanitizes split presets and strips malformed rows', () => {
        const presets = sanitizeSplitPresets([
            { id: 'a', name: 'A', orientation: 'vertical', updatedAt: 1 },
            { id: 'b', name: 'B', orientation: 'horizontal', updatedAt: 2 },
            { id: '', name: 'Nope', orientation: 'vertical' },
            { id: 'x', name: '', orientation: 'horizontal' },
            { id: 'y', name: 'Y', orientation: 'diagonal' },
        ]);

        expect(presets).toHaveLength(2);
        expect(presets[0]?.source).toBe('custom');
    });

    it('serializes presets to storage payload shape', () => {
        const serialized = serializeSplitPresets([
            createCustomSplitPreset('One', 'vertical', 100),
            createCustomSplitPreset('Two', 'horizontal', 200),
        ]);

        expect(serialized).toEqual([
            { id: 'custom-100', name: 'One', orientation: 'vertical', updatedAt: 100 },
            { id: 'custom-200', name: 'Two', orientation: 'horizontal', updatedAt: 200 },
        ]);
    });

    it('sanitizes split analytics payload', () => {
        const analytics = sanitizeSplitAnalytics({
            splitCreatedCount: 2,
            splitClosedCount: 1,
            splitOrientationToggleCount: 4,
            splitPresetApplyCount: 3,
            lastSplitActionAt: 1234,
        });
        expect(analytics.splitCreatedCount).toBe(2);
        expect(analytics.lastSplitActionAt).toBe(1234);
    });

    it('falls back to defaults for malformed analytics payload', () => {
        expect(sanitizeSplitAnalytics(null)).toEqual(DEFAULT_SPLIT_ANALYTICS);
        expect(sanitizeSplitAnalytics({ splitCreatedCount: 'wrong' })).toEqual(
            DEFAULT_SPLIT_ANALYTICS
        );
    });

    it('increments split analytics counters', () => {
        const next = incrementSplitAnalytics(DEFAULT_SPLIT_ANALYTICS, 'splitPresetApplyCount');
        expect(next.splitPresetApplyCount).toBe(1);
        expect(typeof next.lastSplitActionAt).toBe('number');
    });

    it('sanitizes split layout with valid tab ids only', () => {
        const validIds = new Set(['tab-1', 'tab-2']);
        const parsed = sanitizeSplitLayout(
            { primaryId: 'tab-1', secondaryId: 'tab-2', orientation: 'vertical' },
            validIds
        );
        expect(parsed).toEqual({
            primaryId: 'tab-1',
            secondaryId: 'tab-2',
            orientation: 'vertical',
        });
    });

    it('rejects invalid split layout payloads', () => {
        const validIds = new Set(['tab-1', 'tab-2']);
        expect(
            sanitizeSplitLayout(
                { primaryId: 'tab-1', secondaryId: 'missing', orientation: 'vertical' },
                validIds
            )
        ).toBeNull();
        expect(
            sanitizeSplitLayout(
                { primaryId: 'tab-1', secondaryId: 'tab-2', orientation: 'diagonal' },
                validIds
            )
        ).toBeNull();
    });
});
