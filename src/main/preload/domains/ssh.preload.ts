/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SSH_CHANNELS } from '@shared/constants/ipc-channels';
import {
    SSHConfig,
    SSHConnection,
    SSHDevContainer,
    SSHExecOptions,
    SSHFile,
    SSHKnownHostEntry,
    SSHManagedKey,
    SSHPackageInfo,
    SSHPortForward,
    SSHProfileTemplate,
    SSHRemoteSearchResult,
    SSHSearchHistoryEntry,
    SSHSessionRecording,
    SSHSystemStats,
    SSHTransferTask,
    SSHTunnelPreset,
} from '@shared/types';
import { IpcRenderer } from 'electron';

export interface SSHBridge {
    connect: (
        connection: SSHConnection
    ) => Promise<{ success: boolean; error?: string; id?: string; diagnostics?: { category: string; hint: string } }>;
    disconnect: (connectionId: string) => Promise<{ success: boolean }>;
    execute: (
        connectionId: string,
        command: string,
        options?: SSHExecOptions
    ) => Promise<{ stdout: string; stderr: string; code: number }>;
    upload: (
        connectionId: string,
        localPath: string,
        remotePath: string
    ) => Promise<{ success: boolean; error?: string }>;
    download: (
        connectionId: string,
        remotePath: string,
        localPath: string
    ) => Promise<{ success: boolean; error?: string }>;
    listDir: (
        connectionId: string,
        remotePath: string
    ) => Promise<{ success: boolean; files?: SSHFile[]; error?: string }>;
    readFile: (
        connectionId: string,
        remotePath: string
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (
        connectionId: string,
        remotePath: string,
        content: string
    ) => Promise<{ success: boolean; error?: string }>;
    deleteDir: (
        connectionId: string,
        path: string
    ) => Promise<{ success: boolean; error?: string }>;
    deleteFile: (
        connectionId: string,
        path: string
    ) => Promise<{ success: boolean; error?: string }>;
    mkdir: (
        connectionId: string,
        path: string
    ) => Promise<{ success: boolean; error?: string }>;
    rename: (
        connectionId: string,
        oldPath: string,
        newPath: string
    ) => Promise<{ success: boolean; error?: string }>;
    copyPath: (
        connectionId: string,
        sourcePath: string,
        destinationPath: string
    ) => Promise<{ success: boolean; error?: string }>;
    getConnections: () => Promise<SSHConnection[]>;
    isConnected: (connectionId: string) => Promise<boolean>;
    onStdout: (callback: (data: string | Uint8Array) => void) => void;
    onStderr: (callback: (data: string | Uint8Array) => void) => void;
    onConnected: (callback: (connectionId: string) => void) => void;
    onDisconnected: (callback: (connectionId: string) => void) => void;
    onUploadProgress: (
        callback: (progress: { transferred: number; total: number }) => void
    ) => void;
    onDownloadProgress: (
        callback: (progress: { transferred: number; total: number }) => void
    ) => void;
    removeAllListeners: () => void;
    onShellData: (callback: (data: { data: string }) => void) => void;
    shellStart: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
    shellWrite: (
        connectionId: string,
        data: string
    ) => Promise<{ success: boolean; error?: string }>;
    getSystemStats: (connectionId: string) => Promise<SSHSystemStats>;
    getInstalledPackages: (
        connectionId: string,
        manager?: 'apt' | 'npm' | 'pip'
    ) => Promise<SSHPackageInfo[]>;
    getLogFiles: (connectionId: string) => Promise<string[]>;
    readLogFile: (connectionId: string, path: string, lines?: number) => Promise<string>;
    getProfiles: () => Promise<SSHConfig[]>;
    saveProfile: (profile: SSHConfig) => Promise<boolean>;
    deleteProfile: (id: string) => Promise<boolean>;
    createTunnel: (payload: {
        connectionId: string;
        type: 'local' | 'remote' | 'dynamic';
        localHost: string;
        localPort: number;
        remoteHost?: string;
        remotePort?: number;
    }) => Promise<{ success: boolean; forwardId?: string; error?: string }>;
    listTunnels: (connectionId?: string) => Promise<SSHPortForward[]>;
    closeTunnel: (forwardId: string) => Promise<boolean>;
    saveTunnelPreset: (preset: {
        name: string;
        type: 'local' | 'remote' | 'dynamic';
        localHost: string;
        localPort: number;
        remoteHost: string;
        remotePort: number;
    }) => Promise<SSHTunnelPreset>;
    listTunnelPresets: () => Promise<SSHTunnelPreset[]>;
    deleteTunnelPreset: (id: string) => Promise<boolean>;
    listManagedKeys: () => Promise<SSHManagedKey[]>;
    generateManagedKey: (payload: { name: string; passphrase?: string }) => Promise<{
        key: SSHManagedKey;
        privateKey: string;
        publicKey: string;
    }>;
    importManagedKey: (payload: {
        name: string;
        privateKey: string;
        passphrase?: string;
    }) => Promise<SSHManagedKey>;
    deleteManagedKey: (id: string) => Promise<boolean>;
    rotateManagedKey: (payload: { id: string; nextPassphrase?: string }) => Promise<SSHManagedKey | null>;
    backupManagedKey: (id: string) => Promise<{ filename: string; privateKey: string } | null>;
    listKnownHosts: () => Promise<SSHKnownHostEntry[]>;
    addKnownHost: (payload: SSHKnownHostEntry) => Promise<boolean>;
    removeKnownHost: (payload: { host: string; keyType?: string }) => Promise<boolean>;
    searchRemoteFiles: (payload: {
        connectionId: string;
        query: string;
        options?: { path?: string; contentSearch?: boolean; limit?: number };
    }) => Promise<SSHRemoteSearchResult[]>;
    getSearchHistory: (connectionId?: string) => Promise<SSHSearchHistoryEntry[]>;
    exportSearchHistory: () => Promise<string>;
    reconnect: (connectionId: string, retries?: number) => Promise<{ success: boolean; error?: string }>;
    acquireConnection: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
    releaseConnection: (connectionId: string) => Promise<boolean>;
    getConnectionPoolStats: () => Promise<Array<{ connectionId: string; refs: number }>>;
    enqueueTransfer: (task: SSHTransferTask) => Promise<void>;
    getTransferQueue: () => Promise<SSHTransferTask[]>;
    runTransferBatch: (tasks: SSHTransferTask[], concurrency?: number) => Promise<boolean[]>;
    listRemoteContainers: (connectionId: string) => Promise<SSHDevContainer[]>;
    runRemoteContainer: (payload: {
        connectionId: string;
        image: string;
        name: string;
        ports?: Array<{ hostPort: number; containerPort: number }>;
    }) => Promise<{ success: boolean; id?: string; error?: string }>;
    stopRemoteContainer: (connectionId: string, containerId: string) => Promise<boolean>;
    saveProfileTemplate: (template: {
        name: string;
        port: number;
        username: string;
        tags?: string[];
    }) => Promise<SSHProfileTemplate>;
    listProfileTemplates: () => Promise<SSHProfileTemplate[]>;
    deleteProfileTemplate: (id: string) => Promise<boolean>;
    exportProfiles: (ids?: string[]) => Promise<string>;
    importProfiles: (payload: string) => Promise<number>;
    validateProfile: (profile: Partial<SSHConnection>) => Promise<{ valid: boolean; errors: string[] }>;
    testProfile: (profile: Partial<SSHConnection>) => Promise<{
        success: boolean;
        latencyMs: number;
        authMethod: 'password' | 'key';
        message: string;
        error?: string;
        errorCode?: string;
        uiState?: 'ready' | 'failure' | 'empty';
    }>;
    startSessionRecording: (connectionId: string) => Promise<SSHSessionRecording>;
    stopSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
    getSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
    searchSessionRecording: (connectionId: string, query: string) => Promise<string[]>;
    exportSessionRecording: (connectionId: string) => Promise<string>;
    listSessionRecordings: () => Promise<SSHSessionRecording[]>;
}

export function createSSHBridge(ipc: IpcRenderer): SSHBridge {
    return {
        connect: connection => ipc.invoke(SSH_CHANNELS.CONNECT, connection),
        disconnect: connectionId => ipc.invoke(SSH_CHANNELS.DISCONNECT, connectionId),
        execute: (connectionId, command, options) =>
            ipc.invoke(SSH_CHANNELS.EXECUTE, connectionId, command, options),
        upload: (connectionId, local, remote) =>
            ipc.invoke(SSH_CHANNELS.UPLOAD, { connectionId, local, remote }),
        download: (connectionId, remote, local) =>
            ipc.invoke(SSH_CHANNELS.DOWNLOAD, { connectionId, remote, local }),
        listDir: (connectionId, path) => ipc.invoke(SSH_CHANNELS.LIST_DIR, { connectionId, path }),
        readFile: (connectionId, path) =>
            ipc.invoke(SSH_CHANNELS.READ_FILE, { connectionId, path }),
        writeFile: (connectionId, path, content) =>
            ipc.invoke(SSH_CHANNELS.WRITE_FILE, { connectionId, path, content }),
        deleteDir: (connectionId, path) =>
            ipc.invoke(SSH_CHANNELS.DELETE_DIR, { connectionId, path }),
        deleteFile: (connectionId, path) =>
            ipc.invoke(SSH_CHANNELS.DELETE_FILE, { connectionId, path }),
        mkdir: (connectionId, path) => ipc.invoke(SSH_CHANNELS.MKDIR, { connectionId, path }),
        rename: (connectionId, oldPath, newPath) =>
            ipc.invoke(SSH_CHANNELS.RENAME, { connectionId, oldPath, newPath }),
        copyPath: (connectionId, sourcePath, destinationPath) =>
            ipc.invoke(SSH_CHANNELS.COPY_PATH, { connectionId, sourcePath, destinationPath }),
        getConnections: () => ipc.invoke(SSH_CHANNELS.GET_CONNECTIONS),
        isConnected: connectionId => ipc.invoke(SSH_CHANNELS.IS_CONNECTED, connectionId),
        onStdout: callback =>
            ipc.on(SSH_CHANNELS.STDOUT, (_event, data: string | Uint8Array) => callback(data)),
        onStderr: callback =>
            ipc.on(SSH_CHANNELS.STDERR, (_event, data: string | Uint8Array) => callback(data)),
        onConnected: callback => ipc.on(SSH_CHANNELS.CONNECTED, (_event, id) => callback(id)),
        onDisconnected: callback =>
            ipc.on(SSH_CHANNELS.DISCONNECTED, (_event, id) => callback(id)),
        onUploadProgress: callback =>
            ipc.on(SSH_CHANNELS.UPLOAD_PROGRESS, (_event, p) => callback(p)),
        onDownloadProgress: callback =>
            ipc.on(SSH_CHANNELS.DOWNLOAD_PROGRESS, (_event, p) => callback(p)),
        removeAllListeners: () => {
            ipc.removeAllListeners(SSH_CHANNELS.STDOUT);
            ipc.removeAllListeners(SSH_CHANNELS.STDERR);
            ipc.removeAllListeners(SSH_CHANNELS.CONNECTED);
            ipc.removeAllListeners(SSH_CHANNELS.DISCONNECTED);
            ipc.removeAllListeners(SSH_CHANNELS.UPLOAD_PROGRESS);
            ipc.removeAllListeners(SSH_CHANNELS.DOWNLOAD_PROGRESS);
            ipc.removeAllListeners(SSH_CHANNELS.SHELL_DATA);
        },
        onShellData: callback =>
            ipc.on(SSH_CHANNELS.SHELL_DATA, (_event, data: { data: string }) => callback(data)),
        shellStart: connectionId => ipc.invoke(SSH_CHANNELS.SHELL_START, connectionId),
        shellWrite: (connectionId, data) =>
            ipc.invoke(SSH_CHANNELS.SHELL_WRITE, { connectionId, data }),
        getSystemStats: connectionId => ipc.invoke(SSH_CHANNELS.GET_SYSTEM_STATS, connectionId),
        getInstalledPackages: (connectionId, manager) =>
            ipc.invoke(SSH_CHANNELS.GET_INSTALLED_PACKAGES, connectionId, manager),
        getLogFiles: connectionId => ipc.invoke(SSH_CHANNELS.GET_LOG_FILES, connectionId),
        readLogFile: (connectionId, path, lines) =>
            ipc.invoke(SSH_CHANNELS.READ_LOG_FILE, { connectionId, path, lines }),
        getProfiles: () => ipc.invoke(SSH_CHANNELS.GET_PROFILES),
        saveProfile: profile => ipc.invoke(SSH_CHANNELS.SAVE_PROFILE, profile),
        deleteProfile: id => ipc.invoke(SSH_CHANNELS.DELETE_PROFILE, id),
        createTunnel: payload => ipc.invoke(SSH_CHANNELS.CREATE_TUNNEL, payload),
        listTunnels: connectionId => ipc.invoke(SSH_CHANNELS.LIST_TUNNELS, connectionId),
        closeTunnel: forwardId => ipc.invoke(SSH_CHANNELS.CLOSE_TUNNEL, forwardId),
        saveTunnelPreset: preset => ipc.invoke(SSH_CHANNELS.SAVE_TUNNEL_PRESET, preset),
        listTunnelPresets: () => ipc.invoke(SSH_CHANNELS.LIST_TUNNEL_PRESETS),
        deleteTunnelPreset: id => ipc.invoke(SSH_CHANNELS.DELETE_TUNNEL_PRESET, id),
        listManagedKeys: () => ipc.invoke(SSH_CHANNELS.LIST_MANAGED_KEYS),
        generateManagedKey: payload => ipc.invoke(SSH_CHANNELS.GENERATE_MANAGED_KEY, payload),
        importManagedKey: payload => ipc.invoke(SSH_CHANNELS.IMPORT_MANAGED_KEY, payload),
        deleteManagedKey: id => ipc.invoke(SSH_CHANNELS.DELETE_MANAGED_KEY, id),
        rotateManagedKey: payload => ipc.invoke(SSH_CHANNELS.ROTATE_MANAGED_KEY, payload),
        backupManagedKey: id => ipc.invoke(SSH_CHANNELS.BACKUP_MANAGED_KEY, id),
        listKnownHosts: () => ipc.invoke(SSH_CHANNELS.LIST_KNOWN_HOSTS),
        addKnownHost: payload => ipc.invoke(SSH_CHANNELS.ADD_KNOWN_HOST, payload),
        removeKnownHost: payload => ipc.invoke(SSH_CHANNELS.REMOVE_KNOWN_HOST, payload),
        searchRemoteFiles: payload => ipc.invoke(SSH_CHANNELS.SEARCH_REMOTE_FILES, payload),
        getSearchHistory: connectionId => ipc.invoke(SSH_CHANNELS.GET_SEARCH_HISTORY, connectionId),
        exportSearchHistory: () => ipc.invoke(SSH_CHANNELS.EXPORT_SEARCH_HISTORY),
        reconnect: (connectionId, retries) => ipc.invoke(SSH_CHANNELS.RECONNECT, connectionId, retries),
        acquireConnection: connectionId => ipc.invoke(SSH_CHANNELS.ACQUIRE_CONNECTION, connectionId),
        releaseConnection: connectionId => ipc.invoke(SSH_CHANNELS.RELEASE_CONNECTION, connectionId),
        getConnectionPoolStats: () => ipc.invoke(SSH_CHANNELS.GET_CONNECTION_POOL_STATS),
        enqueueTransfer: task => ipc.invoke(SSH_CHANNELS.ENQUEUE_TRANSFER, task),
        getTransferQueue: () => ipc.invoke(SSH_CHANNELS.GET_TRANSFER_QUEUE),
        runTransferBatch: (tasks, concurrency) => ipc.invoke(SSH_CHANNELS.RUN_TRANSFER_BATCH, tasks, concurrency),
        listRemoteContainers: connectionId => ipc.invoke(SSH_CHANNELS.LIST_REMOTE_CONTAINERS, connectionId),
        runRemoteContainer: payload => ipc.invoke(SSH_CHANNELS.RUN_REMOTE_CONTAINER, payload),
        stopRemoteContainer: (connectionId, containerId) => ipc.invoke(SSH_CHANNELS.STOP_REMOTE_CONTAINER, connectionId, containerId),
        saveProfileTemplate: template => ipc.invoke(SSH_CHANNELS.SAVE_PROFILE_TEMPLATE, template),
        listProfileTemplates: () => ipc.invoke(SSH_CHANNELS.LIST_PROFILE_TEMPLATES),
        deleteProfileTemplate: id => ipc.invoke(SSH_CHANNELS.DELETE_PROFILE_TEMPLATE, id),
        exportProfiles: ids => ipc.invoke(SSH_CHANNELS.EXPORT_PROFILES, ids),
        importProfiles: payload => ipc.invoke(SSH_CHANNELS.IMPORT_PROFILES, payload),
        validateProfile: profile => ipc.invoke(SSH_CHANNELS.VALIDATE_PROFILE, profile),
        testProfile: profile => ipc.invoke(SSH_CHANNELS.TEST_PROFILE, profile),
        startSessionRecording: connectionId => ipc.invoke(SSH_CHANNELS.START_SESSION_RECORDING, connectionId),
        stopSessionRecording: connectionId => ipc.invoke(SSH_CHANNELS.STOP_SESSION_RECORDING, connectionId),
        getSessionRecording: connectionId => ipc.invoke(SSH_CHANNELS.GET_SESSION_RECORDING, connectionId),
        searchSessionRecording: (connectionId, query) => ipc.invoke(SSH_CHANNELS.SEARCH_SESSION_RECORDING, connectionId, query),
        exportSessionRecording: connectionId => ipc.invoke(SSH_CHANNELS.EXPORT_SESSION_RECORDING, connectionId),
        listSessionRecordings: () => ipc.invoke(SSH_CHANNELS.LIST_SESSION_RECORDINGS),
    };
}

