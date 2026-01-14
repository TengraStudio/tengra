import { Activity,FileText, Folder, Package } from 'lucide-react'
import { useEffect,useState } from 'react'

import { useTranslation } from '@/i18n'
import type { IpcValue } from '@/types'

interface DirectoryAnalysis {
    hasPackageJson: boolean
    pkg: Record<string, IpcValue>
    readme: string | null
    stats: { fileCount: number; totalSize: number }
}

interface FolderInspectorProps {
    folderPath: string | null
    rootPath: string
}

export const FolderInspector = ({ folderPath, rootPath }: FolderInspectorProps) => {
    const { t } = useTranslation()
    const [data, setData] = useState<DirectoryAnalysis | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const loadData = async () => {
            if (!folderPath) {
                setData(null)
                return
            }
            setLoading(true)
            try {
                const res = await window.electron.project.analyzeDirectory(folderPath)
                setData(res)
            } catch (error) {
                console.error('Failed to analyze folder:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [folderPath])

    if (!folderPath) {return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
            <Folder className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">{t('inspector.selectFolder') || 'Select a folder to view details'}</p>
        </div>
    )}

    if (loading) {return <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Activity className="w-4 h-4 animate-spin" /> {t('inspector.analyzing') || 'Analyzing folder...'}</div>}

    if (!data) {return null}

    const relativePath = folderPath.replace(rootPath, '') || '/'

    return (
        <div className="h-full flex flex-col bg-card rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
                <div className="flex items-center gap-2 font-medium text-white truncate text-sm">
                    <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="truncate" title={relativePath}>{relativePath === '/' ? 'Root' : relativePath}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-[10px] uppercase text-muted-foreground mb-1">Files</div>
                        <div className="text-xl font-bold">{data.stats?.fileCount || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                        <div className="text-[10px] uppercase text-muted-foreground mb-1">Size</div>
                        <div className="text-xl font-bold">{(data.stats?.totalSize / 1024).toFixed(1)} KB</div>
                    </div>
                </div>

                {/* Package.json Info */}
                {data.hasPackageJson && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                            <Package className="w-3.5 h-3.5" /> NPM Package
                        </h3>
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Name:</span>
                                <span className="font-mono text-emerald-400">{String(data.pkg.name || 'unnamed')}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Version:</span>
                                <span className="font-mono">{String(data.pkg.version || '0.0.0')}</span>
                            </div>

                            {/* Scripts */}
                            {data.pkg.scripts && Object.keys(data.pkg.scripts).length > 0 && (
                                <div className="pt-2 border-t border-white/5 mt-2">
                                    <div className="text-[10px] uppercase text-muted-foreground mb-2">Scripts</div>
                                    <div className="grid grid-cols-1 gap-1">
                                        {Object.entries(data.pkg.scripts).slice(0, 5).map(([name, cmd]) => (
                                            <div key={name} className="flex items-center justify-between group p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer">
                                                <span className="font-mono text-xs text-blue-300 font-bold">{name}</span>
                                                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]" title={cmd as string}>{cmd as string}</span>
                                            </div>
                                        ))}
                                        {Object.keys(data.pkg.scripts).length > 5 && (
                                            <div className="text-[10px] text-muted-foreground italic px-1 pt-1">
                                                + {Object.keys(data.pkg.scripts).length - 5} more scripts
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Dependencies */}
                            {data.pkg.dependencies && Object.keys(data.pkg.dependencies).length > 0 && (
                                <div className="pt-2 border-t border-white/5 mt-2">
                                    <div className="text-[10px] uppercase text-muted-foreground mb-2">Dependencies</div>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.keys(data.pkg.dependencies).slice(0, 8).map(dep => (
                                            <span key={dep} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-gray-300">
                                                {dep}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* README */}
                {data.readme && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" /> Readme
                        </h3>
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 text-xs text-muted-foreground leading-relaxed">
                            <pre className="whitespace-pre-wrap font-sans">{data.readme.slice(0, 500) + (data.readme.length > 500 ? '...' : '')}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
