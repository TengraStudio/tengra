import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Loader2, X, Box } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HFModel {
    id: string
    name: string
    author: string
    description: string
    downloads: number
    likes: number
    tags: string[]
    lastModified: string
}

interface HFFile {
    path: string
    size: number
    oid: string
    quantization: string
}

interface ModelExplorerProps {
    onClose?: () => void
}

export function ModelExplorer({ onClose }: ModelExplorerProps) {
    const [query, setQuery] = useState('')
    const [models, setModels] = useState<HFModel[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedModel, setSelectedModel] = useState<HFModel | null>(null)
    const [files, setFiles] = useState<HFFile[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [downloading, setDownloading] = useState<{ [key: string]: { received: number, total: number } }>({})
    const [modelsDir, setModelsDir] = useState<string>('')

    useEffect(() => {
        // Initial search
        search('GGUF')

        // Get models dir
        window.electron.llama.getModelsDir().then(setModelsDir)

        // Listen for progress
        window.electron.huggingface.onDownloadProgress((progress) => {
            setDownloading(prev => ({
                ...prev,
                [progress.filename]: { received: progress.received, total: progress.total }
            }))
        })
    }, [])

    const search = async (q: string) => {
        setLoading(true)
        try {
            const results = await window.electron.huggingface.searchModels(q, 50, 0)
            setModels(results)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleModelSelect = async (model: HFModel) => {
        setSelectedModel(model)
        setLoadingFiles(true)
        try {
            const fileList = await window.electron.huggingface.getFiles(model.id)
            setFiles(fileList.sort((a: any, b: any) => a.size - b.size))
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingFiles(false)
        }
    }

    const handleDownload = async (file: HFFile) => {
        if (!modelsDir) return

        if (!modelsDir) return
        // Construct full path for download usually inside a subfolder?
        // Or flattens it. Let's flatten to modelsDir for simplicity or create subfolder.
        // Let's use `author-model-quant.gguf` pattern to avoid collisions
        const safeName = `${selectedModel?.author}-${selectedModel?.name}-${file.quantization}.gguf`.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
        // Windows separator, maybe better to use join on backend? 
        // Backend expects full path. We'll try generic slash, node usually handles it.
        const universalPath = `${modelsDir}/${safeName}`.replace(/\\/g, '/')

        try {
            // Initial dummy progress
            setDownloading(prev => ({ ...prev, [universalPath]: { received: 0, total: file.size } }))

            // We use url from blob/main usually: https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf
            const downloadUrl = `https://huggingface.co/${selectedModel?.id}/resolve/main/${file.path}`

            const res = await window.electron.huggingface.downloadFile(downloadUrl, universalPath, file.size, file.oid)

            if (res.success) {
                // Remove from downloading state
                const next = { ...downloading }
                delete next[universalPath]
                setDownloading(next)
                alert(`Downloaded: ${safeName}`)
                // Optionally auto-refresh local models
            } else {
                alert('Download failed: ' + res.error)
            }
        } catch (e) {
            console.error(e)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-muted-foreground" />
                    <input
                        className="bg-transparent border-none outline-none text-lg font-semibold placeholder:text-muted-foreground/50 w-full"
                        placeholder="Search models on HuggingFace..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && search(query)}
                    />
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-accent rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Search Results */}
                <div className={cn("w-1/2 overflow-y-auto p-4 border-r border-border", selectedModel ? "hidden md:block" : "w-full")}>
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {models.map(m => (
                                <motion.div
                                    layoutId={m.id}
                                    key={m.id}
                                    onClick={() => handleModelSelect(m)}
                                    className={cn(
                                        "p-4 rounded-xl border cursor-pointer transition-all hover:bg-accent/50",
                                        selectedModel?.id === m.id ? "bg-accent border-primary" : "border-border bg-card"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold truncate" title={m.name}>{m.name}</span>
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m.downloads.toLocaleString()} ğŸ“¥</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{m.description}</p>
                                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                                        <span className="bg-muted px-1.5 py-0.5 rounded">{m.author}</span>
                                        {m.tags.slice(0, 3).map(t => <span key={t} className="bg-muted px-1.5 py-0.5 rounded">#{t}</span>)}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details & Files */}
                <AnimatePresence mode="wait">
                    {selectedModel ? (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="w-1/2 md:flex-1 bg-muted/10 flex flex-col h-full"
                        >
                            <div className="p-6 border-b border-border bg-card">
                                <h2 className="text-2xl font-bold mb-1">{selectedModel.name}</h2>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                                    <span>By {selectedModel.author}</span>
                                    <span>â€¢</span>
                                    <span>{selectedModel.likes} Likes â¤ï¸</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedModel.tags.map(t => (
                                        <span key={t} className="px-2 py-1 bg-accent rounded text-xs">{t}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Available Quantization Files</h3>
                                {loadingFiles ? (
                                    <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                                ) : (
                                    <div className="space-y-2">
                                        {files.map(f => {
                                            // Simplistic match for now, ideal matches full path.
                                            // Since we construct path: modelsDir/author-model-quant.gguf
                                            // The key in downloading is full path.

                                            // Let's refine matching:
                                            const safeName = `${selectedModel?.author}-${selectedModel?.name}-${f.quantization}.gguf`.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
                                            const universalPath = `${modelsDir}/${safeName}`.replace(/\\/g, '/')
                                            const progress = downloading[universalPath]

                                            return (
                                                <div key={f.path} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-lg group hover:border-primary/50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("w-8 h-8 rounded flex items-center justify-center",
                                                            f.quantization.includes('Q4') || f.quantization.includes('Q5') ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                                                        )}>
                                                            <Box className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">{f.quantization}</div>
                                                            <div className="text-xs text-muted-foreground">{formatSize(f.size)} â€¢ {f.path.split('/').pop()}</div>
                                                        </div>
                                                    </div>

                                                    {progress ? (
                                                        <div className="flex flex-col items-end min-w-[100px]">
                                                            <div className="text-xs font-medium mb-1">{Math.round((progress.received / progress.total) * 100)}%</div>
                                                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(progress.received / progress.total) * 100}%` }} />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDownload(f)}
                                                            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                        >
                                                            Download
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        {files.length === 0 && <div className="text-center p-8 text-muted-foreground">No GGUF files found in this repository.</div>}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground/30 flex-col gap-4">
                            <Box className="w-16 h-16 opacity-50" />
                            <p>Select a model to view files</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
