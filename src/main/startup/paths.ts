import * as fs from 'fs';
import * as path from 'path';

import { app } from 'electron';

// Set app name early to ensure getPath('userData') is correct
app.setName('Tengra');

const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';

// In Dev mode, we might still want to isolate data, 
// but the user specifically requested Roaming/Tengra.
// If we want to strictly follow the user's request for Roaming:
const userDataPath = app.getPath('userData');

// Ensure path exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

// Set session data relative to userData
app.setPath('sessionData', path.join(userDataPath, 'electron'));

// Sync environment variable for native services
process.env.TENGRA_USER_DATA_ROOT = userDataPath;

console.error(`[BOOT] Paths initialized: userData=${userDataPath}`);

export const A_INIT = true;
export const APP_ROOT = userDataPath;
export { isDev };
