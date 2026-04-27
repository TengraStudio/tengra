/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'fs';
import path from 'path';

import { app } from 'electron';

export function getBundledUtilityWorkerPath(fileName: string): string {
    if (app.isPackaged) {
        // 1. Check bundled resources/utility-workers
        const possibleResourcePaths = [
            process.resourcesPath,
            path.join(app.getAppPath(), '..'),
            path.join(path.dirname(app.getPath('exe')), 'resources')
        ];

        for (const resPath of possibleResourcePaths) {
            if (!resPath) {continue;}
            const bundledPath = path.join(resPath, 'utility-workers', fileName);
            if (fs.existsSync(bundledPath)) {
                return bundledPath;
            }
        }

        // 2. Check in app root fallback
        const appRootDirPath = path.join(path.dirname(app.getPath('exe')), 'utility-workers', fileName);
        if (fs.existsSync(appRootDirPath)) {
            return appRootDirPath;
        }

        // Default to the first possible location if not found
        return path.join(process.resourcesPath, 'utility-workers', fileName);
    }

    return path.join(app.getAppPath(), 'src', 'main', 'workers', fileName);
}
