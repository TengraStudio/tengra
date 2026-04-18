/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    RemoteDockerContainer,
    RemoteSshProfile,
} from './terminal-panel-types';

/**
 * Convert unknown value to display string
 * 
 * @param value - Value to convert
 * @returns Display string
 */
export function toDisplayString(value: RendererDataValue): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Quote command value for safe shell execution
 * 
 * @param value - Value to quote
 * @returns Quoted value
 */
export function quoteCommandValue(value: string): string {
    if (!value) {
        return '""';
    }
    if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) {
        return value;
    }
    return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

/**
 * Clamp value between min and max
 * 
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Normalize SSH profiles from raw data
 * 
 * @param raw - Raw data
 * @returns Normalized SSH profiles
 */
export function normalizeSshProfiles(raw: RendererDataValue): RemoteSshProfile[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const profiles: RemoteSshProfile[] = [];
    raw.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const record = item as Record<string, RendererDataValue>;
        const host = toDisplayString(record.host);
        const username = toDisplayString(record.username);
        if (!host || !username) {
            return;
        }
        const port = Number(record.port) > 0 ? Number(record.port) : 22;
        const profileId = toDisplayString(record.id) || `${username}@${host}:${port}:${index}`;
        const fallbackName = `${username}@${host}`;
        profiles.push({
            id: profileId,
            name: toDisplayString(record.name) || fallbackName,
            host,
            port,
            username,
            privateKey: toDisplayString(record.privateKey) || undefined,
            jumpHost: toDisplayString(record.jumpHost) || undefined,
        });
    });
    return profiles;
}

/**
 * Parse Docker container record
 * 
 * @param record - Container record
 * @param index - Container index
 * @returns Normalized container or null
 */
function parseDockerContainerRecord(
    record: Record<string, RendererDataValue>
): RemoteDockerContainer | null {
    const id =
        toDisplayString(record.id) ||
        toDisplayString(record.ID) ||
        toDisplayString(record.Id) ||
        '';
    const name =
        toDisplayString(record.name) ||
        toDisplayString(record.Name) ||
        toDisplayString(record.Names);
    const status =
        toDisplayString(record.status) ||
        toDisplayString(record.Status) ||
        toDisplayString(record.State) ||
        '';
    const shell = toDisplayString(record.shell) || toDisplayString(record.Shell) || '/bin/sh';

    if (!id || !name) {
        return null;
    }

    return {
        id,
        name,
        status,
        shell,
    };
}

/**
 * Normalize Docker containers from raw data
 * 
 * @param raw - Raw data
 * @returns Normalized Docker containers
 */
export function normalizeDockerContainers(raw: RendererDataValue): RemoteDockerContainer[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const containers: RemoteDockerContainer[] = [];
    raw.forEach(item => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const container = parseDockerContainerRecord(item as Record<string, RendererDataValue>);
        if (container) {
            containers.push(container);
        }
    });
    return containers;
}
