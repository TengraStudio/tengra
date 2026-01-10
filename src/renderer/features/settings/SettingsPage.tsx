import { memo } from 'react'
import { useTranslation } from '@/i18n'
import { useSettingsLogic } from './hooks/useSettingsLogic'
import { cn } from '@/lib/utils'
import { GalleryView } from '@/features/chat/components/GalleryView'
// unused imports removed

// Tab Components
import { GeneralTab, AccountsTab, AppearanceTab, ModelsTab, StatisticsTab, PersonasTab, SpeechTab, DeveloperTab, AdvancedTab, AboutTab } from '@/features/settings/components'
import './SettingsPage.css'

import type { ModelInfo } from '@/features/models/utils/model-fetcher'
import { SettingsCategory } from './types'

export interface SettingsPageProps {
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: () => void
    activeTab?: SettingsCategory
}

export function SettingsPage({
    installedModels,
    proxyModels,
    onRefreshModels,
    activeTab = 'general'
}: SettingsPageProps) {
    const {
        settings, updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        isLoading, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        setSettings
    } = useSettingsLogic(onRefreshModels)

    const { t } = useTranslation(settings?.general?.language || 'tr')

    // tabs removed because unused

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
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        t, onRefreshModels, loadSettings, setIsLoading: (_v: boolean) => { }, onReset: handleFactoryReset
    }

    return (
        <div className="settings-container">
            <div className="settings-content flex h-full gap-6">
                <main className="settings-main flex-1 overflow-y-auto">
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
                        {activeTab === 'gallery' && <div className="h-[75vh] min-h-[500px] border border-white/5 rounded-2xl overflow-hidden bg-black/20"><GalleryView language={settings?.general?.language || 'tr'} /></div>}
                    </div>
                </main>
            </div>
        </div>
    )
}

export const MemoizedSettingsPage = memo(SettingsPage)

export default MemoizedSettingsPage
