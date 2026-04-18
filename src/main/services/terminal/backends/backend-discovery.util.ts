/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { execFile } from 'child_process';
import { constants as fsConstants, promises as fs } from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function findExecutableInPath(executableName: string): Promise<string | null> {
    const locator = process.platform === 'win32' ? 'where' : 'which';

    try {
        const { stdout } = await execFileAsync(locator, [executableName], {
            windowsHide: true,
        });
        const candidates = stdout
            .split(/\r?\n/)
            .map(candidate => candidate.trim())
            .filter(candidate => candidate.length > 0);
        return candidates[0] ?? null;
    } catch {
        return null;
    }
}

export async function pathExists(candidatePath: string): Promise<boolean> {
    try {
        await fs.access(candidatePath, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

export async function findFirstExistingPath(
    candidatePaths: readonly string[]
): Promise<string | null> {
    for (const candidatePath of candidatePaths) {
        if (await pathExists(candidatePath)) {
            return candidatePath;
        }
    }
    return null;
}
