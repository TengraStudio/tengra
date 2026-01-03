import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
    Search,
    Download,
    Trash2,
    HardDrive,
    RefreshCw,
    Check,
    Loader2
} from 'lucide-react'

interface Model {
    name: string
    size: string
    modified: string
    digest?: string
    quantization?: string
    downloads?: number
    source: 'ollama' | 'huggingface' | 'local'
}

interface ModelHubPageProps {
    installedModels: { name: string }[]
    onRefreshModels: () => void
    onSelectModel: (model: string) => void
    selectedModel: string
}

export function ModelHubPage({
    installedModels,
    onRefreshModels,
    onSelectModel,
    selectedModel
}: ModelHubPageProps) {
    const [activeTab, setActiveTab] = useState<'installed' | 'ollama' | 'huggingface'>('installed')
    const [searchQuery, setSearchQuery] = useState('')
    const [_ollamaModels, _setOllamaModels] = useState<Model[]>([])
    const [_isLoading, _setIsLoading] = useState(false)
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null)
    const [downloadProgress, setDownloadProgress] = useState(0)

    // Popular Ollama models (static list for now)
    const popularOllamaModels: Model[] = [
        { name: 'llama3.1:8b', size: '4.7 GB', modified: '', quantization: 'Q4_K_M', downloads: 1200000, source: 'ollama' },
        { name: 'llama3.1:70b', size: '40 GB', modified: '', quantization: 'Q4_K_M', downloads: 800000, source: 'ollama' },
        { name: 'qwen2.5:14b', size: '9 GB', modified: '', quantization: 'Q4_K_M', downloads: 500000, source: 'ollama' },
        { name: 'mistral:7b', size: '4.1 GB', modified: '', quantization: 'Q4_K_M', downloads: 900000, source: 'ollama' },
        { name: 'codellama:13b', size: '7.4 GB', modified: '', quantization: 'Q4_K_M', downloads: 600000, source: 'ollama' },
        { name: 'gemma2:9b', size: '5.5 GB', modified: '', quantization: 'Q4_K_M', downloads: 400000, source: 'ollama' },
        { name: 'phi3:14b', size: '7.9 GB', modified: '', quantization: 'Q4_K_M', downloads: 350000, source: 'ollama' },
        { name: 'deepseek-coder:6.7b', size: '3.8 GB', modified: '', quantization: 'Q4_K_M', downloads: 300000, source: 'ollama' },
    ]

    const handleDownload = async (modelName: string) => {
        setDownloadingModel(modelName)
        setDownloadProgress(0)

        try {
            // Simulate progress (real implementation would use IPC)
            const interval = setInterval(() => {
                setDownloadProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval)
                        return 100
                    }
                    return prev + Math.random() * 15
                })
            }, 500)

            await window.electron.pullModel(modelName)
            clearInterval(interval)
            setDownloadProgress(100)
            onRefreshModels()
        } catch (error) {
            console.error('Download failed:', error)
        } finally {
            setTimeout(() => {
                setDownloadingModel(null)
                setDownloadProgress(0)
            }, 1000)
        }
    }

    const handleDelete = async (modelName: string) => {
        if (confirm(`"${modelName}" modelini silmek istediğinize emin misiniz?`)) {
            try {
                await window.electron.deleteOllamaModel(modelName)
                onRefreshModels()
            } catch (error) {
                console.error('Delete failed:', error)
            }
        }
    }

    const filteredModels = activeTab === 'installed'
        ? installedModels.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : popularOllamaModels.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))

    const isInstalled = (modelName: string) =>
        installedModels.some(m => m.name === modelName || m.name.startsWith(modelName.split(':')[0]))

    const tabs = [
        { id: 'installed', label: 'Yüklü', count: installedModels.length },
        { id: 'ollama', label: 'Ollama', count: null },
        { id: 'huggingface', label: 'HuggingFace', count: null },
    ]

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-border/50 flex items-center justify-between px-6 bg-card/30">
                <h1 className="text-lg font-semibold">Model Hub</h1>
                <button
                    onClick={onRefreshModels}
                    className="btn-ghost flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Yenile</span>
                </button>
            </header>

            {/* Tabs & Search */}
            <div className="px-6 py-4 border-b border-border/50 space-y-4">
                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-card rounded-lg w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                                activeTab === tab.id
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab.label}
                            {tab.count !== null && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/10 rounded">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Model ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field w-full pl-10"
                    />
                </div>
            </div>

            {/* Model Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredModels.map((model, index) => {
                        const modelName = typeof model === 'string' ? model : (model as any).name
                        const installed = activeTab === 'installed' || isInstalled(modelName)
                        const isDownloading = downloadingModel === modelName
                        const isSelected = selectedModel === modelName || selectedModel.startsWith(modelName)

                        return (
                            <motion.div
                                key={modelName}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className={cn(
                                    "glass-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors",
                                    isSelected && "border-primary/50 bg-primary/5"
                                )}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-sm truncate">{modelName}</h3>
                                        {'size' in model && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {(model as Model).size}
                                                {(model as Model).quantization && ` • ${(model as Model).quantization}`}
                                            </p>
                                        )}
                                    </div>
                                    {installed && (
                                        <span className="px-2 py-0.5 text-sm font-medium bg-accent/20 text-accent rounded-full">
                                            Yüklü
                                        </span>
                                    )}
                                </div>

                                {/* Download Progress */}
                                {isDownloading && (
                                    <div className="space-y-1">
                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-300"
                                                style={{ width: `${downloadProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            İndiriliyor... {Math.round(downloadProgress)}%
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 mt-auto">
                                    {installed ? (
                                        <>
                                            <button
                                                onClick={() => onSelectModel(modelName)}
                                                className={cn(
                                                    "flex-1 btn-ghost text-xs py-2",
                                                    isSelected && "bg-primary/20 text-primary"
                                                )}
                                            >
                                                {isSelected ? (
                                                    <><Check className="w-3 h-3 mr-1" /> Aktif</>
                                                ) : (
                                                    'Seç'
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(modelName)}
                                                className="btn-ghost text-xs py-2 text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleDownload(modelName)}
                                            disabled={isDownloading}
                                            className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1"
                                        >
                                            {isDownloading ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Download className="w-3.5 h-3.5" />
                                            )}
                                            İndir
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

                {filteredModels.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <HardDrive className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground">
                            {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz model yok'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
