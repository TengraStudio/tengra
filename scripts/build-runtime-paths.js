/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_FOLDER_NAME = 'Tengra';
const RUNTIME_FOLDER_NAME = 'runtime';

function getAppDataRoot() {
    if (process.platform === 'win32') {
        return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    }

    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support');
    }

    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

function ensureDirectory(targetPath) {
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    return targetPath;
}

function getManagedRuntimeRoot() {
    return ensureDirectory(path.join(getAppDataRoot(), APP_FOLDER_NAME, RUNTIME_FOLDER_NAME));
}

function getManagedRuntimeBinDir() {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), 'bin'));
}

function getManagedRuntimeModelsDir() {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), 'models'));
}

function getManagedRuntimeTempDir() {
    return ensureDirectory(path.join(getManagedRuntimeRoot(), 'temp'));
}

function getExecutableName(baseName) {
    return process.platform === 'win32' ? `${baseName}.exe` : baseName;
}

module.exports = {
    getExecutableName,
    getManagedRuntimeBinDir,
    getManagedRuntimeModelsDir,
    getManagedRuntimeRoot,
    getManagedRuntimeTempDir,
};
