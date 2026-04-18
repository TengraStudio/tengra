/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'path';

import { app } from 'electron';

export function getBundledUtilityWorkerPath(fileName: string): string {
    const basePath = app.isPackaged
        ? process.resourcesPath
        : app.getAppPath();
    const workerDirectory = app.isPackaged
        ? path.join(basePath, 'utility-workers')
        : path.join(basePath, 'resources', 'utility-workers');
    return path.join(workerDirectory, fileName);
}
