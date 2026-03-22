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
        connect: connection => ipc.invoke('ssh:connect', connection),
        disconnect: connectionId => ipc.invoke('ssh:disconnect', connectionId),
        execute: (connectionId, command, options) =>
            ipc.invoke('ssh:execute', connectionId, command, options),
        upload: (connectionId, local, remote) =>
            ipc.invoke('ssh:upload', { connectionId, local, remote }),
        download: (connectionId, remote, local) =>
            ipc.invoke('ssh:download', { connectionId, remote, local }),
        listDir: (connectionId, path) => ipc.invoke('ssh:listDir', { connectionId, path }),
        readFile: (connectionId, path) =>
            ipc.invoke('ssh:readFile', { connectionId, path }),
        writeFile: (connectionId, path, content) =>
            ipc.invoke('ssh:writeFile', { connectionId, path, content }),
        deleteDir: (connectionId, path) =>
            ipc.invoke('ssh:deleteDir', { connectionId, path }),
        deleteFile: (connectionId, path) =>
            ipc.invoke('ssh:deleteFile', { connectionId, path }),
        mkdir: (connectionId, path) => ipc.invoke('ssh:mkdir', { connectionId, path }),
        rename: (connectionId, oldPath, newPath) =>
            ipc.invoke('ssh:rename', { connectionId, oldPath, newPath }),
        copyPath: (connectionId, sourcePath, destinationPath) =>
            ipc.invoke('ssh:copyPath', { connectionId, sourcePath, destinationPath }),
        getConnections: () => ipc.invoke('ssh:getConnections'),
        isConnected: connectionId => ipc.invoke('ssh:isConnected', connectionId),
        onStdout: callback =>
            ipc.on('ssh:stdout', (_event, data: string | Uint8Array) => callback(data)),
        onStderr: callback =>
            ipc.on('ssh:stderr', (_event, data: string | Uint8Array) => callback(data)),
        onConnected: callback => ipc.on('ssh:connected', (_event, id) => callback(id)),
        onDisconnected: callback =>
            ipc.on('ssh:disconnected', (_event, id) => callback(id)),
        onUploadProgress: callback =>
            ipc.on('ssh:uploadProgress', (_event, p) => callback(p)),
        onDownloadProgress: callback =>
            ipc.on('ssh:downloadProgress', (_event, p) => callback(p)),
        removeAllListeners: () => {
            ipc.removeAllListeners('ssh:stdout');
            ipc.removeAllListeners('ssh:stderr');
            ipc.removeAllListeners('ssh:connected');
            ipc.removeAllListeners('ssh:disconnected');
            ipc.removeAllListeners('ssh:uploadProgress');
            ipc.removeAllListeners('ssh:downloadProgress');
            ipc.removeAllListeners('ssh:shellData');
        },
        onShellData: callback =>
            ipc.on('ssh:shellData', (_event, data: { data: string }) => callback(data)),
        shellStart: connectionId => ipc.invoke('ssh:shellStart', connectionId),
        shellWrite: (connectionId, data) =>
            ipc.invoke('ssh:shellWrite', { connectionId, data }),
        getSystemStats: connectionId => ipc.invoke('ssh:getSystemStats', connectionId),
        getInstalledPackages: (connectionId, manager) =>
            ipc.invoke('ssh:getInstalledPackages', connectionId, manager),
        getLogFiles: connectionId => ipc.invoke('ssh:getLogFiles', connectionId),
        readLogFile: (connectionId, path, lines) =>
            ipc.invoke('ssh:readLogFile', { connectionId, path, lines }),
        getProfiles: () => ipc.invoke('ssh:getProfiles'),
        saveProfile: profile => ipc.invoke('ssh:saveProfile', profile),
        deleteProfile: id => ipc.invoke('ssh:deleteProfile', id),
        createTunnel: payload => ipc.invoke('ssh:createTunnel', payload),
        listTunnels: connectionId => ipc.invoke('ssh:listTunnels', connectionId),
        closeTunnel: forwardId => ipc.invoke('ssh:closeTunnel', forwardId),
        saveTunnelPreset: preset => ipc.invoke('ssh:saveTunnelPreset', preset),
        listTunnelPresets: () => ipc.invoke('ssh:listTunnelPresets'),
        deleteTunnelPreset: id => ipc.invoke('ssh:deleteTunnelPreset', id),
        listManagedKeys: () => ipc.invoke('ssh:listManagedKeys'),
        generateManagedKey: payload => ipc.invoke('ssh:generateManagedKey', payload),
        importManagedKey: payload => ipc.invoke('ssh:importManagedKey', payload),
        deleteManagedKey: id => ipc.invoke('ssh:deleteManagedKey', id),
        rotateManagedKey: payload => ipc.invoke('ssh:rotateManagedKey', payload),
        backupManagedKey: id => ipc.invoke('ssh:backupManagedKey', id),
        listKnownHosts: () => ipc.invoke('ssh:listKnownHosts'),
        addKnownHost: payload => ipc.invoke('ssh:addKnownHost', payload),
        removeKnownHost: payload => ipc.invoke('ssh:removeKnownHost', payload),
        searchRemoteFiles: payload => ipc.invoke('ssh:searchRemoteFiles', payload),
        getSearchHistory: connectionId => ipc.invoke('ssh:getSearchHistory', connectionId),
        exportSearchHistory: () => ipc.invoke('ssh:exportSearchHistory'),
        reconnect: (connectionId, retries) => ipc.invoke('ssh:reconnect', connectionId, retries),
        acquireConnection: connectionId => ipc.invoke('ssh:acquireConnection', connectionId),
        releaseConnection: connectionId => ipc.invoke('ssh:releaseConnection', connectionId),
        getConnectionPoolStats: () => ipc.invoke('ssh:getConnectionPoolStats'),
        enqueueTransfer: task => ipc.invoke('ssh:enqueueTransfer', task),
        getTransferQueue: () => ipc.invoke('ssh:getTransferQueue'),
        runTransferBatch: (tasks, concurrency) => ipc.invoke('ssh:runTransferBatch', tasks, concurrency),
        listRemoteContainers: connectionId => ipc.invoke('ssh:listRemoteContainers', connectionId),
        runRemoteContainer: payload => ipc.invoke('ssh:runRemoteContainer', payload),
        stopRemoteContainer: (connectionId, containerId) => ipc.invoke('ssh:stopRemoteContainer', connectionId, containerId),
        saveProfileTemplate: template => ipc.invoke('ssh:saveProfileTemplate', template),
        listProfileTemplates: () => ipc.invoke('ssh:listProfileTemplates'),
        deleteProfileTemplate: id => ipc.invoke('ssh:deleteProfileTemplate', id),
        exportProfiles: ids => ipc.invoke('ssh:exportProfiles', ids),
        importProfiles: payload => ipc.invoke('ssh:importProfiles', payload),
        validateProfile: profile => ipc.invoke('ssh:validateProfile', profile),
        testProfile: profile => ipc.invoke('ssh:testProfile', profile),
        startSessionRecording: connectionId => ipc.invoke('ssh:startSessionRecording', connectionId),
        stopSessionRecording: connectionId => ipc.invoke('ssh:stopSessionRecording', connectionId),
        getSessionRecording: connectionId => ipc.invoke('ssh:getSessionRecording', connectionId),
        searchSessionRecording: (connectionId, query) => ipc.invoke('ssh:searchSessionRecording', connectionId, query),
        exportSessionRecording: connectionId => ipc.invoke('ssh:exportSessionRecording', connectionId),
        listSessionRecordings: () => ipc.invoke('ssh:listSessionRecordings'),
    };
}
