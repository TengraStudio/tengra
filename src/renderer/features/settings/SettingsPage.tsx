import { useTranslation } from '@/i18n'
import { useSettingsLogic } from './hooks/useSettingsLogic'
import { ProjectDashboard } from '@/features/projects/components/ProjectDashboard'
import { GalleryView } from '@/features/chat/components/GalleryView'
import { cn } from '@/lib/utils'
import {
    Settings, Palette, Cpu, UserCircle, BarChart3,
    Volume2, ShieldCheck, Zap, Info, Layout
} from 'lucide-react'

// Tab Components
import { GeneralTab, AccountsTab, AppearanceTab, ModelsTab, StatisticsTab, PersonasTab, SpeechTab, DeveloperTab, AdvancedTab, AboutTab } from '@/features/settings/components'
import './SettingsPage.css'

interface SettingsPageProps {
    installedModels: any[]
    proxyModels?: any[]
    onRefreshModels: () => void
    activeTab?: string
    onTabChange: (tabId: string) => void
}

export function SettingsPage({
    installedModels,
    proxyModels,
    onRefreshModels,
    activeTab = 'general',
    onTabChange
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

    const { t } = useTranslation(settings?.general?.language as any || 'tr')

    const tabs = [
        { id: 'general', label: t('settings.general'), icon: Settings },
        { id: 'appearance', label: t('settings.appearance'), icon: Palette },
        { id: 'models', label: t('settings.models'), icon: Cpu },
        { id: 'accounts', label: t('settings.accounts'), icon: UserCircle },
        { id: 'personas', label: t('settings.personas'), icon: Layout },
        { id: 'statistics', label: t('settings.statistics'), icon: BarChart3 },
        { id: 'speech', label: 'Ses & Konuşma', icon: Volume2 },
        { id: 'developer', label: 'Geliştirici Araçları', icon: ShieldCheck },
        { id: 'advanced', label: 'Gelişmiş Yapılandırma', icon: Zap },
        { id: 'about', label: 'Hakkında', icon: Info },
    ]

    const handleFactoryReset = async () => {
        if (confirm('Tüm ayarlar fabrika ayarlarına sıfırlanacak. Devam etmek istiyor musunuz?')) {
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
            <div className="settings-header">
                <h1 className="text-2xl font-black tracking-tighter uppercase text-white">{t('settings.title')}</h1>
                <p className="text-sm text-zinc-500 mt-1">{t('settings.subtitle')}</p>
            </div>

            <div className="settings-content">
                <aside className="settings-sidebar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "settings-tab-btn",
                                activeTab === tab.id ? "settings-tab-btn-active" : "settings-tab-btn-inactive"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </aside>

                <main className="settings-main">
                    <div className="settings-section">
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
                        {activeTab === 'about' && <AboutTab onReset={handleFactoryReset} />}
                        {activeTab === 'gallery' && <div className="h-[75vh] min-h-[500px] border border-white/5 rounded-2xl overflow-hidden bg-black/20"><GalleryView /></div>}
                        {activeTab === 'project' && <ProjectDashboard />}
                    </div>
                </main>
            </div>
        </div>
    )
}

export default SettingsPage
