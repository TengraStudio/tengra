/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type SplitViewState = {
    primaryId: string;
    secondaryId: string;
    orientation: 'vertical' | 'horizontal';
};

export type SplitPreset = {
    id: string;
    name: string;
    orientation: SplitViewState['orientation'];
    source: 'default' | 'custom';
    updatedAt: number;
};

export type SplitAnalytics = {
    splitCreatedCount: number;
    splitClosedCount: number;
    splitOrientationToggleCount: number;
    splitPresetApplyCount: number;
    lastSplitActionAt: number | null;
};

export const TERMINAL_SPLIT_PRESET_LIMIT = 8;

export const DEFAULT_SPLIT_PRESETS: SplitPreset[] = [
    {
        id: 'default-vertical',
        name: 'Vertical Split',
        orientation: 'vertical',
        source: 'default',
        updatedAt: 0,
    },
    {
        id: 'default-horizontal',
        name: 'Horizontal Split',
        orientation: 'horizontal',
        source: 'default',
        updatedAt: 0,
    },
];

export const DEFAULT_SPLIT_ANALYTICS: SplitAnalytics = {
    splitCreatedCount: 0,
    splitClosedCount: 0,
    splitOrientationToggleCount: 0,
    splitPresetApplyCount: 0,
    lastSplitActionAt: null,
};

export function sanitizeSplitPresets(
    raw: RendererDataValue,
    limit: number = TERMINAL_SPLIT_PRESET_LIMIT
): SplitPreset[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((item): SplitPreset | null => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            const record = item as Record<string, RendererDataValue>;
            const id = typeof record.id === 'string' ? record.id.trim() : '';
            const name = typeof record.name === 'string' ? record.name.trim() : '';
            const orientation = record.orientation;
            if (!id || !name || (orientation !== 'vertical' && orientation !== 'horizontal')) {
                return null;
            }
            return {
                id,
                name,
                orientation,
                source: 'custom',
                updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
            };
        })
        .filter((preset): preset is SplitPreset => preset !== null)
        .slice(0, limit);
}

export function serializeSplitPresets(
    presets: SplitPreset[],
    limit: number = TERMINAL_SPLIT_PRESET_LIMIT
): Array<Pick<SplitPreset, 'id' | 'name' | 'orientation' | 'updatedAt'>> {
    return presets.slice(0, limit).map(({ id, name, orientation, updatedAt }) => ({
        id,
        name,
        orientation,
        updatedAt,
    }));
}

export function sanitizeSplitAnalytics(raw: RendererDataValue): SplitAnalytics {
    if (!raw || typeof raw !== 'object') {
        return DEFAULT_SPLIT_ANALYTICS;
    }
    const parsed = raw as Partial<SplitAnalytics>;
    return {
        splitCreatedCount:
            typeof parsed.splitCreatedCount === 'number' ? parsed.splitCreatedCount : 0,
        splitClosedCount: typeof parsed.splitClosedCount === 'number' ? parsed.splitClosedCount : 0,
        splitOrientationToggleCount:
            typeof parsed.splitOrientationToggleCount === 'number'
                ? parsed.splitOrientationToggleCount
                : 0,
        splitPresetApplyCount:
            typeof parsed.splitPresetApplyCount === 'number' ? parsed.splitPresetApplyCount : 0,
        lastSplitActionAt:
            typeof parsed.lastSplitActionAt === 'number' ? parsed.lastSplitActionAt : null,
    };
}

export function incrementSplitAnalytics(
    analytics: SplitAnalytics,
    kind: keyof Omit<SplitAnalytics, 'lastSplitActionAt'>
): SplitAnalytics {
    return {
        ...analytics,
        [kind]: analytics[kind] + 1,
        lastSplitActionAt: Date.now(),
    };
}

export function sanitizeSplitLayout(
    raw: RendererDataValue,
    validIds: Set<string>
): SplitViewState | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const parsed = raw as Partial<SplitViewState>;
    if (
        typeof parsed.primaryId !== 'string' ||
        typeof parsed.secondaryId !== 'string' ||
        (parsed.orientation !== 'vertical' && parsed.orientation !== 'horizontal')
    ) {
        return null;
    }
    if (!validIds.has(parsed.primaryId) || !validIds.has(parsed.secondaryId)) {
        return null;
    }
    return {
        primaryId: parsed.primaryId,
        secondaryId: parsed.secondaryId,
        orientation: parsed.orientation,
    };
}

export function createCustomSplitPreset(
    name: string,
    orientation: SplitViewState['orientation'],
    now: number = Date.now()
): SplitPreset {
    return {
        id: `custom-${now}`,
        name,
        orientation,
        source: 'custom',
        updatedAt: now,
    };
}

