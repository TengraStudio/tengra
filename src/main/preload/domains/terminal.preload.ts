import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface TerminalBridge {
    isAvailable: () => Promise<boolean>;
    getProfiles: () => Promise<Array<{
        id: string;
        name: string;
        shell: string;
        args?: string[];
        env?: Record<string, string | undefined>;
        icon?: string;
        isDefault?: boolean;
    }>>;
    saveProfile: (profile: {
        id: string;
        name: string;
        shell: string;
        args?: string[];
        env?: Record<string, string | undefined>;
        icon?: string;
        isDefault?: boolean;
    }) => Promise<void>;
    deleteProfile: (id: string) => Promise<void>;
    validateProfile: (profile: {
        id: string;
        name: string;
        shell: string;
        args?: string[];
        env?: Record<string, string | undefined>;
        icon?: string;
        isDefault?: boolean;
    }) => Promise<{ valid: boolean; errors: string[] }>;
    getProfileTemplates: () => Promise<Array<{
        id: string;
        name: string;
        shell: string;
        args?: string[];
        env?: Record<string, string | undefined>;
        icon?: string;
        isDefault?: boolean;
    }>>;
    exportProfiles: () => Promise<string>;
    exportProfileShareCode: (profileId: string) => Promise<string | null>;
    importProfiles: (
        payload: string,
        options?: { overwrite?: boolean }
    ) => Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }>;
    importProfileShareCode: (
        shareCode: string,
        options?: { overwrite?: boolean }
    ) => Promise<{ success: boolean; imported: boolean; profileId?: string; error?: string }>;
    getShells: () => Promise<{ id: string; name: string; path: string }[]>;
    getBackends: () => Promise<Array<{ id: string; name: string; available: boolean }>>;
    getDiscoverySnapshot: (options?: { refresh?: boolean }) => Promise<{
        terminalAvailable: boolean;
        shells: Array<{ id: string; name: string; path: string }>;
        backends: Array<{ id: string; name: string; available: boolean }>;
        refreshedAt: number;
    }>;
    getRuntimeHealth: () => Promise<{
        terminalAvailable: boolean;
        totalBackends: number;
        availableBackends: number;
        backends: Array<{ id: string; name: string; available: boolean }>;
    }>;
    create: (options: {
        id?: string;
        shell?: string;
        cwd?: string;
        cols?: number;
        rows?: number;
        backendId?: string;
        title?: string;
        metadata?: Record<string, RuntimeValue>;
    }) => Promise<string>;
    getDockerContainers: () => Promise<Array<{ id: string; name: string; status: string }>>;

    getCommandHistory: (
        query?: string,
        limit?: number
    ) => Promise<
        Array<{
            command: string;
            shell?: string;
            cwd?: string;
            timestamp: number;
            sessionId: string;
        }>
    >;
    getSuggestions: (options: {
        command: string;
        shell: string;
        cwd: string;
        historyLimit?: number;
    }) => Promise<string[]>;
    explainCommand: (options: { command: string; shell: string; cwd?: string }) => Promise<{
        explanation: string;
        breakdown: Array<{ part: string; description: string }>;
        warnings?: string[];
        relatedCommands?: string[];
    }>;
    explainError: (options: {
        errorOutput: string;
        command?: string;
        shell: string;
        cwd?: string;
    }) => Promise<{
        summary: string;
        cause: string;
        solution: string;
        steps?: string[];
    }>;
    fixError: (options: {
        errorOutput: string;
        command: string;
        shell: string;
        cwd?: string;
    }) => Promise<{
        suggestedCommand: string;
        explanation: string;
        confidence: 'high' | 'medium' | 'low';
        alternativeCommands?: string[];
    }>;
    clearCommandHistory: () => Promise<boolean>;
    close: (sessionId: string) => Promise<boolean>;
    write: (sessionId: string, data: string) => Promise<boolean>;
    resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
    kill: (sessionId: string) => Promise<boolean>;
    getSessions: () => Promise<string[]>;
    restoreAllSnapshots: () => Promise<{ restored: number; failed: number; sessionIds: string[] }>;
    exportSession: (
        sessionId: string,
        options?: { includeScrollback?: boolean }
    ) => Promise<string | null>;
    importSession: (
        payload: string,
        options?: { overwrite?: boolean; sessionId?: string }
    ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    createSessionShareCode: (
        sessionId: string,
        options?: { includeScrollback?: boolean }
    ) => Promise<string | null>;
    importSessionShareCode: (
        shareCode: string,
        options?: { overwrite?: boolean; sessionId?: string }
    ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
    getSnapshotSessions: () => Promise<Array<{
        id: string;
        shell: string;
        cwd: string;
        title?: string;
        cols: number;
        rows: number;
        timestamp: number;
        backendId: string;
        workspaceId?: string;
        metadata?: Record<string, RuntimeValue>;
    }>>;
    getSessionTemplates: () => Promise<Array<{
        id: string;
        name: string;
        shell: string;
        cwd: string;
        cols: number;
        rows: number;
        backendId: string;
        workspaceId?: string;
        metadata?: Record<string, RuntimeValue>;
        createdAt: number;
        updatedAt: number;
    }>>;
    saveSessionTemplate: (payload: {
        sessionId: string;
        templateId?: string;
        name?: string;
    }) => Promise<{
        id: string;
        name: string;
        shell: string;
        cwd: string;
        cols: number;
        rows: number;
        backendId: string;
        workspaceId?: string;
        metadata?: Record<string, RuntimeValue>;
        createdAt: number;
        updatedAt: number;
    } | null>;
    deleteSessionTemplate: (templateId: string) => Promise<boolean>;
    createFromSessionTemplate: (
        templateId: string,
        options?: { sessionId?: string; title?: string }
    ) => Promise<string | null>;
    restoreSnapshotSession: (snapshotId: string) => Promise<boolean>;
    searchScrollback: (
        sessionId: string,
        query: string,
        options?: { regex?: boolean; caseSensitive?: boolean; limit?: number }
    ) => Promise<Array<{ lineNumber: number; line: string }>>;
    exportScrollback: (
        sessionId: string,
        exportPath?: string
    ) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
    getSessionAnalytics: (sessionId: string) => Promise<{
        sessionId: string;
        bytes: number;
        lineCount: number;
        commandCount: number;
        updatedAt: number;
    }>;
    getSearchAnalytics: () => Promise<{
        totalSearches: number;
        regexSearches: number;
        plainSearches: number;
        lastSearchAt: number;
    }>;
    getSearchSuggestions: (query?: string, limit?: number) => Promise<string[]>;
    exportSearchResults: (
        sessionId: string,
        query: string,
        options?: {
            regex?: boolean;
            caseSensitive?: boolean;
            limit?: number;
            exportPath?: string;
            format?: 'json' | 'txt'
        }
    ) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
    addScrollbackMarker: (
        sessionId: string,
        label: string,
        lineNumber?: number
    ) => Promise<{ id: string; sessionId: string; label: string; lineNumber: number; createdAt: number } | null>;
    listScrollbackMarkers: (sessionId?: string) => Promise<Array<{
        id: string;
        sessionId: string;
        label: string;
        lineNumber: number;
        createdAt: number;
    }>>;
    deleteScrollbackMarker: (markerId: string) => Promise<boolean>;
    filterScrollback: (
        sessionId: string,
        options?: { query?: string; fromLine?: number; toLine?: number; caseSensitive?: boolean }
    ) => Promise<string[]>;
    setSessionTitle: (sessionId: string, title: string) => Promise<boolean>;
    onData: (callback: (data: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
    readBuffer: (sessionId: string) => Promise<string>;
    removeAllListeners: () => void;
}

export function createTerminalBridge(ipc: IpcRenderer): TerminalBridge {
    return {
        isAvailable: () => ipc.invoke('terminal:isAvailable'),
        getProfiles: () => ipc.invoke('terminal:getProfiles'),
        saveProfile: profile => ipc.invoke('terminal:saveProfile', profile),
        deleteProfile: id => ipc.invoke('terminal:deleteProfile', id),
        validateProfile: profile => ipc.invoke('terminal:validateProfile', profile),
        getProfileTemplates: () => ipc.invoke('terminal:getProfileTemplates'),
        exportProfiles: () => ipc.invoke('terminal:exportProfiles'),
        exportProfileShareCode: profileId => ipc.invoke('terminal:exportProfileShareCode', profileId),
        importProfiles: (payload, options) => ipc.invoke('terminal:importProfiles', payload, options),
        importProfileShareCode: (shareCode, options) =>
            ipc.invoke('terminal:importProfileShareCode', shareCode, options),
        getShells: () => ipc.invoke('terminal:getShells'),
        getBackends: () => ipc.invoke('terminal:getBackends'),
        getDiscoverySnapshot: options => ipc.invoke('terminal:getDiscoverySnapshot', options),
        getRuntimeHealth: () => ipc.invoke('terminal:getRuntimeHealth'),
        create: options => ipc.invoke('terminal:create', options),
        getDockerContainers: () => ipc.invoke('terminal:getDockerContainers'),

        getCommandHistory: (query, limit) => ipc.invoke('terminal:getCommandHistory', query, limit),
        getSuggestions: options => ipc.invoke('terminal:getSuggestions', options),
        explainCommand: options => ipc.invoke('terminal:explainCommand', options),
        explainError: options => ipc.invoke('terminal:explainError', options),
        fixError: options => ipc.invoke('terminal:fixError', options),
        clearCommandHistory: () => ipc.invoke('terminal:clearCommandHistory'),
        close: sessionId => ipc.invoke('terminal:close', sessionId),
        write: (sessionId, data) => ipc.invoke('terminal:write', sessionId, data),
        resize: (sessionId, cols, rows) => ipc.invoke('terminal:resize', sessionId, cols, rows),
        kill: sessionId => ipc.invoke('terminal:kill', sessionId),
        getSessions: () => ipc.invoke('terminal:getSessions'),
        restoreAllSnapshots: () => ipc.invoke('terminal:restoreAllSnapshots'),
        exportSession: (sessionId, options) => ipc.invoke('terminal:exportSession', sessionId, options),
        importSession: (payload, options) => ipc.invoke('terminal:importSession', payload, options),
        createSessionShareCode: (sessionId, options) =>
            ipc.invoke('terminal:createSessionShareCode', sessionId, options),
        importSessionShareCode: (shareCode, options) =>
            ipc.invoke('terminal:importSessionShareCode', shareCode, options),
        getSnapshotSessions: () => ipc.invoke('terminal:getSnapshotSessions'),
        getSessionTemplates: () => ipc.invoke('terminal:getSessionTemplates'),
        saveSessionTemplate: payload => ipc.invoke('terminal:saveSessionTemplate', payload),
        deleteSessionTemplate: templateId => ipc.invoke('terminal:deleteSessionTemplate', templateId),
        createFromSessionTemplate: (templateId, options) =>
            ipc.invoke('terminal:createFromSessionTemplate', templateId, options),
        restoreSnapshotSession: snapshotId => ipc.invoke('terminal:restoreSnapshotSession', snapshotId),
        searchScrollback: (sessionId, query, options) =>
            ipc.invoke('terminal:searchScrollback', sessionId, query, options),
        exportScrollback: (sessionId, exportPath) =>
            ipc.invoke('terminal:exportScrollback', sessionId, exportPath),
        getSessionAnalytics: sessionId => ipc.invoke('terminal:getSessionAnalytics', sessionId),
        getSearchAnalytics: () => ipc.invoke('terminal:getSearchAnalytics'),
        getSearchSuggestions: (query, limit) =>
            ipc.invoke('terminal:getSearchSuggestions', query, limit),
        exportSearchResults: (sessionId, query, options) =>
            ipc.invoke('terminal:exportSearchResults', sessionId, query, options),
        addScrollbackMarker: (sessionId, label, lineNumber) =>
            ipc.invoke('terminal:addScrollbackMarker', sessionId, label, lineNumber),
        listScrollbackMarkers: (sessionId) => ipc.invoke('terminal:listScrollbackMarkers', sessionId),
        deleteScrollbackMarker: markerId => ipc.invoke('terminal:deleteScrollbackMarker', markerId),
        filterScrollback: (sessionId, options) =>
            ipc.invoke('terminal:filterScrollback', sessionId, options),
        setSessionTitle: (sessionId, title) =>
            ipc.invoke('terminal:setSessionTitle', sessionId, title),
        onData: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; data: string }) =>
                callback(data);
            ipc.on('terminal:data', listener);
            return () => ipc.removeListener('terminal:data', listener);
        },
        onExit: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; code: number }) =>
                callback(data);
            ipc.on('terminal:exit', listener);
            return () => ipc.removeListener('terminal:exit', listener);
        },
        readBuffer: sessionId => ipc.invoke('terminal:readBuffer', sessionId),
        removeAllListeners: () => {
            ipc.removeAllListeners('terminal:data');
            ipc.removeAllListeners('terminal:exit');
        },
    };
}
