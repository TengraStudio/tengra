import * as fs from 'fs';
import * as path from 'path';

import { app } from 'electron';

const RUNTIME_ROOT_FOLDER = 'runtime';
const RUNTIME_BIN_FOLDER = 'bin';
const RUNTIME_MODELS_FOLDER = 'models';
const RUNTIME_TEMP_FOLDER = 'temp';
const APP_FOLDER_NAME = 'Tengra';

function getManagedAppRoot(): string {
    return path.join(app.getPath('appData'), APP_FOLDER_NAME);
}

function ensureDirectory(targetPath: string): string {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    return targetPath;
}

function normalizeExecutableName(name: string): string {
    if (process.platform === 'win32') {
        return name.endsWith('.exe') ? name : `${name}.exe`;
    }

    return name.endsWith('.exe') ? name.slice(0, -4) : name;
}

export function getManagedRuntimeRoot(): string {
    return ensureDirectory(path.join(getManagedAppRoot(), RUNTIME_ROOT_FOLDER));
}

export function getManagedRuntimeBinDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), RUNTIME_BIN_FOLDER));
}

export function getManagedRuntimeModelsDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), RUNTIME_MODELS_FOLDER));
}

export function getManagedRuntimeTempDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), RUNTIME_TEMP_FOLDER));
}

export function getManagedRuntimeBinaryPath(executable: string): string {
    return path.join(getManagedRuntimeBinDir(), normalizeExecutableName(executable));
}

