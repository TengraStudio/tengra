/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type TerminalModuleVersion = {
    major: number;
    minor: number;
    patch: number;
};

export const TERMINAL_MODULE_VERSION: TerminalModuleVersion = Object.freeze({
    major: 2,
    minor: 0,
    patch: 0,
});

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function serializeTerminalModuleVersion(
    version: TerminalModuleVersion = TERMINAL_MODULE_VERSION
): string {
    return `${version.major}.${version.minor}.${version.patch}`;
}

export function isTerminalModuleVersionCompatible(candidate: string): boolean {
    const match = SEMVER_PATTERN.exec(candidate.trim());
    if (!match) {
        return false;
    }
    const major = Number(match[1]);
    return Number.isFinite(major) && major === TERMINAL_MODULE_VERSION.major;
}

