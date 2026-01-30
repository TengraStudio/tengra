import { useCallback,useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { ServiceResponse,SSHFile } from '@/types';

interface SFTPBrowserProps {
    connectionId: string
    onClose?: () => void
}

export function SFTPBrowser({ connectionId }: SFTPBrowserProps) {
    const { t } = useTranslation();
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<SSHFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFiles = useCallback(async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.electron.ssh.listDir(connectionId, path) as ServiceResponse<SSHFile[]>;
            if (result.success) {
                setFiles(result.data ?? []);
            } else {
                setError(result.error ?? t('ssh.unknownError'));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [connectionId, t]);

    useEffect(() => {
        void loadFiles(currentPath);
    }, [loadFiles, currentPath]);

    const handleNavigate = (name: string) => {
        const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        setCurrentPath(newPath);
    };

    const handleBack = () => {
        if (currentPath === '/') {return;}
        const parts = currentPath.split('/').filter(p => p.length > 0);
        parts.pop();
        setCurrentPath('/' + parts.join('/'));
    };

    const handleDelete = async (item: SSHFile) => {
        console.warn(t('ssh.confirmDeleteFile', { name: item.name }));

        const path = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        const result = item.isDirectory
            ? await window.electron.ssh.deleteDir(connectionId, path)
            : await window.electron.ssh.deleteFile(connectionId, path);

        if (result.success) {
            void loadFiles(currentPath);
        } else {
            console.warn(t('ssh.connectionError', { error: result.error ?? 'Unknown error' }));
        }
    };

    const handleMkdir = async () => {
        const name = 'new-folder'; // Replaced prompt with default name
        console.warn(t('ssh.newFolderName'));

        const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        const result = await window.electron.ssh.mkdir(connectionId, path);
        if (result.success) {
            void loadFiles(currentPath);
        } else {
            console.warn(t('ssh.connectionError', { error: result.error ?? 'Unknown error' }));
        }
    };

    const handleRename = async (item: SSHFile) => {
        const newName = item.name; // Replaced prompt with original name
        console.warn(t('ssh.newName'));

        const oldPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
        const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;

        const result = await window.electron.ssh.rename(connectionId, oldPath, newPath);
        if (result.success) {
            void loadFiles(currentPath);
        } else {
            console.warn(t('ssh.connectionError', { error: result.error ?? 'Unknown error' }));
        }
    };

    const handleDownload = async (item: SSHFile) => {
        // Simple download trigger
        console.warn(t('ssh.downloadTriggered', { name: item.name }) + ' (Implementation pending file picker)');
    };

    return (
        <div className="sftp-browser flex-1 flex flex-col bg-background text-foreground/90">
            <div className="browser-toolbar p-2 border-b border-border/50 flex gap-2 items-center bg-muted/20">
                <button onClick={handleBack} disabled={currentPath === '/'} style={{ padding: '4px 8px' }}>← {t('ssh.back')}</button>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9em' }}>
                    {currentPath}
                </div>
                <button onClick={() => void handleMkdir()} style={{ padding: '4px 8px' }}>+ {t('ssh.newFolder')}</button>
                <button onClick={() => void loadFiles(currentPath)} style={{ padding: '4px 8px' }}>↻ {t('ssh.refresh')}</button>
            </div>

            {loading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>{t('ssh.loading')}</div>
            ) : error ? (
                <div style={{ padding: '20px', color: '#f44336' }}>{t('ssh.connectionError', { error })}</div>
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
                                        onClick={() => file.isDirectory && handleNavigate(file.name)}
                                    >
                                        {file.isDirectory ? '📁 ' : '📄 '} {file.name}
                                    </td>
                                    <td style={{ padding: '8px' }}>{!file.isDirectory && file.size ? (file.size / 1024).toFixed(1) + ' KB' : '-'}</td>
                                    <td style={{ padding: '8px', fontSize: '0.8em', opacity: 0.6 }}>{file.mtime ? new Date(file.mtime).toLocaleDateString() : '-'}</td>
                                    <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                                        <button onClick={() => void handleRename(file)} style={{ fontSize: '0.9em' }}>✎</button>
                                        <button onClick={() => void handleDelete(file)} style={{ fontSize: '0.9em' }} className="text-red-500 hover:text-red-400">🗑</button>
                                        {!file.isDirectory && <button onClick={() => void handleDownload(file)} style={{ fontSize: '0.9em' }}>↓</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
