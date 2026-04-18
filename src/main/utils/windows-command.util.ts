/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const WINDOWS_CMD_SHIMS = new Set(['npm', 'npx', 'pnpm', 'yarn']);

export function resolveWindowsCommand(command: string): string {
    if (process.platform !== 'win32') {
        return command;
    }

    const normalized = command.trim().toLowerCase();
    if (!normalized) {
        return command;
    }

    if (normalized.endsWith('.exe') || normalized.endsWith('.cmd') || normalized.endsWith('.bat')) {
        return command;
    }

    if (WINDOWS_CMD_SHIMS.has(normalized)) {
        return `${command}.cmd`;
    }

    return command;
}

export interface WindowsSpawnCommand {
    command: string;
    args: string[];
}

export function createWindowsSpawnCommand(command: string, args: string[]): WindowsSpawnCommand {
    const resolvedCommand = resolveWindowsCommand(command);
    if (process.platform !== 'win32') {
        return {
            command: resolvedCommand,
            args
        };
    }

    const normalized = resolvedCommand.trim().toLowerCase();
    const isCmdScript = normalized.endsWith('.cmd') || normalized.endsWith('.bat');
    if (!isCmdScript) {
        return {
            command: resolvedCommand,
            args
        };
    }

    return {
        command: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', resolvedCommand, ...args]
    };
}
