/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    clampToViewport,
    resolveTooltipPosition,
    type TooltipPosition,
} from '@/components/ui/tooltip-utils';

function setViewport(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: height,
    });
}

function rect(input: { top: number; left: number; width: number; height: number }): DOMRect {
    const { top, left, width, height } = input;
    return {
        top,
        left,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
    } as DOMRect;
}

describe('tooltip utils', () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;

    beforeEach(() => {
        setViewport(400, 300);
    });

    afterEach(() => {
        setViewport(originalWidth, originalHeight);
    });

    it('clamps tooltip coordinates to viewport bounds', () => {
        const tooltipRect = rect({ top: 0, left: 0, width: 120, height: 80 });
        const clamped = clampToViewport({ top: -20, left: 380 }, tooltipRect, 8);

        expect(clamped).toEqual({ top: 8, left: 272 });
    });

    it('falls back to a side with less overflow and clamps final position', () => {
        const result = resolveTooltipPosition({
            preferredSide: 'top',
            triggerRect: rect({ top: 6, left: 140, width: 60, height: 20 }),
            tooltipRect: rect({ top: 0, left: 0, width: 140, height: 90 }),
            gap: 8,
        });

        expect(result.side).toBe('bottom');
        expect(result.position.top).toBeGreaterThanOrEqual(8);
        expect(result.position.left).toBeGreaterThanOrEqual(8);
    });

    it('returns a stable position shape', () => {
        const position: TooltipPosition = resolveTooltipPosition({
            preferredSide: 'right',
            triggerRect: rect({ top: 80, left: 80, width: 20, height: 20 }),
            tooltipRect: rect({ top: 0, left: 0, width: 90, height: 50 }),
            gap: 8,
        }).position;

        expect(typeof position.top).toBe('number');
        expect(typeof position.left).toBe('number');
    });
});

