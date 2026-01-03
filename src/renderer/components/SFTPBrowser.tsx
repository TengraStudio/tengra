import { useState, useEffect } from 'react'
import './ToolDisplay.css' // Reuse some styles or create new ones

interface FileItem {
    name: string
    type: 'file' | 'directory'
    size: number
    modified: string
}

interface SFTPBrowserProps {
    connectionId: string
    onClose?: () => void
}

export function SFTPBrowser({ connectionId }: SFTPBrowserProps) {
    const [currentPath, setCurrentPath] = useState('/')
    const [files, setFiles] = useState<FileItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadFiles(currentPath)
    }, [connectionId, currentPath])

    const loadFiles = async (path: string) => {
        setLoading(true)
        setError(null)
        try {
            const result = await window.electron.ssh.listDir(connectionId, path)
            if (result.success) {
                setFiles(result.files || [])
            } else {
                setError(result.error || 'Unknown error')
            }
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleNavigate = (name: string) => {
        const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`
        setCurrentPath(newPath)
    }

    const handleBack = () => {
        if (currentPath === '/') return
        const parts = currentPath.split('/').filter(p => p.length > 0)
        parts.pop()
        setCurrentPath('/' + parts.join('/'))
    }

    const handleDelete = async (item: FileItem) => {
        if (!confirm(`${item.name} silinsin mi?`)) return

        const path = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`
        const result = item.type === 'directory'
            ? await window.electron.ssh.deleteDir(connectionId, path)
            : await window.electron.ssh.deleteFile(connectionId, path)

        if (result.success) {
            loadFiles(currentPath)
        } else {
            alert('Hata: ' + result.error)
        }
    }

    const handleMkdir = async () => {
        const name = prompt('Yeni klasör adı:')
        if (!name) return

        const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`
        const result = await window.electron.ssh.mkdir(connectionId, path)
        if (result.success) {
            loadFiles(currentPath)
        } else {
            alert('Hata: ' + result.error)
        }
    }

    const handleRename = async (item: FileItem) => {
        const newName = prompt('Yeni ad:', item.name)
        if (!newName || newName === item.name) return

        const oldPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`
        const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`

        const result = await window.electron.ssh.rename(connectionId, oldPath, newPath)
        if (result.success) {
            loadFiles(currentPath)
        } else {
            alert('Hata: ' + result.error)
        }
    }

    const handleDownload = async (item: FileItem) => {
        // Simple download trigger
        alert('Download triggered for ' + item.name + ' (Implementation pending file picker)')
    }

    return (
        <div className="sftp-browser flex-1 flex flex-col bg-background text-foreground/90">
            <div className="browser-toolbar p-2 border-b border-border/50 flex gap-2 items-center bg-muted/20">
                <button onClick={handleBack} disabled={currentPath === '/'} style={{ padding: '4px 8px' }}>↑ Geri</button>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9em' }}>
                    {currentPath}
                </div>
                <button onClick={handleMkdir} style={{ padding: '4px 8px' }}>+ Klasör</button>
                <button onClick={() => loadFiles(currentPath)} style={{ padding: '4px 8px' }}>↻ Yenile</button>
            </div>

            {loading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>Yükleniyor...</div>
            ) : error ? (
                <div style={{ padding: '20px', color: '#f44336' }}>Hata: {error}</div>
            ) : (
                <div className="file-list" style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9em' }}>
                        <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm shadow-sm">
                            <tr>
                                <th style={{ padding: '8px' }}>Ad</th>
                                <th style={{ padding: '8px' }}>Boyut</th>
                                <th style={{ padding: '8px' }}>Tarih</th>
                                <th style={{ padding: '8px' }}>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(file => (
                                <tr key={file.name} className="file-row border-b border-border/30 hover:bg-muted/10 transition-colors">
                                    <td
                                        style={{ padding: '8px', cursor: file.type === 'directory' ? 'pointer' : 'default' }}
                                        onClick={() => file.type === 'directory' && handleNavigate(file.name)}
                                    >
                                        {file.type === 'directory' ? '📁' : '📄'} {file.name}
                                    </td>
                                    <td style={{ padding: '8px' }}>{file.type === 'file' ? (file.size / 1024).toFixed(1) + ' KB' : '-'}</td>
                                    <td style={{ padding: '8px', fontSize: '0.8em', opacity: 0.6 }}>{new Date(file.modified).toLocaleDateString()}</td>
                                    <td style={{ padding: '8px', display: 'flex', gap: '4px' }}>
                                        <button onClick={() => handleRename(file)} style={{ fontSize: '0.9em' }}>✎</button>
                                        <button onClick={() => handleDelete(file)} style={{ fontSize: '0.9em' }} className="text-red-500 hover:text-red-400">🗑</button>
                                        {file.type === 'file' && <button onClick={() => handleDownload(file)} style={{ fontSize: '0.9em' }}>↓</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
