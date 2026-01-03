import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X, Save, Settings, Server, RefreshCw, Globe, Trash2, Box, Sparkles, Zap, BrainCircuit } from 'lucide-react'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    installedModels: any[]
    onRefreshModels: () => void
}

interface AppSettings {
    ollama: {
        url: string
    }
    general: {
        language: string
        theme: string
        resolution: string
        fontSize: number
    }
    github?: {
        username: string
        token: string
    }
    openai?: {
        apiKey: string
        model: string
    }
    anthropic?: {
        apiKey: string
        model: string
    }
    gemini?: {
        apiKey: string
        model: string
    }
    groq?: {
        apiKey: string
        model: string
    }
    proxy?: {
        enabled: boolean
        url: string
        key: string
    }
}

interface LibraryModel {
    name: string
    description: string
    tags: string[]
}

export function SettingsModal({ isOpen, onClose, installedModels, onRefreshModels }: SettingsModalProps) {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [activeTab, setActiveTab] = useState<'general' | 'ollama' | 'models' | 'github' | 'openai' | 'anthropic' | 'gemini' | 'groq'>('models')
    const [isLoading, setIsLoading] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')

    // Model Manager State
    const [libraryModels, setLibraryModels] = useState<LibraryModel[]>([])
    const [modelTab, setModelTab] = useState<'installed' | 'library'>('installed')
    const [pulling, setPulling] = useState<string | null>(null)
    const [pullProgress, setPullProgress] = useState<{ status: string, completed?: number, total?: number } | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)

    // Load settings on open
    useEffect(() => {
        if (isOpen) {
            loadSettings()
            loadLibraryModels()
        }
    }, [isOpen])

    useEffect(() => {
        window.electron.onPullProgress((progress: any) => {
            setPullProgress(progress)
        })
        return () => window.electron.removePullProgressListener()
    }, [])

    const loadSettings = async () => {
        try {
            const data = await window.electron.getSettings()
            setSettings(data)
        } catch (error) {
            console.error('Failed to load settings:', error)
        }
    }

    const loadLibraryModels = async () => {
        try {
            const models = await window.electron.getLibraryModels()
            setLibraryModels(models)
        } catch (e) { console.error(e) }
    }

    const handleSave = async (newSettings?: AppSettings) => {
        const settingsToSave = newSettings || settings
        if (!settingsToSave) return
        setIsLoading(true)
        setStatusMessage('')
        try {
            const saved = await window.electron.saveSettings(settingsToSave)
            setSettings(saved) // Update local state with saved settings
            onRefreshModels() // Re-init connection if URL changed
            setStatusMessage('Ayarlar kaydedildi!')
            setTimeout(() => setStatusMessage(''), 3000)
        } catch (error) {
            setStatusMessage('Kaydetme başarısız!')
        } finally {
            setIsLoading(false)
        }
    }

    const handlePullModel = async (modelName: string) => {
        setPulling(modelName)
        setPullProgress({ status: 'starting' })
        const result = await window.electron.pullModel(modelName)
        setPulling(null)
        setPullProgress(null)
        if (result.success) {
            onRefreshModels()
            setModelTab('installed') // Switch to installed to show it
        } else {
            alert(`İndirme hatası: ${result.error}`)
        }
    }

    const handleDeleteModel = async (modelName: string) => {
        if (!confirm(`${modelName} silinsin mi?`)) return
        setDeleting(modelName)
        await window.electron.deleteOllamaModel(modelName)
        setDeleting(null)
        onRefreshModels()
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[900px] h-[650px] bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-white/5">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-purple-400" />
                        <h2 className="text-lg font-medium text-white">Ayarlar & Yönetim</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-56 border-r border-white/10 bg-black/20 p-4 flex flex-col gap-1 overflow-y-auto">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-3">Sistem</div>
                        <button onClick={() => setActiveTab('models')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'models' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <Box className="w-4 h-4" /> Modeller
                        </button>
                        <button onClick={() => setActiveTab('ollama')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'ollama' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <Server className="w-4 h-4" /> Ollama
                        </button>
                        <button onClick={() => setActiveTab('general')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'general' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <Globe className="w-4 h-4" /> Genel
                        </button>

                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-3 mt-4">Bulut AI</div>
                        <button onClick={() => setActiveTab('github')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'github' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <RefreshCw className="w-4 h-4" /> GitHub Copilot
                        </button>
                        <button onClick={() => setActiveTab('openai')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'openai' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <Sparkles className="w-4 h-4" /> OpenAI
                        </button>
                        <button onClick={() => setActiveTab('anthropic')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'anthropic' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <BrainCircuit className="w-4 h-4" /> Anthropic
                        </button>
                        <button onClick={() => setActiveTab('gemini')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'gemini' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <Sparkles className="w-4 h-4" /> Google Gemini
                        </button>
                        <button onClick={() => setActiveTab('groq')} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left", activeTab === 'groq' ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
                            <Zap className="w-4 h-4" /> Groq
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 p-0 overflow-hidden flex flex-col bg-zinc-900/50">
                        {settings ? (
                            <>
                                {/* MODELLER TAB */}
                                {activeTab === 'models' && (
                                    <div className="flex flex-col h-full">
                                        <div className="p-4 border-b border-white/10 flex gap-4 bg-white/[0.02]">
                                            <button onClick={() => setModelTab('installed')} className={cn("text-sm font-medium pb-1 border-b-2 transition-colors", modelTab === 'installed' ? "border-purple-500 text-purple-300" : "border-transparent text-zinc-400 hover:text-white")}>
                                                Yüklü Modeller ({installedModels.length})
                                            </button>
                                            <button onClick={() => setModelTab('library')} className={cn("text-sm font-medium pb-1 border-b-2 transition-colors", modelTab === 'library' ? "border-purple-500 text-purple-300" : "border-transparent text-zinc-400 hover:text-white")}>
                                                Kütüphane
                                            </button>
                                            <div className="flex-1" />
                                            <button onClick={onRefreshModels} className="p-1.5 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white" title="Yenile">
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6">
                                            {modelTab === 'installed' ? (
                                                <div className="space-y-3">
                                                    {installedModels.length === 0 && (
                                                        <div className="text-center text-zinc-500 py-10">Henüz yüklü model yok. Kütüphaneden indirin.</div>
                                                    )}
                                                    {installedModels.map((model: any) => (
                                                        <div key={model.digest} className="bg-black/20 border border-white/5 rounded-lg p-4 flex items-center justify-between hover:border-white/10 transition-colors">
                                                            <div>
                                                                <div className="font-medium text-white flex items-center gap-2">
                                                                    {model.name}
                                                                    <span className="text-sm bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">
                                                                        {model.details?.parameter_size || '?'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-zinc-500 mt-1 flex gap-3">
                                                                    <span>{formatBytes(model.size)}</span>
                                                                    <span>{model.details?.quantization_level}</span>
                                                                    <span>Modified: {new Date(model.modified_at).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteModel(model.name)}
                                                                disabled={deleting === model.name}
                                                                className="p-2 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-colors"
                                                                title="Sil"
                                                            >
                                                                {deleting === model.name ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {libraryModels.map((libModel) => (
                                                        <div key={libModel.name} className="bg-black/20 border border-white/5 rounded-lg p-4">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <h3 className="font-medium text-purple-200">{libModel.name}</h3>
                                                                    <p className="text-xs text-zinc-400 mt-1">{libModel.description}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 mt-3">
                                                                {libModel.tags.map(tag => {
                                                                    const fullName = `${libModel.name}:${tag}`
                                                                    const isInstalled = installedModels.some(m => m.name === fullName)
                                                                    const isPulling = pulling === fullName

                                                                    return (
                                                                        <button
                                                                            key={tag}
                                                                            onClick={() => !isInstalled && !isPulling && handlePullModel(fullName)}
                                                                            disabled={isInstalled || isPulling}
                                                                            className={cn(
                                                                                "text-xs px-2.5 py-1.5 rounded-md border transition-all flex items-center gap-2",
                                                                                isInstalled
                                                                                    ? "bg-green-500/10 border-green-500/20 text-green-400 cursor-default"
                                                                                    : isPulling
                                                                                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                                                                        : "bg-zinc-800/50 border-white/5 text-zinc-300 hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-300"
                                                                            )}
                                                                        >
                                                                            {tag}
                                                                            {isInstalled && "✓"}
                                                                            {isPulling && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                            {pulling?.startsWith(libModel.name + ':') && pullProgress && (
                                                                <div className="mt-3 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-blue-500 transition-all duration-300"
                                                                        style={{ width: `${Math.round((pullProgress.completed || 0) / (pullProgress.total || 1) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'ollama' && (
                                    <div className="space-y-6 p-6 overflow-y-auto">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">Ollama Bağlantısı</h3>
                                            <p className="text-xs text-zinc-500 mb-4">Yerel model sunucusunun adresi.</p>
                                            <div className="space-y-2">
                                                <label className="text-xs text-zinc-400">Sunucu URL</label>
                                                <input
                                                    type="text"
                                                    value={settings.ollama.url}
                                                    onChange={(e) => setSettings({ ...settings, ollama: { ...settings.ollama, url: e.target.value } })}
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                                                    placeholder="http://127.0.0.1:11434"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'general' && (
                                    <div className="space-y-6 p-6 overflow-y-auto">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">Görünüm ve Dil</h3>
                                            <p className="text-xs text-zinc-500 mb-4">Uygulama tercihleri.</p>
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs text-zinc-400">Dil</label>
                                                        <select
                                                            value={settings.general.language}
                                                            onChange={(e) => setSettings({ ...settings, general: { ...settings.general, language: e.target.value } })}
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 bg-zinc-900 cursor-pointer"
                                                        >
                                                            <option value="tr">Türkçe</option>
                                                            <option value="en">English</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs text-zinc-400">Tema</label>
                                                        <select
                                                            value={settings.general.theme}
                                                            onChange={(e) => setSettings({ ...settings, general: { ...settings.general, theme: e.target.value } })}
                                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 bg-zinc-900 cursor-pointer"
                                                        >
                                                            <option value="dark">Koyu (Dark)</option>
                                                            <option value="light">Açık (Light) - Yakında</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs text-zinc-400">Çözünürlük</label>
                                                    <select
                                                        value={settings.general.resolution}
                                                        onChange={async (e) => {
                                                            const updated = { ...settings, general: { ...settings.general, resolution: e.target.value } }
                                                            setSettings(updated)
                                                            await handleSave(updated)
                                                        }}
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 bg-zinc-900 cursor-pointer"
                                                    >
                                                        <option value="1200x800">1200x800 (Varsayılan)</option>
                                                        <option value="1280x720">1280x720 (HD)</option>
                                                        <option value="1440x900">1440x900</option>
                                                        <option value="1600x900">1600x900</option>
                                                        <option value="1920x1080">1920x1080 (Full HD)</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs text-zinc-400">Yazı Boyutu</label>
                                                    <div className="flex items-center gap-4 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                                                        <input
                                                            type="range"
                                                            min="12"
                                                            max="20"
                                                            step="1"
                                                            value={settings.general.fontSize || 14}
                                                            onChange={(e) => {
                                                                const fontSize = parseInt(e.target.value)
                                                                setSettings({ ...settings, general: { ...settings.general, fontSize } })
                                                            }}
                                                            onMouseUp={() => handleSave()}
                                                            className="flex-1 accent-purple-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                        <span className="text-sm font-mono text-zinc-300 w-8 text-center">{settings.general.fontSize || 14}px</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* --- CLOUD PROVIDERS --- */}

                                {activeTab === 'github' && (
                                    <div className="space-y-6 p-6 overflow-y-auto">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">GitHub Copilot</h3>
                                            <p className="text-xs text-zinc-500 mb-6">GPT-4, Claude 3.5 Sonnet ve diğer modellere erişim sağlar.</p>

                                            {settings.github?.token ? (
                                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                                            <RefreshCw className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-green-400">Bağlandı</div>
                                                            <div className="text-xs text-zinc-400">Kullanıcı: {settings.github.username || 'GitHub User'}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            const updated = { ...settings, github: { username: '', token: '' } }
                                                            setSettings(updated)
                                                            await handleSave(updated)
                                                        }}
                                                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 rounded border border-white/10 transition-colors"
                                                    >
                                                        Çıkış Yap
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {!pullProgress ? (
                                                        <button
                                                            onClick={async () => {
                                                                setPullProgress({ status: 'auth-request' })
                                                                try {
                                                                    const data = await window.electron.githubLogin()
                                                                    setPullProgress({ status: 'auth-polling', completed: 0, total: data.interval })
                                                                    setStatusMessage(`KOD: ${data.user_code} - Tarayıcınız açılıyor...`)
                                                                    const pollResult = await window.electron.pollToken(data.device_code, data.interval)
                                                                    if (pollResult.success && pollResult.token) {
                                                                        const updated = { ...settings, github: { username: 'GitHub User', token: pollResult.token } }
                                                                        setSettings(updated)
                                                                        await handleSave(updated)
                                                                        setStatusMessage('Giriş Başarılı!')
                                                                    } else {
                                                                        setStatusMessage('Giriş başarısız.')
                                                                    }
                                                                } catch (error) {
                                                                    console.error(error)
                                                                    setStatusMessage('Hata oluştu.')
                                                                } finally {
                                                                    setPullProgress(null)
                                                                }
                                                            }}
                                                            disabled={!!pullProgress}
                                                            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-all"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                            GitHub ile Giriş Yap
                                                        </button>
                                                    ) : (
                                                        <div className="bg-zinc-800 border border-white/10 rounded-lg p-4 text-center animate-pulse">
                                                            <div className="text-sm text-zinc-300 mb-1">Giriş Bekleniyor...</div>
                                                            <div className="text-xs text-zinc-500">{statusMessage}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'openai' && (
                                    <div className="space-y-6 p-6 overflow-y-auto">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">OpenAI Ayarları</h3>
                                            <p className="text-xs text-zinc-500 mb-4">Standard OpenAI API anahtarı.</p>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs text-zinc-400">API Key</label>
                                                    <input
                                                        type="password"
                                                        value={settings.openai?.apiKey || ''}
                                                        onChange={(e) => setSettings({ ...settings, openai: { ...settings.openai!, apiKey: e.target.value } })}
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs text-zinc-400">Model</label>
                                                    <input
                                                        type="text"
                                                        value={settings.openai?.model || 'gpt-4o'}
                                                        onChange={(e) => setSettings({ ...settings, openai: { ...settings.openai!, model: e.target.value } })}
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'anthropic' && (
                                    <div className="space-y-6 p-6 overflow-y-auto">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">Anthropic (Claude)</h3>
                                            <p className="text-xs text-zinc-500 mb-4">Claude modelleri için API anahtarı.</p>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs text-zinc-400">API Key</label>
                                                    <input
                                                        type="password"
                                                        value={settings.anthropic?.apiKey || ''}
                                                        onChange={(e) => setSettings({ ...settings, anthropic: { ...settings.anthropic || { apiKey: '', model: '' }, apiKey: e.target.value, model: settings.anthropic?.model || 'claude-3-5-sonnet-20240620' } })}
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'gemini' && (
                                    <div className="space-y-6 p-6 overflow-y-auto">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">Google Gemini</h3>
                                            <p className="text-xs text-zinc-500 mb-4">Gemini modelleri için API anahtarı.</p>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs text-zinc-400">API Key</label>
                                                    <input
                                                        type="password"
                                                        value={settings.gemini?.apiKey || ''}
                                                        onChange={(e) => setSettings({ ...settings, gemini: { ...settings.gemini || { apiKey: '', model: '' }, apiKey: e.target.value, model: settings.gemini?.model || 'gemini-1.5-pro' } })}
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'groq' && (
                                    <div className="space-y-6 p-6 overflow-y-auto">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">Groq</h3>
                                            <p className="text-xs text-zinc-500 mb-4">Hızlı inference için Groq API anahtarı.</p>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs text-zinc-400">API Key</label>
                                                    <input
                                                        type="password"
                                                        value={settings.groq?.apiKey || ''}
                                                        onChange={(e) => setSettings({ ...settings, groq: { ...settings.groq || { apiKey: '', model: '' }, apiKey: e.target.value, model: settings.groq?.model || 'llama3-70b-8192' } })}
                                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="h-16 border-t border-white/10 bg-black/20 flex items-center justify-between px-6 shrink-0">
                    <span className={cn("text-xs transition-opacity duration-300", statusMessage ? "opacity-100 text-emerald-400" : "opacity-0")}>
                        {statusMessage}
                    </span>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">İptal</button>
                        <button onClick={() => handleSave()} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20">
                            <Save className="w-4 h-4" />
                            {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
