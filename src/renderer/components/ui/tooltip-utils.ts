/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipPosition {
    top: number;
    left: number;
}

type PositionCalculator = (
    triggerRect: DOMRect,
    tooltipRect: DOMRect,
    gap: number
) => TooltipPosition;

export const POSITION_CALCULATORS: Record<TooltipSide, PositionCalculator> = {
    top: (triggerRect, tooltipRect, gap) => ({
        top: triggerRect.top - tooltipRect.height - gap,
        left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
    }),
    bottom: (triggerRect, tooltipRect, gap) => ({
        top: triggerRect.bottom + gap,
        left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2,
    }),
    left: (triggerRect, tooltipRect, gap) => ({
        top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
        left: triggerRect.left - tooltipRect.width - gap,
    }),
    right: (triggerRect, tooltipRect, gap) => ({
        top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
        left: triggerRect.right + gap,
    }),
};

export function clampToViewport(
    position: TooltipPosition,
    tooltipRect: DOMRect,
    gap: number
): TooltipPosition {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let { left, top } = position;

    if (left < gap) {
        left = gap;
    }
    if (left + tooltipRect.width > viewportWidth - gap) {
        left = viewportWidth - tooltipRect.width - gap;
    }
    if (top < gap) {
        top = gap;
    }
    if (top + tooltipRect.height > viewportHeight - gap) {
        top = viewportHeight - tooltipRect.height - gap;
    }
    return { left, top };
}

function overflowScore(position: TooltipPosition, tooltipRect: DOMRect, gap: number): number {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const overflowLeft = Math.max(0, gap - position.left);
    const overflowTop = Math.max(0, gap - position.top);
    const overflowRight = Math.max(0, position.left + tooltipRect.width - (viewportWidth - gap));
    const overflowBottom = Math.max(0, position.top + tooltipRect.height - (viewportHeight - gap));
    return overflowLeft + overflowTop + overflowRight + overflowBottom;
}

export function resolveTooltipPosition(options: {
    preferredSide: TooltipSide;
    triggerRect: DOMRect;
    tooltipRect: DOMRect;
    gap: number;
}): { side: TooltipSide; position: TooltipPosition } {
    const orderedSides: TooltipSide[] = [
        options.preferredSide,
        ...(['top', 'bottom', 'left', 'right'] as TooltipSide[]).filter(
            side => side !== options.preferredSide
        ),
    ];

    let bestSide = orderedSides[0];
    let bestPosition = POSITION_CALCULATORS[bestSide](
        options.triggerRect,
        options.tooltipRect,
        options.gap
    );
    let bestScore = overflowScore(bestPosition, options.tooltipRect, options.gap);

    for (const side of orderedSides.slice(1)) {
        const candidate = POSITION_CALCULATORS[side](
            options.triggerRect,
            options.tooltipRect,
            options.gap
        );
        const score = overflowScore(candidate, options.tooltipRect, options.gap);
        if (score < bestScore) {
            bestScore = score;
            bestSide = side;
            bestPosition = candidate;
        }
    }

    return {
        side: bestSide,
        position: clampToViewport(bestPosition, options.tooltipRect, options.gap),
    };
}
