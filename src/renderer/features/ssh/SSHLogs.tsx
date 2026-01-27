import React, { useCallback, useEffect, useState } from 'react';

interface SSHLogsProps {
    connectionId: string
    active: boolean
}

export const SSHLogs: React.FC<SSHLogsProps> = ({ connectionId, active }) => {
    const [logFiles, setLogFiles] = useState<string[]>([]);
    const [selectedLog, setSelectedLog] = useState<string | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    const loadFiles = useCallback(async () => {
        const files = await window.electron.ssh.getLogFiles(connectionId);
        setLogFiles(files);
        if (files.length > 0 && !selectedLog) {
            const firstFile = files[0];
            setSelectedLog(firstFile);
            setLoading(true);
            try {
                const data = await window.electron.ssh.readLogFile(connectionId, firstFile, 100);
                setContent(data);
            } finally {
                setLoading(false);
            }
        }
    }, [connectionId, selectedLog]);

    useEffect(() => {
        if (active && logFiles.length === 0) {
            void loadFiles();
        }
    }, [active, logFiles.length, loadFiles]);

    const selectLog = async (path: string) => {
        setSelectedLog(path);
        setLoading(true);
        try {
            const data = await window.electron.ssh.readLogFile(connectionId, path, 100);
            setContent(data);
        } catch {
            setContent('Failed to read log file (Permissions denied or empty).');
        } finally {
            setLoading(false);
        }
    };

    if (!active) { return null; }

    return (
        <div className="flex h-full">
            {/* Sidebar list */}
            <div className="w-1/3 border-r border-border bg-muted/20 flex flex-col">
                <div className="p-3 border-b border-border font-medium text-sm flex justify-between items-center">
                    <span>Log Files</span>
                    <button onClick={() => void loadFiles()} className="text-xs opacity-70 hover:opacity-100">Refresh</button>
                </div>
                <div className="overflow-y-auto flex-1">
                    {logFiles.map(file => (
                        <button
                            key={file}
                            onClick={() => void selectLog(file)}
                            className={`w-full text-left px-4 py-2 text-sm truncate hover:bg-muted/20 ${selectedLog === file ? 'bg-primary/10 text-primary border-r-2 border-primary' : 'text-muted-foreground'}`}
                        >
                            {file}
                        </button>
                    ))}
                </div>
            </div>

            {/* Viewer */}
            <div className="flex-1 flex flex-col bg-background text-foreground">
                <div className="p-2 bg-muted/30 border-b border-border text-xs font-mono text-muted-foreground flex justify-between">
                    <span>{selectedLog || 'Select a log file'}</span>
                    <span>{loading ? 'Reading...' : 'Last 100 lines'}</span>
                </div>
                <pre className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {content}
                </pre>
            </div>
        </div>
    );
};
