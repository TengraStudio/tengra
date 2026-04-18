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

const RUNTIME_ROOT_FOLDER = 'runtime';
const RUNTIME_BIN_FOLDER = 'bin';
const RUNTIME_MODELS_FOLDER = 'models';
const RUNTIME_TEMP_FOLDER = 'temp';
const RUNTIME_DOWNLOADS_FOLDER = 'downloads';
const RUNTIME_MANIFESTS_FOLDER = 'manifests';
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

export function getManagedRuntimeDownloadsDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), RUNTIME_DOWNLOADS_FOLDER));
}

export function getManagedRuntimeManifestsDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), RUNTIME_MANIFESTS_FOLDER));
}

export function getManagedRuntimeBinaryPath(executable: string): string {
    return path.join(getManagedRuntimeBinDir(), normalizeExecutableName(executable));
}
