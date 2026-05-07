/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IMcpPlugin } from '@main/mcp/plugin-base';

/** Parsed semver triple */
interface SemverTriple {
    major: number
    minor: number
    patch: number
}

/** Parse a semver string into components. Returns null on invalid input. */
function parseSemver(version: string): SemverTriple | null {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (!match) {return null;}
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Check if `actual` satisfies the `required` version constraint.
 * Supports exact match and `>=x.y.z` ranges.
 */
export function isVersionCompatible(required: string, actual: string): boolean {
    const isGte = required.startsWith('>=');
    const reqStr = isGte ? required.slice(2).trim() : required.trim();
    const req = parseSemver(reqStr);
    const act = parseSemver(actual);
    if (!req || !act) {return false;}
    if (isGte) {
        const actNum = act.major * 1_000_000 + act.minor * 1_000 + act.patch;
        const reqNum = req.major * 1_000_000 + req.minor * 1_000 + req.patch;
        return actNum >= reqNum;
    }
    return act.major === req.major && act.minor >= req.minor;
}

/** Result of dependency resolution */
export interface DependencyResult {
    satisfied: boolean
    errors: string[]
}

/**
 * Verify that every plugin's declared dependencies are met by the provided plugin set.
 * Returns a result with any unmet dependency errors.
 */
export function resolvePluginDependencies(plugins: ReadonlyArray<IMcpPlugin>): DependencyResult {
    const pluginMap = new Map<string, string>();
    for (const p of plugins) {
        pluginMap.set(p.name, p.version ?? '0.0.0');
    }

    const errors: string[] = [];
    for (const p of plugins) {
        if (!p.dependencies) {continue;}
        for (const [depName, depRange] of Object.entries(p.dependencies) as Array<[string, string]>) {
            const depVersion = pluginMap.get(depName);
            if (!depVersion) {
                errors.push(`Plugin "${p.name}" requires missing plugin "${depName}"`);
            } else if (!isVersionCompatible(depRange, depVersion)) {
                errors.push(`Plugin "${p.name}" requires "${depName}" ${depRange}, found ${depVersion}`);
            }
        }
    }
    return { satisfied: errors.length === 0, errors };
}

