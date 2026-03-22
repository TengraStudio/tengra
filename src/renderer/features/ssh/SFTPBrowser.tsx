import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { ServiceResponse, SSHFile } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface SFTPBrowserProps {
    connectionId: string;
    onClose?: () => void;
}

interface DirectoryCacheEntry {
    files: SSHFile[];
    indexedNames: string[];
    cachedAt: number;
}

interface ReconnectDiagnostics {
    state: 'connected' | 'reconnecting' | 'failed';
    attempts: number;
    lastError: string | null;
    lastReconnectAt: number | null;
}

interface TransferItem {
    id: string;
    direction: 'upload' | 'download';
    remotePath: string;
    localPath: string;
    status: 'queued' | 'running' | 'done' | 'failed';
    error?: string;
}

const REMOTE_TREE_CACHE_TTL_MS = 30_000;
const TRANSFER_DOWNLOAD_BASE = 'C:\\Users\\agnes\\Downloads';

export function SFTPBrowser({ connectionId }: SFTPBrowserProps): JSX.Element {
    const { t } = useTranslation();
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<SSHFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [savedContent, setSavedContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveQueue, setSaveQueue] = useState<Array<{ remotePath: string; content: string }>>([]);
    const [latencyMs, setLatencyMs] = useState(120);
    const [editorStatus, setEditorStatus] = useState<string>('');
    const [cache, setCache] = useState<Record<string, DirectoryCacheEntry>>({});
    const [reconnectDiagnostics, setReconnectDiagnostics] = useState<ReconnectDiagnostics>({
        state: 'connected',
        attempts: 0,
        lastError: null,
        lastReconnectAt: null,
    });
    const [watcherEnabled, setWatcherEnabled] = useState(true);
    const [watcherUnavailable, setWatcherUnavailable] = useState(false);
    const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
    const [uploadLocalPath, setUploadLocalPath] = useState('');
    const [conflictPolicy, setConflictPolicy] = useState<'overwrite' | 'rename' | 'skip'>('overwrite');
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watcherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watcherSignatureRef = useRef('');

    const clearDirectoryCache = useCallback((path?: string) => {
        if (!path) {
            setCache({});
            return;
        }
        setCache(previous => {
            const next = { ...previous };
            delete next[path];
            return next;
        });
    }, []);

    const loadFiles = useCallback(async (path: string, options?: { forceRefresh?: boolean }) => {
        const cached = cache[path];
        if (cached && !options?.forceRefresh && Date.now() - cached.cachedAt < REMOTE_TREE_CACHE_TTL_MS) {
            setFiles(cached.files);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await window.electron.ssh.listDir(connectionId, path) as ServiceResponse<SSHFile[]>;
            if (result.success) {
                const nextFiles = result.data ?? [];
                setFiles(nextFiles);
                setCache(previous => ({
                    ...previous,
                    [path]: {
                        files: nextFiles,
                        indexedNames: nextFiles.map(file => file.name.toLowerCase()),
                        cachedAt: Date.now(),
                    }
                }));
            } else {
                setError(result.error ?? t('ssh.unknownError'));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [cache, connectionId, t]);

    useEffect(() => {
        void loadFiles(currentPath);
    }, [loadFiles, currentPath]);

    const dynamicDebounceMs = useMemo(() => {
        if (latencyMs > 600) {
            return 2200;
        }
        if (latencyMs > 300) {
            return 1400;
        }
        return 700;
    }, [latencyMs]);

    const refreshDirectory = useCallback((forceRefresh = false) => {
        if (forceRefresh) {
            clearDirectoryCache(currentPath);
        }
        void loadFiles(currentPath, { forceRefresh });
    }, [clearDirectoryCache, currentPath, loadFiles]);

    const handleNavigate = (name: string): void => {
        const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        setCurrentPath(newPath);
    };

    const handleBack = (): void => {
        if (currentPath === '/') { return; }
        const parts = currentPath.split('/').filter(p => p.length > 0);
        parts.pop();
        setCurrentPath('/' + parts.join('/'));
    };

    const handleDelete = async (item: SSHFile): Promise<void> => {
        appLogger.warn('SFTPBrowser', t('ssh.confirmDeleteFile', { name: item.name }));

        const path = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        const result = item.isDirectory
            ? await window.electron.ssh.deleteDir(connectionId, path)
            : await window.electron.ssh.deleteFile(connectionId, path);

        if (result.success) {
            clearDirectoryCache(currentPath);
            void loadFiles(currentPath);
        } else {
            appLogger.warn('SFTPBrowser', t('ssh.connectionError', { error: result.error ?? 'Unknown error' }));
        }
    };

    const handleMkdir = async () => {
        const name = 'new-folder'; // Replaced prompt with default name
        appLogger.warn('SFTPBrowser', t('ssh.newFolderName'));

        const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        const result = await window.electron.ssh.mkdir(connectionId, path);
        if (result.success) {
            clearDirectoryCache(currentPath);
            void loadFiles(currentPath);
        } else {
            appLogger.warn('SFTPBrowser', t('ssh.connectionError', { error: result.error ?? 'Unknown error' }));
        }
    };

    const handleRename = async (item: SSHFile) => {
        const newName = item.name; // Replaced prompt with original name
        appLogger.warn('SFTPBrowser', t('ssh.newName'));

        const oldPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;

        const result = await window.electron.ssh.rename(connectionId, oldPath, newPath);
        if (result.success) {
            clearDirectoryCache(currentPath);
            void loadFiles(currentPath);
        } else {
            appLogger.warn('SFTPBrowser', t('ssh.connectionError', { error: result.error ?? 'Unknown error' }));
        }
    };

    const handleDownload = async (item: SSHFile) => {
        if (item.isDirectory) {
            return;
        }
        const remotePath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        const localPath = `${TRANSFER_DOWNLOAD_BASE}\\${item.name}`;
        const transferId = `download-${Date.now()}-${item.name}`;
        const queued: TransferItem = {
            id: transferId,
            direction: 'download',
            remotePath,
            localPath,
            status: 'queued',
        };
        setTransferItems(previous => [...previous, queued]);
        setEditorStatus(t('ssh.downloadTriggered', { name: item.name }));
    };

    const handleUpload = async () => {
        if (!uploadLocalPath.trim()) {
            return;
        }
        const filename = uploadLocalPath.split('\\').pop() ?? '';
        if (!filename) {
            return;
        }
        const baseRemotePath = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`;
        const hasConflict = files.some(file => !file.isDirectory && file.name === filename);
        if (hasConflict && conflictPolicy === 'skip') {
            setEditorStatus(t('ssh.connectionError', { error: 'Upload skipped due to conflict policy' }));
            return;
        }
        const remotePath = hasConflict && conflictPolicy === 'rename'
            ? `${baseRemotePath}.copy-${Date.now()}`
            : baseRemotePath;
        const queued: TransferItem = {
            id: `upload-${Date.now()}-${filename}`,
            direction: 'upload',
            remotePath,
            localPath: uploadLocalPath,
            status: 'queued',
        };
        setTransferItems(previous => [...previous, queued]);
        setUploadLocalPath('');
    };

    const enqueueSave = useCallback((remotePath: string, content: string) => {
        setSaveQueue(previous => {
            const next = previous.filter(entry => entry.remotePath !== remotePath);
            return [...next, { remotePath, content }];
        });
    }, []);

    const persistRemoteFile = useCallback(async (remotePath: string, content: string) => {
        setIsSaving(true);
        const startedAt = Date.now();
        const result = await window.electron.ssh.writeFile(connectionId, remotePath, content);
        setLatencyMs(Date.now() - startedAt);
        if (!result.success) {
            enqueueSave(remotePath, content);
            setEditorStatus(t('ssh.editorQueuedSave'));
            setIsSaving(false);
            return false;
        }
        setSavedContent(content);
        setEditorStatus(t('ssh.editorSaved'));
        setIsSaving(false);
        return true;
    }, [connectionId, enqueueSave, t]);

    const flushQueuedSaves = useCallback(async () => {
        if (saveQueue.length === 0) {
            return;
        }
        const isConnected = await window.electron.ssh.isConnected(connectionId);
        if (!isConnected) {
            setEditorStatus(t('ssh.editorQueuedDisconnected', { count: saveQueue.length }));
            return;
        }
        const queueCopy = [...saveQueue];
        for (const queued of queueCopy) {
            const success = await persistRemoteFile(queued.remotePath, queued.content);
            if (!success) {
                break;
            }
            setSaveQueue(previous => previous.filter(entry => entry.remotePath !== queued.remotePath));
        }
    }, [connectionId, persistRemoteFile, saveQueue, t]);

    const processTransferQueue = useCallback(async () => {
        const next = transferItems.find(item => item.status === 'queued');
        if (!next) {
            return;
        }
        setTransferItems(previous =>
            previous.map(item => (item.id === next.id ? { ...item, status: 'running', error: undefined } : item))
        );
        const result = next.direction === 'upload'
            ? await window.electron.ssh.upload(connectionId, next.localPath, next.remotePath)
            : await window.electron.ssh.download(connectionId, next.remotePath, next.localPath);
        if (!result.success) {
            setTransferItems(previous =>
                previous.map(item =>
                    item.id === next.id ? { ...item, status: 'failed', error: result.error ?? t('ssh.unknownError') } : item
                )
            );
            return;
        }
        setTransferItems(previous =>
            previous.map(item => (item.id === next.id ? { ...item, status: 'done', error: undefined } : item))
        );
        refreshDirectory(true);
    }, [connectionId, refreshDirectory, t, transferItems]);

    const retryTransfer = useCallback((id: string) => {
        setTransferItems(previous =>
            previous.map(item => (item.id === id ? { ...item, status: 'queued', error: undefined } : item))
        );
    }, []);

    const openRemoteFileForEditing = useCallback(async (remotePath: string) => {
        const startedAt = Date.now();
        const readResult = await window.electron.ssh.readFile(connectionId, remotePath);
        setLatencyMs(Date.now() - startedAt);
        if (!readResult.success) {
            setEditorStatus(t('ssh.editorOpenFailed'));
            return;
        }
        const content = readResult.content ?? '';
        setSelectedFilePath(remotePath);
        setEditorContent(content);
        setSavedContent(content);
        setEditorStatus(t('ssh.editorOpened'));
    }, [connectionId, t]);

    useEffect(() => {
        if (!selectedFilePath || editorContent === savedContent) {
            return;
        }
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(() => {
            void persistRemoteFile(selectedFilePath, editorContent);
        }, dynamicDebounceMs);
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [dynamicDebounceMs, editorContent, persistRemoteFile, savedContent, selectedFilePath]);

    useEffect(() => {
        const timer = setInterval(() => {
            void flushQueuedSaves();
            void processTransferQueue();
        }, 4000);
        return () => {
            clearInterval(timer);
        };
    }, [flushQueuedSaves, processTransferQueue]);

    useEffect(() => {
        const timer = setInterval(() => {
            void (async () => {
                try {
                    const connected = await window.electron.ssh.isConnected(connectionId);
                    if (connected) {
                        setReconnectDiagnostics(previous => ({ ...previous, state: 'connected' }));
                        return;
                    }
                    setReconnectDiagnostics(previous => ({
                        ...previous,
                        state: 'reconnecting',
                        attempts: previous.attempts + 1,
                    }));
                    const reconnectResult = await window.electron.ssh.reconnect(connectionId, 3);
                    if (reconnectResult.success) {
                        setReconnectDiagnostics(previous => ({
                            ...previous,
                            state: 'connected',
                            lastError: null,
                            lastReconnectAt: Date.now(),
                        }));
                        refreshDirectory(true);
                        if (selectedFilePath) {
                            void openRemoteFileForEditing(selectedFilePath);
                        }
                        return;
                    }
                    setReconnectDiagnostics(previous => ({
                        ...previous,
                        state: 'failed',
                        lastError: reconnectResult.error ?? t('ssh.unknownError'),
                    }));
                } catch (error) {
                    setReconnectDiagnostics(previous => ({
                        ...previous,
                        state: 'failed',
                        lastError: error instanceof Error ? error.message : String(error),
                    }));
                }
            })();
        }, 7000);
        return () => clearInterval(timer);
    }, [connectionId, openRemoteFileForEditing, refreshDirectory, selectedFilePath, t]);

    useEffect(() => {
        if (!watcherEnabled) {
            return;
        }
        const timer = setInterval(() => {
            void (async () => {
                try {
                    const result = await window.electron.ssh.listDir(connectionId, currentPath) as ServiceResponse<SSHFile[]>;
                    if (!result.success) {
                        throw new Error(result.error ?? t('ssh.unknownError'));
                    }
                    const nextFiles = result.data ?? [];
                    const signature = nextFiles
                        .map(file => `${file.name}:${file.mtime ?? 0}:${file.size ?? 0}`)
                        .sort()
                        .join('|');
                    if (!watcherSignatureRef.current) {
                        watcherSignatureRef.current = signature;
                        return;
                    }
                    if (signature === watcherSignatureRef.current) {
                        return;
                    }
                    watcherSignatureRef.current = signature;
                    if (watcherTimerRef.current) {
                        clearTimeout(watcherTimerRef.current);
                    }
                    watcherTimerRef.current = setTimeout(() => {
                        refreshDirectory(true);
                        setEditorStatus(t('ssh.refresh'));
                    }, Math.max(350, Math.floor(dynamicDebounceMs / 2)));
                    setWatcherUnavailable(false);
                } catch {
                    setWatcherUnavailable(true);
                }
            })();
        }, 5000);
        return () => {
            clearInterval(timer);
            if (watcherTimerRef.current) {
                clearTimeout(watcherTimerRef.current);
            }
        };
    }, [connectionId, currentPath, dynamicDebounceMs, refreshDirectory, t, watcherEnabled]);

    return (
        <div className="sftp-browser flex-1 flex bg-background text-foreground/90">
            <div className="flex-1 flex flex-col">
            <div className="browser-toolbar p-2 border-b border-border/50 flex gap-2 items-center bg-muted/20">
                <button onClick={handleBack} disabled={currentPath === '/'} style={{ padding: '4px 8px' }}>← {t('ssh.back')}</button>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9em' }}>
                    {currentPath}
                </div>
                <button onClick={() => void handleMkdir()} style={{ padding: '4px 8px' }}>+ {t('ssh.newFolder')}</button>
                <button
                    onClick={() => {
                        refreshDirectory(true);
                    }}
                    style={{ padding: '4px 8px' }}
                >
                    ↻ {t('ssh.refresh')}
                </button>
                <label className="text-xs flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={watcherEnabled}
                        onChange={event => setWatcherEnabled(event.target.checked)}
                    />
                    {t('ssh.watch')}
                </label>
            </div>
            {(watcherUnavailable || reconnectDiagnostics.state !== 'connected') && (
                <div className="px-2 py-1 text-xs border-b border-border/40 bg-muted/20">
                    <div>
                        {t('ssh.reconnectStatus', {
                            state: reconnectDiagnostics.state,
                            attempts: reconnectDiagnostics.attempts
                        })}
                        {reconnectDiagnostics.lastReconnectAt
                            ? ` ${t('ssh.reconnectLast', { time: new Date(reconnectDiagnostics.lastReconnectAt).toLocaleTimeString() })}`
                            : ''}
                    </div>
                    {reconnectDiagnostics.lastError && <div className="text-destructive">{reconnectDiagnostics.lastError}</div>}
                    {watcherUnavailable && (
                        <button className="secondary-btn text-xs mt-1" onClick={() => refreshDirectory(true)}>
                            {t('ssh.refresh')}
                        </button>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                    {t('ssh.loading')}
                </div>
            ) : error ? (
                <div className="flex items-center justify-center h-48 text-destructive">
                    {t('ssh.connectionError', { error })}
                </div>
            ) : files.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                    {t('ssh.noFiles')}
                </div>
            ) : (
                <div className="file-list" style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9em' }}>
                        <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm shadow-sm">
                            <tr>
                                <th style={{ padding: '8px' }}>{t('ssh.fileName')}</th>
                                <th style={{ padding: '8px' }}>{t('ssh.fileSize')}</th>
                                <th style={{ padding: '8px' }}>{t('ssh.fileDate')}</th>
                                <th style={{ padding: '8px' }}>{t('ssh.fileActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(file => (
                                <tr key={file.name} className="file-row border-b border-border/30 hover:bg-muted/10 transition-colors">
                                    <td
                                        style={{ padding: '8px', cursor: file.isDirectory ? 'pointer' : 'default' }}
                                        onClick={() => {
                                            if (file.isDirectory) {
                                                handleNavigate(file.name);
                                                return;
                                            }
                                            const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
                                            void openRemoteFileForEditing(filePath);
                                        }}
                                    >
                                        {file.isDirectory ? '📁 ' : '📄 '} {file.name}
                                    </td>
                                    <td style={{ padding: '8px' }}>{!file.isDirectory && file.size ? (file.size / 1024).toFixed(1) + ' KB' : '-'}</td>
                                    <td style={{ padding: '8px', fontSize: '0.8em', opacity: 0.6 }}>{file.mtime ? new Date(file.mtime).toLocaleDateString() : '-'}</td>
                                    <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                                        <button onClick={() => void handleRename(file)} style={{ fontSize: '0.9em' }}>✎</button>
                                        <button onClick={() => void handleDelete(file)} style={{ fontSize: '0.9em' }} className="text-destructive hover:text-destructive">🗑</button>
                                        {!file.isDirectory && <button onClick={() => void handleDownload(file)} style={{ fontSize: '0.9em' }}>↓</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            </div>
            <div className="w-[360px] border-l border-border/40 p-3 space-y-2 bg-muted/10">
                <div className="text-xs font-semibold">{t('ssh.remoteEditor')}</div>
                <div className="text-xs text-muted-foreground">
                    {t('ssh.editorLatency', { latency: latencyMs, debounce: dynamicDebounceMs })}
                </div>
                {selectedFilePath ? (
                    <>
                        <div className="text-xs truncate">{selectedFilePath}</div>
                        <textarea
                            value={editorContent}
                            onChange={event => setEditorContent(event.target.value)}
                            className="w-full h-[340px] text-xs p-2 rounded border border-border/40 bg-background"
                        />
                        <div className="text-xs text-muted-foreground">
                            {isSaving ? t('ssh.editorSaving') : editorStatus}
                        </div>
                        {saveQueue.length > 0 && (
                            <div className="text-xs text-warning">
                                {t('ssh.editorQueuedCount', { count: saveQueue.length })}
                            </div>
                        )}
                        <button className="secondary-btn text-xs" onClick={() => { void flushQueuedSaves(); }}>
                            {t('ssh.editorFlushQueue')}
                        </button>
                    </>
                ) : (
                    <div className="text-xs text-muted-foreground">{t('ssh.editorSelectFile')}</div>
                )}
                <div className="border-t border-border/40 pt-2 space-y-2">
                    <div className="text-xs font-semibold">{t('ssh.transfers')}</div>
                    <div className="flex gap-1">
                        <input
                            value={uploadLocalPath}
                            onChange={event => setUploadLocalPath(event.target.value)}
                            placeholder={t('placeholder.sftpLocalPath')}
                            className="w-full px-1 py-1 border border-border/40 rounded bg-background text-xs"
                        />
                        <button className="secondary-btn text-xs" onClick={() => { void handleUpload(); }}>
                            ↑
                        </button>
                    </div>
                    <select
                        value={conflictPolicy}
                        onChange={event => setConflictPolicy(event.target.value as 'overwrite' | 'rename' | 'skip')}
                        className="w-full px-1 py-1 border border-border/40 rounded bg-background text-xs"
                    >
                        <option value="overwrite">{t('ssh.conflictOverwrite')}</option>
                        <option value="rename">{t('ssh.conflictRename')}</option>
                        <option value="skip">{t('ssh.conflictSkip')}</option>
                    </select>
                    <div className="max-h-28 overflow-auto space-y-1">
                        {transferItems.map(item => (
                            <div key={item.id} className="text-xs rounded border border-border/40 px-2 py-1">
                                <div>{item.direction}: {item.remotePath}</div>
                                <div className="text-muted-foreground">{item.status}</div>
                                {item.error && <div className="text-destructive">{item.error}</div>}
                                {item.status === 'failed' && (
                                    <button className="secondary-btn text-xs mt-1" onClick={() => retryTransfer(item.id)}>
                                        {t('ssh.retryResume')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

