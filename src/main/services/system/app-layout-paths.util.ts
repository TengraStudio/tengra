/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';

import { app } from 'electron';

function ensureDirectory(targetPath: string): string {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    return targetPath;
}

export function getTengraRootPath(): string {
    return ensureDirectory(app.getPath('userData'));
}

export function getDataRootPath(): string {
    return ensureDirectory(path.join(getTengraRootPath(), 'data'));
}

export function getDataSubPath(...segments: string[]): string {
    return ensureDirectory(path.join(getDataRootPath(), ...segments));
}

export function getDataFilePath(...segments: string[]): string {
    const filePath = path.join(getDataRootPath(), ...segments);
    ensureDirectory(path.dirname(filePath));
    return filePath;
}

