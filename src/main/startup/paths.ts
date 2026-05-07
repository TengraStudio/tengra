import * as fs from 'fs';
import * as path from 'path';

import { app } from 'electron';

const isDev = process.env.NODE_ENV === 'development';

let appRoot = '';

export function initializeAppPaths(): string {
    if (appRoot) {
        return appRoot;
    }

    app.setName('Tengra');
    const userDataPath = app.getPath('userData');

    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }

    app.setPath('sessionData', path.join(userDataPath, 'electron'));
    process.env.TENGRA_USER_DATA_ROOT = userDataPath;
    appRoot = userDataPath;

    console.error(`[BOOT] Paths initialized: userData=${userDataPath}`);

    return appRoot;
}

export const APP_ROOT = (): string => appRoot || initializeAppPaths();
export { isDev };

