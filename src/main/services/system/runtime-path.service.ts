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
const RUNTIME_MANAGED_FOLDER = 'managed';
const RUNTIME_CACHE_FOLDER = 'cache';
const RUNTIME_BIN_FOLDER = 'bin';
const RUNTIME_MODELS_FOLDER = 'models';
const RUNTIME_TEMP_FOLDER = 'temp';
const RUNTIME_DOWNLOADS_FOLDER = 'downloads';
const RUNTIME_MANIFESTS_FOLDER = 'manifests';
const ASSETS_BIN_FOLDER = path.join('assets', 'bin');
const BUNDLED_BIN_FOLDERS = [
    path.join(process.resourcesPath || '', ASSETS_BIN_FOLDER),
    path.join(app?.getAppPath?.() || process.cwd(), ASSETS_BIN_FOLDER),
    path.join(path.dirname(app?.getPath?.('exe') || process.cwd()), 'resources', ASSETS_BIN_FOLDER),
    path.join(process.cwd(), ASSETS_BIN_FOLDER),
];

function getManagedAppRoot(): string {
    return app.getPath('userData');
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

export function getBundledRuntimeBinaryPath(executable: string): string | null {
    const normalizedName = normalizeExecutableName(executable);
    for (const root of BUNDLED_BIN_FOLDERS) {
        const platformPath = path.join(root, process.platform, normalizedName);
        if (fs.existsSync(platformPath)) {
            return platformPath;
        }

        const flatPath = path.join(root, normalizedName);
        if (fs.existsSync(flatPath)) {
            return flatPath;
        }
    }

    return null;
}

function copyBundledBinaryToManagedPath(executable: string): string | null {
    const bundledPath = getBundledRuntimeBinaryPath(executable);
    if (!bundledPath) {
        return null;
    }

    const normalizedName = normalizeExecutableName(executable);
    const managedPath = path.join(getManagedRuntimeBinDir(), normalizedName);

    if (fs.existsSync(managedPath)) {
        return managedPath;
    }

    fs.mkdirSync(path.dirname(managedPath), { recursive: true });
    fs.copyFileSync(bundledPath, managedPath);
    return managedPath;
}

export function getManagedRuntimeRoot(): string {
    return ensureDirectory(path.join(getManagedAppRoot(), RUNTIME_ROOT_FOLDER, RUNTIME_MANAGED_FOLDER));
}

export function getManagedRuntimeCacheRoot(): string {
    return ensureDirectory(path.join(getManagedAppRoot(), RUNTIME_ROOT_FOLDER, RUNTIME_CACHE_FOLDER));
}

export function getManagedRuntimeBinDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), RUNTIME_BIN_FOLDER));
}

export function getManagedRuntimeModelsDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), RUNTIME_MODELS_FOLDER));
}

export function getManagedRuntimeTempDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeCacheRoot(), RUNTIME_TEMP_FOLDER));
}

export function getManagedRuntimeDownloadsDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeCacheRoot(), RUNTIME_DOWNLOADS_FOLDER));
}

export function getManagedRuntimeManifestsDir(): string {
    return ensureDirectory(path.join(getManagedRuntimeCacheRoot(), RUNTIME_MANIFESTS_FOLDER));
}

export function getManagedRuntimeBinaryPath(executable: string): string {
    const normalizedName = normalizeExecutableName(executable);

    const managedPath = path.join(getManagedRuntimeBinDir(), normalizedName);
    if (fs.existsSync(managedPath)) {
        return managedPath;
    }

    const stagedPath = copyBundledBinaryToManagedPath(normalizedName);
    if (stagedPath) {
        return stagedPath;
    }

    return managedPath;
}

