import React, { useState, useEffect } from 'react'
import { Search, Loader2, Info } from 'lucide-react'
import { useTranslation, Language } from '@/i18n'
import { FileIcon } from '../../../lib/file-icons'
import { IpcRendererEvent } from 'electron'
import { IpcValue, JsonValue } from '@/types'

interface SemanticSearchPanelProps {
    projectId: string
    rootPath: string
    onOpenResult: (file: string, line: number) => void
    language: Language
}

interface IndexingProgress {
    projectId: string
    current: number
    total: number
    status: string
    [key: string]: JsonValue | undefined
}

interface IndexedSymbolResult {
    name?: string
    path?: string
    file?: string
    line?: number
    text?: string
}

interface SearchResult {
    file_path: string
    name: string
    kind: string
    line: number
    signature: string
    docstring: string
    score: number
}

export const SemanticSearchPanel: React.FC<SemanticSearchPanelProps> = ({ projectId, rootPath, onOpenResult, language }) => {
    const { t } = useTranslation(language)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [searching, setSearching] = useState(false)
    const [progress, setProgress] = useState<IndexingProgress | null>(null)

    const isIndexingProgress = (value: IpcValue): value is IndexingProgress => {
        return !!value && typeof value === 'object'
            && 'projectId' in value && 'current' in value && 'total' in value && 'status' in value
    }

    const normalizeResult = (res: IndexedSymbolResult): SearchResult => {
        const filePath = res.path || res.file || ''
        const name = res.name || res.text || filePath.split(/[/\\]/).pop() || 'Symbol'
        return {
            file_path: filePath,
            name,
            kind: 'symbol',
            line: typeof res.line === 'number' ? res.line : 0,
            signature: res.text || name,
            docstring: '',
            score: 0
        }
    }

    useEffect(() => {
        const removeListener = window.electron.on('code:indexing-progress', (_event: IpcRendererEvent, data: IpcValue) => {
            if (isIndexingProgress(data) && data.projectId === projectId) {
                setProgress(data)
                if (data.status === 'Complete') {
                    setTimeout(() => setProgress(null), 3000)
                }
            }
        })
        return () => removeListener()
    }, [projectId])

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!query.trim()) return

        setSearching(true)
        try {
            const searchResults = await window.electron.code.queryIndexedSymbols(query)
            const normalized = (searchResults || []).map((res) => normalizeResult(res))
            setResults(normalized)
        } catch (error) {
            console.error('Semantic search failed:', error)
        } finally {
            setSearching(false)
        }
    }

    /* const getKindIcon = (_kind: string) => {
        return <FileCode className="w-3.5 h-3.5 opacity-70" />
    } */

    return (
        <div className="flex flex-col h-full bg-transparent text-foreground overflow-hidden">
            {/* Header */}
            <div className="p-4 pb-2 flex items-center justify-between border-b border-white/5">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">
                    {t('semanticSearch.title')}
                </span>
                <Info className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-primary transition-colors cursor-help" />
            </div>

            {/* Progress Toast */}
            {progress && (
                <div className="px-4 py-3 bg-primary/5 border-b border-primary/10 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {progress.status === 'Complete' ? t('common.success') : t('semanticSearch.indexing')}
                        </span>
                        <span className="text-[10px] tabular-nums font-medium opacity-50">
                            {progress.current}/{progress.total}
                        </span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground/60 truncate">
                        {progress.status}
                    </div>
                </div>
            )}

            {/* Search Input */}
            <div className="p-4">
                <form onSubmit={handleSearch} className="relative group">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('semanticSearch.placeholder')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all placeholder:text-muted-foreground/40"
                    />
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                    {searching && (
                        <Loader2 className="absolute right-3.5 top-3 w-4 h-4 text-primary animate-spin" />
                    )}
                </form>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin scrollbar-thumb-white/5">
                {results.length > 0 ? (
                    <div className="px-2 pb-2">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                                {t('semanticSearch.results')}
                            </span>
                            <div className="flex-1 h-px bg-white/5" />
                        </div>
                        <div className="space-y-1.5">
                            {results.map((res, i) => (
                                <div
                                    key={`${res.file_path}-${res.line}-${i}`}
                                    onClick={() => onOpenResult(res.file_path, res.line)}
                                    className="group flex flex-col p-2.5 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileIcon fileName={res.file_path.split(/[/\\]/).pop() || ''} className="w-3.5 h-3.5 shrink-0" />
                                            <span className="text-xs font-semibold text-foreground/90 truncate group-hover:text-primary transition-colors">
                                                {res.name}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground/60 font-medium capitalize">
                                                {res.kind}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500/50"
                                                    style={{ width: `${Math.min(100, (1 - res.score) * 200)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-muted-foreground/50 truncate font-mono">
                                        {res.file_path.replace(rootPath, '').replace(/^[/\\]/, '')}:{res.line}
                                    </div>

                                    {res.docstring && (
                                        <p className="mt-1.5 text-[11px] text-muted-foreground/70 line-clamp-2 italic leading-relaxed">
                                            "{res.docstring}"
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    !searching && query && (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                <Search className="w-6 h-6 text-muted-foreground/20" />
                            </div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-1">{t('semanticSearch.noResults')}</h3>
                            <p className="text-xs text-muted-foreground/40 leading-relaxed">
                                Try rephrasing your question or indexing the project again.
                            </p>
                        </div>
                    )
                )}
            </div>

            {/* Footer / Stats */}
            {!searching && results.length > 0 && (
                <div className="p-3 border-t border-white/5 bg-black/20 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/40">
                        {results.length} results matching "{query.length > 15 ? query.substring(0, 15) + '...' : query}"
                    </span>
                </div>
            )}
        </div>
    )
}
