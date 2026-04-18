/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcRenderer } from 'electron';

export interface BackupBridge {
    create: (options?: {
        includeChats?: boolean;
        includeAuth?: boolean;
        includeSettings?: boolean;
        includePrompts?: boolean;
        incremental?: boolean;
        compress?: boolean;
        encrypt?: boolean;
        verify?: boolean;
        cloudSyncDir?: string;
    }) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
        metadata?: {
            version: string;
            createdAt: string;
            appVersion: string;
            platform: string;
            includes: string[];
            checksum?: string;
            compressed?: boolean;
            encrypted?: boolean;
            incremental?: boolean;
            baseBackup?: string;
        };
    }>;
    restore: (
        backupPath: string,
        options?: {
            restoreChats?: boolean;
            restoreSettings?: boolean;
            restorePrompts?: boolean;
            mergeChats?: boolean;
        }
    ) => Promise<{ success: boolean; restored: string[]; errors: string[] }>;
    list: () => Promise<
        Array<{
            name: string;
            path: string;
            metadata?: {
                version: string;
                createdAt: string;
                appVersion: string;
                platform: string;
                includes: string[];
            };
        }>
    >;
    delete: (backupPath: string) => Promise<boolean>;
    getDir: () => Promise<string>;
    getAutoBackupStatus: () => Promise<{
        enabled: boolean;
        intervalHours: number;
        maxBackups: number;
        lastBackup: string | null;
        compression: boolean;
        encryption: boolean;
        verification: boolean;
        cloudSyncDir?: string;
    }>;
    configureAutoBackup: (config: {
        enabled: boolean;
        intervalHours?: number;
        maxBackups?: number;
        compression?: boolean;
        encryption?: boolean;
        verification?: boolean;
        cloudSyncDir?: string;
    }) => Promise<void>;
    cleanup: () => Promise<number>;
    verify: (
        backupPath: string
    ) => Promise<{ valid: boolean; checksum?: string; error?: string }>;
    syncToCloudDir: (
        backupPath: string,
        targetDir: string
    ) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
    createDisasterRecoveryBundle: (
        targetDir?: string
    ) => Promise<{ success: boolean; bundlePath?: string; files?: string[]; error?: string }>;
    restoreDisasterRecoveryBundle: (
        bundlePath: string
    ) => Promise<{ success: boolean; restored: string[]; errors: string[] }>;
}

export function createBackupBridge(ipc: IpcRenderer): BackupBridge {
    return {
        create: options => ipc.invoke('backup:create', options),
        restore: (backupPath, options) => ipc.invoke('backup:restore', backupPath, options),
        list: () => ipc.invoke('backup:list'),
        delete: backupPath => ipc.invoke('backup:delete', backupPath),
        getDir: () => ipc.invoke('backup:getDir'),
        getAutoBackupStatus: () => ipc.invoke('backup:getAutoBackupStatus'),
        configureAutoBackup: config => ipc.invoke('backup:configureAutoBackup', config),
        cleanup: () => ipc.invoke('backup:cleanup'),
        verify: backupPath => ipc.invoke('backup:verify', backupPath),
        syncToCloudDir: (backupPath, targetDir) =>
            ipc.invoke('backup:syncToCloudDir', backupPath, targetDir),
        createDisasterRecoveryBundle: targetDir =>
            ipc.invoke('backup:createDisasterRecoveryBundle', targetDir),
        restoreDisasterRecoveryBundle: bundlePath =>
            ipc.invoke('backup:restoreDisasterRecoveryBundle', bundlePath),
    };
}
