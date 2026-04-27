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
    
    // 1. Check bundled resources/bin (Modern structured path)
    // We use multiple ways to find the resources path to be safe
    const possibleResourcePaths = [
        process.resourcesPath,
        path.join(app.getAppPath(), '..'),
        path.join(path.dirname(app.getPath('exe')), 'resources')
    ];

    for (const resPath of possibleResourcePaths) {
        if (!resPath) {continue;}
        
        // Try platform-specific path first (e.g., bin/win32/...)
        const platformPath = path.join(resPath, 'bin', process.platform, normalizedName);
        if (fs.existsSync(platformPath)) {
            return platformPath;
        }

        // Fallback to flat path (e.g., bin/...)
        const bundledPath = path.join(resPath, 'bin', normalizedName);
        if (fs.existsSync(bundledPath)) {
            return bundledPath;
        }
    }

    // 2. Check in app root (Legacy/Portable fallback)
    const appRootDirBin = path.join(path.dirname(app.getPath('exe')), 'bin', normalizedName);
    if (fs.existsSync(appRootDirBin)) {
        return appRootDirBin;
    }

    // 3. In development, check project root bin
    if (!app.isPackaged) {
        const devBinPath = path.join(app.getAppPath(), 'bin', normalizedName);
        if (fs.existsSync(devBinPath)) {
            return devBinPath;
        }
    }

    // 4. Final fallback to managed runtime directory in AppData
    return path.join(getManagedRuntimeBinDir(), normalizedName);
}
