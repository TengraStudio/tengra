import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from '@/lib/framer-motion-compat'
import { Search, Loader2, X, Box, Download, Database, Server, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

interface HFModel {
    id: string
    name: string
    author: string
    description: string
    downloads: number
    likes: number
    tags: string[]
    lastModified: string
    provider: 'huggingface'
}

interface OllamaLibraryModel {
    name: string
    description: string
    tags: string[]
    provider: 'ollama'
    pulls?: string
}

type UnifiedModel = HFModel | OllamaLibraryModel

interface HFFile {
    path: string
    size: number
    oid: string
    quantization: string
}

import { useTranslation } from '@/i18n'
import type { Language } from '@/i18n'

import type { ModelInfo } from '../utils/model-fetcher'

interface ModelExplorerProps {
    onClose?: () => void
    onRefreshModels?: () => void
    installedModels?: ModelInfo[]
    language?: Language
}

export function ModelExplorer({ onClose, onRefreshModels, installedModels = [], language = 'en' }: ModelExplorerProps) {
    const { t } = useTranslation(language)
    const [query, setQuery] = useState('')
    const [activeSource, setActiveSource] = useState<'all' | 'ollama' | 'huggingface'>('all')
    const [sortBy, setSortBy] = useState<'name' | 'popularity' | 'updated'>('popularity')
    const [page, setPage] = useState(0)

    // Data
    const [ollamaLibrary, setOllamaLibrary] = useState<OllamaLibraryModel[]>([])
    const [hfResults, setHfResults] = useState<HFModel[]>([])
    const [loading, setLoading] = useState(false)
    const [totalHf, setTotalHf] = useState(0)

    const isInstalled = useMemo(() => {
        const ids = new Set(installedModels.map(m => m.id))
        return (id: string) => ids.has(id)
    }, [installedModels])

    // Selection & Files
    const [selectedModel, setSelectedModel] = useState<UnifiedModel | null>(null)
    const [files, setFiles] = useState<HFFile[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [downloading, setDownloading] = useState<{ [key: string]: { received: number, total: number } }>({})
    const [modelsDir, setModelsDir] = useState<string>('')
    const [pullingOllama, setPullingOllama] = useState<string | null>(null)

    useEffect(() => {
        // Load Ollama Library
        window.electron.getLibraryModels().then((libs) => {
            // Map the strictly typed response to OllamaLibraryModel
            const typedLibs = libs.map(l => ({ ...l, provider: 'ollama' as const, pulls: undefined }))
            console.log(`[ModelExplorer] Fetched ${typedLibs.length} models from Ollama library.`);
            setOllamaLibrary(typedLibs)
        })

        // Get models dir
        window.electron.llama.getModelsDir().then(setModelsDir)

        // Listen for progress
        window.electron.huggingface.onDownloadProgress((progress) => {
            setDownloading(prev => ({
                ...prev,
                [progress.filename]: { received: progress.received, total: progress.total }
            }))
        })

        // Listen for Ollama pull progress
        window.electron.onPullProgress((progress) => {
            // progress: { status, completed, total, model }
            if (progress.status === 'success') {
                setPullingOllama(null)
                onRefreshModels?.()
            }
        })

        return () => {
            window.electron.removePullProgressListener()
        }
    }, [onRefreshModels])

    const fetchModels = useCallback(async () => {
        setLoading(true)
        try {
            if (activeSource !== 'ollama') {
                // HF API is 0-indexed usually
                const hfSort = sortBy === 'popularity' ? 'downloads' : (sortBy === 'updated' ? 'updated' : 'name');
                const result = await window.electron.huggingface.searchModels(query, 40, page, hfSort)
                const { models, total } = result
                console.log(`[ModelExplorer] Fetched ${models.length} of ${total} models from HuggingFace (Query: "${query}", Page: ${page}, Sort: ${sortBy})`);
                setHfResults(models.map((r) => ({ ...r, provider: 'huggingface' })))
                setTotalHf(total)
            } else {
                setHfResults([])
                setTotalHf(0)
            }
        } catch (e) {
            console.error(e)
            setHfResults([])
        } finally {
            setLoading(false)
        }
    }, [activeSource, query, page, sortBy])

    // HF fetch effect
    useEffect(() => {
        // Initial fetch immediately, subsequent with debounce if query changes
        if (!query && hfResults.length === 0) {
            fetchModels()
            return
        }

        const timer = setTimeout(() => {
            fetchModels()
        }, 500)
        return () => clearTimeout(timer)
    }, [query, hfResults.length, fetchModels])

    // Filter Ollama locally
    const filteredOllama = useMemo(() => {
        if (activeSource === 'huggingface') return []
        if (page > 0) return [] // Only show Ollama on first page mixed results

        let filtered = ollamaLibrary
        if (query) {
            filtered = ollamaLibrary.filter(m =>
                m.name.toLowerCase().includes(query.toLowerCase()) ||
                m.description.toLowerCase().includes(query.toLowerCase())
            )
        }

        // If in 'all' mode, only show top 12 models to avoid drowning out HF
        if (activeSource === 'all' && filtered.length > 12) {
            // Sort by popularity first to get the best ones
            const parsePulls = (pulls?: string): number => {
                if (!pulls) return 0;
                const str = pulls.toUpperCase().replace(/\s+PULLS/i, '').trim();
                const num = parseFloat(str);
                if (isNaN(num)) return 0;
                if (str.endsWith('M')) return num * 1000000;
                if (str.endsWith('K')) return num * 1000;
                return num;
            };
            return [...filtered].sort((a, b) => parsePulls(b.pulls) - parsePulls(a.pulls)).slice(0, 12)
        }

        return filtered
    }, [ollamaLibrary, query, activeSource, page])

    const displayModels = useMemo(() => {
        const base = [...hfResults, ...(activeSource === 'all' || activeSource === 'ollama' ? filteredOllama : [])]

        const parsePulls = (pulls?: string): number => {
            if (!pulls) return 0;
            const str = pulls.toUpperCase().replace(/\s+PULLS/i, '').trim();
            const num = parseFloat(str);
            if (isNaN(num)) return 0;
            if (str.endsWith('M')) return num * 1000000;
            if (str.endsWith('K')) return num * 1000;
            if (str.endsWith('B')) return num * 1000000000;
            return num;
        };

        return base.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name)
            if (sortBy === 'popularity') {
                const aVal = a.provider === 'huggingface' ? (a as HFModel).downloads : parsePulls((a as OllamaLibraryModel).pulls)
                const bVal = b.provider === 'huggingface' ? (b as HFModel).downloads : parsePulls((b as OllamaLibraryModel).pulls)
                return bVal - aVal
            }
            if (sortBy === 'updated' && a.provider === 'huggingface' && b.provider === 'huggingface') {
                return new Date((b as HFModel).lastModified).getTime() - new Date((a as HFModel).lastModified).getTime()
            }
            return 0
        })
    }, [hfResults, filteredOllama, sortBy, activeSource])

    const handleModelSelect = async (model: UnifiedModel) => {
        setSelectedModel(model)
        if (model.provider === 'huggingface') {
            setLoadingFiles(true)
            try {
                const fileList = await window.electron.huggingface.getFiles((model as HFModel).id)
                setFiles(fileList.sort((a, b) => a.size - b.size))
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingFiles(false)
            }
        }
    }

    const handlePullOllama = async (modelName: string, tag: string) => {
        const fullModelName = `${modelName}:${tag}`
        setPullingOllama(fullModelName)
        try {
            await window.electron.pullModel(fullModelName)
            alert(`Successfully pulled ${fullModelName}`)
            onRefreshModels?.()
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            alert(`Failed to pull: ${message}`)
        } finally {
            setPullingOllama(null)
        }
    }

    const handleDownloadHF = async (file: HFFile) => {
        if (!modelsDir || !selectedModel || selectedModel.provider !== 'huggingface') return

        const safeName = `${selectedModel.author}-${selectedModel.name}-${file.quantization}.gguf`.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
        const universalPath = `${modelsDir}/${safeName}`.replace(/\\/g, '/')

        try {
            setDownloading(prev => ({ ...prev, [universalPath]: { received: 0, total: file.size } }))
            const downloadUrl = `https://huggingface.co/${selectedModel.id}/resolve/main/${file.path}`

            const res = await window.electron.huggingface.downloadFile(downloadUrl, universalPath, file.size, file.oid)

            if (res.success) {
                const next = { ...downloading }
                delete next[universalPath]
                setDownloading(next)
                alert(`Downloaded: ${safeName}`)
                onRefreshModels?.()
            } else {
                alert('Download failed: ' + res.error)
                const next = { ...downloading }
                delete next[universalPath]
                setDownloading(next)
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
            <div className="p-8 border-b border-border/50 space-y-6 bg-background/50 backdrop-blur-xl sticky top-0 z-30">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black tracking-tight">{t('modelExplorer.title')}</h1>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">{t('modelExplorer.subtitle')}</p>
                        <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-1.5">
                            <Box className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-bold text-primary tracking-wide uppercase">
                                {totalHf > 0 ? `${totalHf.toLocaleString()} ` : ''}{t('modelExplorer.ggufCompatible')}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            className="w-full bg-muted/30 border border-border/30 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/50 shadow-inner"
                            placeholder={t('modelExplorer.searchPlaceholder')}
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                        />
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="p-3 hover:bg-muted/50 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-border/50">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                        <button onClick={() => { setActiveSource('all'); setPage(0); }} className={cn("px-6 py-2.5 rounded-xl text-xs font-bold transition-all border", activeSource === 'all' ? "bg-primary text-primary-foreground border-primary" : "bg-muted/20 border-border/50 hover:bg-muted/40")}>{t('modelExplorer.allSources')}</button>
                        <button onClick={() => { setActiveSource('ollama'); setPage(0); }} className={cn("px-6 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2", activeSource === 'ollama' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" : "bg-muted/20 border-border/50 hover:bg-muted/40")}>
                            <Database className="w-3.5 h-3.5" />
                            <span>Ollama</span>
                            <span className="ml-1 opacity-50 px-1.5 py-0.5 bg-orange-500/10 rounded-md text-[10px]">{ollamaLibrary.length} {t('modelExplorer.libraryModels')}</span>
                        </button>
                        <button onClick={() => { setActiveSource('huggingface'); setPage(0); }} className={cn("px-6 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2", activeSource === 'huggingface' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-500" : "bg-muted/20 border-border/50 hover:bg-muted/40")}>
                            <Box className="w-3.5 h-3.5" />
                            <span>HuggingFace</span>
                            <span className="ml-1 opacity-50 px-1.5 py-0.5 bg-yellow-500/10 rounded-md text-[10px]">{totalHf.toLocaleString()} {t('modelExplorer.models')}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-muted/10 px-3 py-1 rounded-xl border border-border/30">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">{t('modelExplorer.sort')}</span>
                            <SelectDropdown
                                value={sortBy}
                                options={[
                                    { value: 'popularity', label: t('modelExplorer.popularity') },
                                    { value: 'name', label: t('modelExplorer.name') },
                                    { value: 'updated', label: t('modelExplorer.newest') }
                                ]}
                                onChange={(val) => setSortBy(val as 'name' | 'popularity' | 'updated')}
                                className="min-w-[120px]"
                            />
                        </div>

                        <div className="flex items-center bg-muted/20 rounded-xl p-1 border border-border/50">
                            <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="p-2 rounded-lg hover:bg-muted transition-all disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-x border-border/30">{t('modelExplorer.page')} {page + 1}</span>
                            <button onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg hover:bg-muted transition-all"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
                {/* Grid Results */}
                <div className={cn("flex-1 overflow-y-auto p-8 pt-4 transition-all duration-500 ease-in-out", selectedModel ? "w-1/2 pr-4" : "w-full")}>
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-muted-foreground text-xs animate-pulse">{t('modelExplorer.searching')}</p>
                        </div>
                    )}

                    {!loading && displayModels.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p>{t('modelExplorer.noModels')}</p>
                        </div>
                    )}

                    <div className={cn("grid gap-8 pb-12 transition-all duration-700", selectedModel ? "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6")}>
                        {displayModels.map(m => {
                            const isOllama = m.provider === 'ollama'
                            const isHF = m.provider === 'huggingface'
                            // Selection Fix: Unique ID per provider
                            const mId = isOllama ? (m as OllamaLibraryModel).name : (m as HFModel).id
                            const key = `${m.provider}-${mId}`
                            const isSelected = selectedModel &&
                                (selectedModel.provider === 'ollama' ? (selectedModel as OllamaLibraryModel).name : (selectedModel as HFModel).id) === mId &&
                                selectedModel.provider === m.provider

                            // Extract some details for Ollama models if possible
                            const name = isOllama ? (m as OllamaLibraryModel).name : (m as HFModel).name
                            const params = isOllama ? (m as OllamaLibraryModel).tags.find(t => t.toLowerCase().includes('b') || t.toLowerCase().includes('m')) : ''
                            const architecture = name.toLowerCase().includes('llama') ? 'Llama' :
                                name.toLowerCase().includes('mistral') ? 'Mistral' :
                                    name.toLowerCase().includes('phi') ? 'Phi' :
                                        name.toLowerCase().includes('gemma') ? 'Gemma' :
                                            name.toLowerCase().includes('qwen') ? 'Qwen' : 'Transformer'

                            return (
                                <motion.div
                                    key={key}
                                    onClick={() => handleModelSelect(m)}
                                    className={cn(
                                        "group relative flex flex-col bg-card border rounded-3xl overflow-hidden transition-all duration-300 cursor-pointer",
                                        isSelected ? "border-primary ring-1 ring-primary/20 bg-primary/[0.02]" : "border-border/40 hover:border-primary/30 hover:bg-accent/5"
                                    )}
                                >
                                    <div className="p-7 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.2em] shadow-sm", isOllama ? "bg-orange-500/20 text-orange-400 border border-orange-500/20" : "bg-yellow-500/20 text-yellow-500 border border-yellow-500/20")}>
                                                    {isOllama ? 'OLLAMA' : 'HUGGINGFACE'}
                                                </div>
                                                {isInstalled(mId) && (
                                                    <div className="text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-[0.2em] bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 shadow-sm">
                                                        {t('modelExplorer.pulled')}
                                                    </div>
                                                )}
                                            </div>
                                            {isHF && (
                                                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/80 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/30">
                                                    <Download className="w-3.5 h-3.5" />
                                                    {(m as HFModel).downloads > 1000 ? `${((m as HFModel).downloads / 1000).toFixed(1)}k` : (m as HFModel).downloads}
                                                </div>
                                            )}
                                            {isOllama && (m as OllamaLibraryModel).pulls && (
                                                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/80 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/30">
                                                    <Download className="w-3.5 h-3.5" />
                                                    {(m as OllamaLibraryModel).pulls}
                                                </div>
                                            )}
                                        </div>

                                        <div className="relative mb-2">
                                            <h3 className="font-black text-2xl line-clamp-1 tracking-tighter" title={name}>
                                                {name}
                                            </h3>
                                        </div>

                                        <div className="flex items-center gap-3 mb-6">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/70">{architecture}</span>
                                            {params && <span className="w-1 h-1 rounded-full bg-border" />}
                                            {params && <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{params} Params</span>}
                                        </div>

                                        <p className="text-sm text-muted-foreground/70 line-clamp-3 mb-8 leading-relaxed font-medium">
                                            {m.description || 'Access state-of-the-art intelligence with this advanced language model.'}
                                        </p>

                                        <div className="flex flex-wrap gap-2 mt-auto">
                                            {m.tags.slice(0, 4).map(t => (
                                                <span key={t} className="px-3 py-1.5 bg-muted/40 rounded-xl text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 border border-transparent group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                                                    {t}
                                                </span>
                                            ))}
                                            {m.tags.length > 4 && <span className="px-2 py-1 text-[10px] font-black text-muted-foreground/30">+{m.tags.length - 4}</span>}
                                        </div>
                                    </div>

                                    {/* Hover Interactive Decor */}
                                    <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-full group-hover:translate-y-0" />
                                </motion.div>
                            )
                        })}
                    </div>
                </div>

                {/* Details & Files Panel */}
                <AnimatePresence mode="wait">
                    {selectedModel && (
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 40 }}
                            className="w-[450px] border-l border-border/50 bg-card/60 backdrop-blur-2xl flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.2)] relative z-40"
                        >
                            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-white/5">
                                <h2 className="font-black truncate pr-4 text-lg">
                                    {selectedModel.provider === 'ollama' ? (selectedModel as OllamaLibraryModel).name : (selectedModel as HFModel).name}
                                </h2>
                                <button onClick={() => setSelectedModel(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90 shadow-sm border border-transparent hover:border-white/10">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-4 border-b border-border/50 bg-white/5">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    <span className="text-foreground">{selectedModel.provider === 'ollama' ? 'Ollama Library' : (selectedModel as HFModel).author}</span>
                                    {selectedModel.provider === 'huggingface' && (
                                        <>
                                            <span className="opacity-30 px-1">â€¢</span>
                                            <span>{(selectedModel as HFModel).likes} Likes</span>
                                            <span className="opacity-30 px-1">â€¢</span>
                                            <span>{(selectedModel as HFModel).lastModified?.split('T')[0]}</span>
                                        </>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed max-h-[120px] overflow-y-auto pr-4 scrollbar-thin">
                                    {selectedModel.description || 'This versatile model is optimized for high-performance inference and can handle a wide variety of tasks with precision.'}
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                                {/* Metadata Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.architecture')}</span>
                                        <span className="text-xs font-bold text-foreground">
                                            {selectedModel.provider === 'ollama' ?
                                                ((selectedModel as OllamaLibraryModel).name.toLowerCase().includes('llama') ? 'Llama 3' : 'Transformer') :
                                                'GGUF / Transformer'}
                                        </span>
                                    </div>
                                    <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.context')}</span>
                                        <span className="text-xs font-bold text-foreground">
                                            {selectedModel.provider === 'ollama' ?
                                                ((selectedModel as OllamaLibraryModel).name.includes('3.2') || (selectedModel as OllamaLibraryModel).name.includes('3.1') ? '128K' : '8K') :
                                                'Variable'}
                                        </span>
                                    </div>
                                    <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.updated')}</span>
                                        <span className="text-xs font-bold text-foreground">
                                            {selectedModel.provider === 'ollama' ? 'Library Latest' : (selectedModel as HFModel).lastModified?.split('T')[0]}
                                        </span>
                                    </div>
                                    <div className="bg-muted/10 border border-border/30 rounded-2xl p-4 flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{t('modelExplorer.provider')}</span>
                                        <span className="text-xs font-bold text-foreground uppercase">{selectedModel.provider}</span>
                                    </div>
                                </div>

                                {/* Hardware Stats */}
                                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
                                        <Database className="w-4 h-4" /> {t('modelExplorer.hardwareReq')}
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">{t('modelExplorer.minVram')}</span>
                                            <span className="font-mono font-bold text-primary">
                                                {selectedModel.provider === 'ollama' ?
                                                    ((selectedModel as OllamaLibraryModel).name.includes('70b') ? '~40GB' :
                                                        (selectedModel as OllamaLibraryModel).name.includes('13b') ? '~10GB' : '~6GB') :
                                                    '~8GB (Rec.)'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">{t('modelExplorer.systemRam')}</span>
                                            <span className="font-mono font-bold text-foreground">
                                                {selectedModel.provider === 'ollama' ?
                                                    ((selectedModel as OllamaLibraryModel).name.includes('70b') ? '64GB+' : '16GB+') :
                                                    '16GB (Min)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                                        <Server className="w-4 h-4 text-muted-foreground/50" /> {t('modelExplorer.availableVersions')}
                                    </h3>

                                    {selectedModel.provider === 'huggingface' ? (
                                        loadingFiles ? (
                                            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <p className="text-[10px] font-bold text-muted-foreground animate-pulse">{t('modelExplorer.scanningFiles')}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {files.map(f => {
                                                    const safeName = `${(selectedModel as HFModel).author}-${(selectedModel as HFModel).name}-${f.quantization}.gguf`.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
                                                    const universalPath = `${modelsDir}/${safeName}`.replace(/\\/g, '/')
                                                    const progress = downloading[universalPath]
                                                    const isRecommendation = f.quantization.includes('Q4_K_M') || f.quantization.includes('Q5_K_M')

                                                    return (
                                                        <div key={f.path} className={cn("p-5 rounded-2xl border transition-all duration-300 group", isRecommendation ? "border-primary/40 bg-primary/10 shadow-lg shadow-primary/5" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-muted/40")}>
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <BadgeQ quantization={f.quantization} />
                                                                    {isRecommendation && <span className="text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-black tracking-widest uppercase">{t('modelExplorer.bestChoice')}</span>}
                                                                </div>
                                                                <span className="text-xs text-foreground font-black font-mono">{formatSize(f.size)}</span>
                                                            </div>

                                                            <div className="text-[10px] text-muted-foreground/50 mb-4 truncate font-mono">{f.path}</div>

                                                            {progress ? (
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                                                        <span>{t('modelExplorer.downloading')}</span>
                                                                        <span>{Math.round((progress.received / progress.total) * 100)}%</span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-primary transition-all duration-500 shadow-[0_0_15px_hsl(var(--primary)/0.5)]" style={{ width: `${(progress.received / progress.total) * 100}%` }} />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleDownloadHF(f)}
                                                                    className="w-full py-3 bg-foreground text-background text-[11px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg group-hover:shadow-primary/20"
                                                                >
                                                                    <Download className="w-4 h-4" /> {t('modelExplorer.downloadPackage')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                                {files.length === 0 && <div className="text-center text-xs text-muted-foreground/50 py-12 border-2 border-dashed border-border/20 rounded-2xl">{t('modelExplorer.noCompatible')}</div>}
                                            </div>
                                        )
                                    ) : (
                                        /* Ollama Tag Selection */
                                        <div className="space-y-3">
                                            {(selectedModel as OllamaLibraryModel).tags.map(tag => {
                                                const fullModelName = `${(selectedModel as OllamaLibraryModel).name}:${tag}`
                                                const isPulling = pullingOllama === fullModelName

                                                return (
                                                    <div key={tag} className="p-5 rounded-2xl border border-border/50 bg-muted/20 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all group">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-black uppercase tracking-widest font-mono">{tag}</span>
                                                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-50">{t('modelExplorer.localPull')}</span>
                                                            </div>
                                                            <Database className="w-4 h-4 text-orange-500/50" />
                                                        </div>

                                                        <button
                                                            onClick={() => handlePullOllama((selectedModel as OllamaLibraryModel).name, tag)}
                                                            disabled={!!pullingOllama}
                                                            className={cn(
                                                                "w-full py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 disabled:opacity-50",
                                                                isPulling ? "bg-orange-500 text-white animate-pulse" : "bg-foreground text-background hover:scale-[1.02] group-hover:bg-orange-600 group-hover:text-white"
                                                            )}
                                                        >
                                                            {isPulling ? (
                                                                <><Loader2 className="w-4 h-4 animate-spin" /> {t('modelExplorer.pulling')}</>
                                                            ) : (
                                                                <><Download className="w-4 h-4" /> {t('modelExplorer.pullVersion')}</>
                                                            )}
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Pagination Footer (if strictly needed, though header handles it) */}
        </div>
    )
}

function BadgeQ({ quantization }: { quantization: string }) {
    let color = "bg-muted text-muted-foreground"
    if (quantization.includes("Q4")) color = "bg-emerald-500/10 text-emerald-500"
    if (quantization.includes("Q5")) color = "bg-blue-500/10 text-blue-500"
    if (quantization.includes("Q6") || quantization.includes("Q8")) color = "bg-purple-500/10 text-purple-500"
    if (quantization.includes("Q2") || quantization.includes("Q3")) color = "bg-red-500/10 text-red-500"

    return (
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", color)}>
            {quantization}
        </span>
    )
}
