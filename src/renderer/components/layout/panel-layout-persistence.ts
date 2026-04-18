/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const PANEL_LAYOUT_STORAGE_KEY = 'tengra.panel-layout.v1';

export interface PersistedPanelGroupState {
    size?: number;
    collapsed?: boolean;
    activePanel?: string;
}

export interface PersistedPanelLayout {
    version: number;
    groups: Record<string, PersistedPanelGroupState>;
}

const PANEL_LAYOUT_VERSION = 1;

function isObject(value: RendererDataValue): value is Record<string, RendererDataValue> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toBoundedSize(value: RendererDataValue): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(120, Math.min(1600, Math.floor(value)));
}

function sanitizePanelGroup(value: RendererDataValue): PersistedPanelGroupState | null {
    if (!isObject(value)) {
        return null;
    }
    return {
        size: toBoundedSize(value.size),
        collapsed: typeof value.collapsed === 'boolean' ? value.collapsed : undefined,
        activePanel:
            typeof value.activePanel === 'string' && value.activePanel.trim()
                ? value.activePanel.trim()
                : undefined,
    };
}

function sanitizeGroups(
    value: RendererDataValue
): Record<string, PersistedPanelGroupState> {
    if (!isObject(value)) {
        return {};
    }
    const groups: Record<string, PersistedPanelGroupState> = {};
    for (const [key, rawGroup] of Object.entries(value)) {
        const group = sanitizePanelGroup(rawGroup);
        if (!group) {
            continue;
        }
        groups[key] = group;
    }
    return groups;
}

function migrateLegacyPanelLayout(raw: RendererDataValue): PersistedPanelLayout | null {
    if (!isObject(raw) || !isObject(raw.groups)) {
        return null;
    }
    return {
        version: PANEL_LAYOUT_VERSION,
        groups: sanitizeGroups(raw.groups),
    };
}

export function sanitizePersistedPanelLayout(raw: RendererDataValue): PersistedPanelLayout {
    const migrated = migrateLegacyPanelLayout(raw);
    if (migrated) {
        return migrated;
    }
    if (!isObject(raw)) {
        return {
            version: PANEL_LAYOUT_VERSION,
            groups: {},
        };
    }
    return {
        version: PANEL_LAYOUT_VERSION,
        groups: sanitizeGroups(raw.groups),
    };
}

export function parsePersistedPanelLayout(raw: string | null): PersistedPanelLayout | null {
    if (!raw) {
        return null;
    }
    try {
        return sanitizePersistedPanelLayout(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function serializePersistedPanelLayout(layout: PersistedPanelLayout): string {
    return JSON.stringify({
        version: PANEL_LAYOUT_VERSION,
        groups: layout.groups,
    });
}

export function getPersistedPanelLayoutSnapshot(): PersistedPanelLayout | null {
    try {
        return parsePersistedPanelLayout(window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY));
    } catch {
        return null;
    }
}

