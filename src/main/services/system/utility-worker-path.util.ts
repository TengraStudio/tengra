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
