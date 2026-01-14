import { memo, useState, useMemo } from 'react'
import { useTranslation } from '@/i18n'
import { useSettingsLogic } from './hooks/useSettingsLogic'
import { cn } from '@/lib/utils'
import { GalleryView } from '@/features/chat/components/GalleryView'
import { Search, X } from 'lucide-react'

// Tab Components
import { GeneralTab, AccountsTab, AppearanceTab, ModelsTab, StatisticsTab, PersonasTab, SpeechTab, DeveloperTab, AdvancedTab, AboutTab, ModelUsageLimitsTab, MCPSettingsTab } from '@/features/settings/components'
import './SettingsPage.css'

import type { ModelInfo } from '@/features/models/utils/model-fetcher'
import { GroupedModels } from '@/features/models/utils/model-fetcher'
import { SettingsCategory } from './types'

export interface SettingsPageProps {
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: () => void
    activeTab?: SettingsCategory
    groupedModels?: GroupedModels | null
}

export function SettingsPage({
    installedModels,
    proxyModels,
    onRefreshModels,
    activeTab = 'general',
    groupedModels
}: SettingsPageProps) {
    const {
        settings, updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        isLoading, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        setSettings
    } = useSettingsLogic(onRefreshModels)

    const { t } = useTranslation(settings?.general?.language || 'tr')

    // Search state for settings
    const [searchQuery, setSearchQuery] = useState('')

    // Define tabs for filtering
    const allTabs = useMemo(() => [
        { id: 'general', label: t('settings.tabs.general') },
        { id: 'accounts', label: t('settings.tabs.accounts') },
        { id: 'appearance', label: t('settings.tabs.appearance') },
        { id: 'models', label: t('settings.tabs.models') },
        { id: 'statistics', label: t('settings.tabs.statistics') },
        { id: 'personas', label: t('settings.tabs.personas') },
        { id: 'speech', label: t('settings.tabs.speech') },
        { id: 'developer', label: t('settings.tabs.developer') },
        { id: 'advanced', label: t('settings.tabs.advanced') },
        { id: 'about', label: t('settings.tabs.about') }
    ], [t])

    const filteredTabs = useMemo(() => {
        if (!searchQuery) return allTabs
        return allTabs.filter(tab =>
            tab.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [searchQuery, allTabs])

    const handleFactoryReset = async () => {
        if (confirm(t('settings.factoryResetConfirm'))) {
            await window.electron.saveSettings({
                ollama: { url: 'http://localhost:11434' },
                general: { language: 'tr', theme: 'dark', resolution: '1920x1080', fontSize: 14 },
                proxy: { enabled: true, url: 'http://127.0.0.1:8317', key: '' }
            })
            window.location.reload()
        }
    }

    const loadSettings = async () => {
        const data = await window.electron.getSettings()
        setSettings(data)
    }

    const sharedProps = {
        settings, setSettings, isLoading, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        t, onRefreshModels, loadSettings, setIsLoading: (_v: boolean) => { }, onReset: handleFactoryReset
    }

    return (
        <div className="settings-container">
            <div className="settings-content flex h-full gap-6">
                <main className="settings-main flex-1 overflow-y-auto">
                    {/* Search Bar */}
                    <div className="mb-6 sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder={t('settings.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                                aria-label={t('settings.searchPlaceholder')}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-md transition-colors"
                                    aria-label={t('common.clear')}
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            )}
                        </div>
                        {searchQuery && (
                            <div className="mt-3 text-xs text-muted-foreground">
                                {filteredTabs.length > 0 ? (
                                    <span>{t('settings.searchResults', { count: filteredTabs.length })}</span>
                                ) : (
                                    <span>{t('settings.noResults')}</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={cn("settings-section h-full pr-4", (activeTab === 'models' || activeTab === 'gallery') && "max-w-none")}>
                        {statusMessage && (
                            <div className="mb-6 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {statusMessage}
                            </div>
                        )}

                        {activeTab === 'general' && <GeneralTab {...sharedProps} />}
                        {activeTab === 'accounts' && <AccountsTab {...sharedProps} />}
                        {activeTab === 'appearance' && <AppearanceTab {...sharedProps} />}
                        {activeTab === 'models' && <ModelsTab {...sharedProps} installedModels={installedModels} proxyModels={proxyModels} onRefreshModels={onRefreshModels} />}
                        {activeTab === 'statistics' && <StatisticsTab {...sharedProps} />}
                        {activeTab === 'personas' && <PersonasTab {...sharedProps} />}
                        {activeTab === 'speech' && <SpeechTab {...sharedProps} />}
                        {activeTab === 'developer' && <DeveloperTab {...sharedProps} />}
                        {activeTab === 'advanced' && <AdvancedTab {...sharedProps} installedModels={installedModels} proxyModels={proxyModels} />}
                        {activeTab === 'about' && <AboutTab {...sharedProps} onReset={handleFactoryReset} />}
                        {activeTab === 'usage-limits' && <ModelUsageLimitsTab {...sharedProps} groupedModels={groupedModels || undefined} />}
                        {activeTab === 'mcp-servers' && <MCPSettingsTab />}
                        {activeTab === 'gallery' && <div className="h-[75vh] min-h-[500px] border border-white/5 rounded-2xl overflow-hidden bg-black/20"><GalleryView language={settings?.general?.language || 'tr'} /></div>}
                    </div>
                </main>
            </div>
        </div>
    )
}

export const MemoizedSettingsPage = memo(SettingsPage)

export default MemoizedSettingsPage
