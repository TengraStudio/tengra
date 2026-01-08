import React, { useEffect, useState, useCallback } from 'react'
// import { aiGutter } from '@/lib/cm-suggestions'
import { useTranslation, Language } from '@/i18n'
import {
    // Code
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Project, TerminalTab, CouncilAgent, ActivityEntry, WorkspaceEntry, WorkspaceMount } from '@/types'
import { WorkspaceExplorer } from './WorkspaceExplorer'
import { SemanticSearchPanel } from './SemanticSearchPanel'
import { TerminalPanel } from '@/features/terminal/TerminalPanel'
import { OnboardingTour } from '@/features/onboarding/OnboardingTour'
import { useWorkspaceManager } from '../hooks/useWorkspaceManager'
// import { EditorView } from '@codemirror/view'

// Sub-components
import { WorkspaceToolbar } from './workspace/WorkspaceToolbar'
import { EditorTabs } from './workspace/EditorTabs'
import { WorkspaceEditor } from './workspace/WorkspaceEditor'
import { AIAssistantSidebar } from './workspace/AIAssistantSidebar'
import { ProjectDashboard } from './ProjectDashboard'

import { WorkspaceModals } from './workspace/WorkspaceModals'
import { ProjectSettingsView } from './settings/ProjectSettingsView'
import { LogoGeneratorModal } from './LogoGeneratorModal'

interface ProjectWorkspaceProps {
    project: Project
    onBack: () => void
    language: Language
    tabs: TerminalTab[]
    activeTabId: string | null
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
    selectedProvider: string
    selectedModel: string
    onSelectModel: (provider: string, model: string) => void
    groupedModels?: any
    quotas?: any
    codexUsage?: any
    settings?: any
    sendMessage?: (content?: string) => void
    messages?: any[]
    isLoading?: boolean
}

interface Notice {
    type: 'success' | 'error' | 'info'
    message: string
}

interface EntryModalState {
    type: 'createFile' | 'createFolder' | 'rename' | 'delete' | 'search'
    entry?: WorkspaceEntry
}

const defaultMountForm = () => ({
    type: 'local' as 'local' | 'ssh',
    name: '',
    rootPath: '',
    host: '',
    port: '22',
    username: '',
    authType: 'password' as 'password' | 'key',
    password: '',
    privateKey: '',
    passphrase: ''
})

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
    project, onBack, language, tabs, activeTabId: activeTerminalTabId, setTabs, setActiveTabId: setActiveTerminalTabId,
    selectedProvider, selectedModel, onSelectModel, groupedModels, quotas, codexUsage, settings,
    sendMessage, messages, isLoading
}) => {
    const { t } = useTranslation(language)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
    const [agents] = useState<CouncilAgent[]>([
        { id: 'planner', name: t('agents.planner'), role: t('agents.plannerRole'), kind: 'cloud', status: 'ready', enabled: true },
        { id: 'builder', name: t('agents.builder'), role: t('agents.builderRole'), kind: 'local', status: 'ready', enabled: true },
        { id: 'reviewer', name: t('agents.reviewer'), role: t('agents.reviewerRole'), kind: 'cloud', status: 'ready', enabled: true }
    ])

    const [showAgentPanel, setShowAgentPanel] = useState(true)
    const [showTerminal, setShowTerminal] = useState(false)
    const [terminalHeight, setTerminalHeight] = useState(250)
    const [agentChatMessage, setAgentChatMessage] = useState('')
    const [showMountModal, setShowMountModal] = useState(false)
    const [mountForm, setMountForm] = useState(defaultMountForm())
    const [entryModal, setEntryModal] = useState<EntryModalState | null>(null)
    const [entryName, setEntryName] = useState('')
    const [entryBusy, setEntryBusy] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<WorkspaceEntry | null>(null)
    const [sidebarMode, setSidebarMode] = useState<'files' | 'search'>('files')

    // Side Props
    const [viewTab] = useState<'editor' | 'council' | 'logs'>('editor')
    const [councilEnabled, setCouncilEnabled] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)

    const notify = useCallback((type: Notice['type'], message: string) => {
        setNotice({ type, message })
    }, [])

    const logActivity = useCallback((title: string, detail?: string) => {
        setActivityLog((prev) => {
            const next = [{
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                timestamp: new Date(),
                title,
                detail
            }, ...prev]
            return next.slice(0, 50)
        })
    }, [])

    const wm = useWorkspaceManager({ project, notify, logActivity })

    const handleCreateEntry = async () => {
        if (!entryModal || !entryName.trim()) return
        setEntryBusy(true)
        try {
            if (entryModal.type === 'createFile') {
                const parentPath = entryModal.entry?.path || ''
                const fullPath = parentPath ? `${parentPath}/${entryName}` : entryName
                await wm.createFile(fullPath)
                notify('success', t('notifications.fileCreated', { name: entryName }))
            } else if (entryModal.type === 'createFolder') {
                const parentPath = entryModal.entry?.path || ''
                const fullPath = parentPath ? `${parentPath}/${entryName}` : entryName
                await wm.createFolder(fullPath)
                notify('success', t('notifications.folderCreated', { name: entryName }))
            } else if (entryModal.type === 'rename' && entryModal.entry) {
                await wm.renameEntry(entryModal.entry, entryName)
                notify('success', t('notifications.renamed', { name: entryName }))
            }
            setEntryModal(null)
            setEntryName('')
        } catch (error: any) {
            notify('error', error.message || t('notifications.operationFailed'))
        } finally {
            setEntryBusy(false)
        }
    }

    const handleDeleteEntry = async () => {
        if (!entryModal?.entry) return
        setEntryBusy(true)
        try {
            await wm.deleteEntry(entryModal.entry)
            notify('success', t('notifications.deleted', { name: entryModal.entry.name }))
            setEntryModal(null)
        } catch (error: any) {
            notify('error', error.message || t('notifications.deletionFailed'))
        } finally {
            setEntryBusy(false)
        }
    }

    const handleSubmitEntryModal = () => {
        if (entryModal?.type === 'delete') {
            handleDeleteEntry()
        } else {
            handleCreateEntry()
        }
    }

    const handleSearch = () => {
        setEntryModal({ type: 'search' })
        setEntryName('')
    }

    const addMount = async () => {
        const defaultName = mountForm.type === 'ssh' ? `${mountForm.username}@${mountForm.host}` : (mountForm.rootPath.split(/[\\/]/).pop() || t('workspace.local'))
        const newMount: WorkspaceMount = {
            id: `mount-${Date.now()}`,
            name: mountForm.name || defaultName,
            type: mountForm.type,
            rootPath: mountForm.rootPath,
            ssh: mountForm.type === 'ssh' ? {
                host: mountForm.host,
                port: Number(mountForm.port),
                username: mountForm.username,
                authType: mountForm.authType,
                password: mountForm.password,
                privateKey: mountForm.privateKey,
                passphrase: mountForm.passphrase
            } : undefined
        }
        await wm.persistMounts([...wm.mounts, newMount])
        setShowMountModal(false)
        setMountForm(defaultMountForm())
    }

    // Handlers for settings
    const handleUpdateProject = async (updates: Partial<Project>) => {
        try {
            await window.electron.db.updateProject(project.id, updates)
            notify('success', t('notifications.projectUpdated'))
        } catch (error) {
            notify('error', t('notifications.updateFailed'))
        }
    }

    const handleApplyLogo = async (logoPath: string) => {
        await handleUpdateProject({ logo: logoPath })
        setIsGeneratorOpen(false)
    }

    const handleDeleteProject = async () => {
        try {
            await window.electron.db.deleteProject(project.id)
            notify('success', t('notifications.projectDeleted'))
            onBack()
        } catch (error) {
            notify('error', t('notifications.deleteFailed'))
        }
    }

    // Effects
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenProjectTour')
        if (!hasSeenTour) {
            const timer = setTimeout(() => {
                setShowOnboarding(true)
                localStorage.setItem('hasSeenProjectTour', 'true')
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [])

    useEffect(() => {
        if (!notice) return
        const timer = setTimeout(() => setNotice(null), 4000)
        return () => clearTimeout(timer)
    }, [notice])

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault()
                wm.saveActiveTab()
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [wm])

    useEffect(() => {
        const handleRefactorRequest = (e: any) => {
            const { line, content } = e.detail
            setShowAgentPanel(true)
            setAgentChatMessage(t('agents.refactorPrompt', { line, content }))
        }
        document.addEventListener('ai-refactor-request', handleRefactorRequest)
        return () => document.removeEventListener('ai-refactor-request', handleRefactorRequest)
    }, [t])

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-foreground overflow-hidden">
            <WorkspaceToolbar
                project={project}
                onBack={onBack}
                onUpdate={handleUpdateProject}
                handleRunProject={() => { }}
                showTerminal={showTerminal}
                toggleTerminal={() => setShowTerminal(!showTerminal)}
                handleSearch={handleSearch}
                showAgentPanel={showAgentPanel}
                toggleAgentPanel={() => setShowAgentPanel(!showAgentPanel)}
                toggleSettings={() => setShowSettings(!showSettings)}
                language={language}
            />

            <div className="flex-1 flex flex-row overflow-hidden relative h-full">
                {showSettings ? (
                    <div className="flex-1 overflow-hidden">
                        <ProjectSettingsView
                            project={project}
                            onUpdate={handleUpdateProject}
                            onDelete={handleDeleteProject}
                            language={language}
                        />
                    </div>
                ) : (
                    <>
                        {/* Left Panel: Explorer / Search */}
                        <div className="w-72 flex flex-col border-r border-white/5 bg-background/20 shrink-0">
                            {/* Panel Switcher */}
                            <div className="flex items-center px-4 pt-4 pb-0 gap-1">
                                <button
                                    onClick={() => setSidebarMode('files')}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-lg border-b-2",
                                        sidebarMode === 'files' ? "text-primary border-primary bg-primary/5" : "text-muted-foreground/40 border-transparent hover:text-muted-foreground"
                                    )}
                                >
                                    {t('workspace.files')}
                                </button>
                                <button
                                    onClick={() => setSidebarMode('search')}
                                    className={cn(
                                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-lg border-b-2",
                                        sidebarMode === 'search' ? "text-primary border-primary bg-primary/5" : "text-muted-foreground/40 border-transparent hover:text-muted-foreground"
                                    )}
                                >
                                    {t('semanticSearch.title')}
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                {sidebarMode === 'files' ? (
                                    <WorkspaceExplorer
                                        mounts={wm.mounts}
                                        mountStatus={wm.mountStatus}
                                        refreshSignal={wm.refreshSignal}
                                        onOpenFile={wm.openFile}
                                        onSelectEntry={setSelectedEntry}
                                        selectedEntry={selectedEntry}
                                        onAddMount={() => setShowMountModal(true)}
                                        onRemoveMount={(id) => wm.persistMounts(wm.mounts.filter(m => m.id !== id))}
                                        onEnsureMount={wm.ensureMountReady}
                                        onContextAction={(action) => {
                                            setEntryModal({ type: action.type, entry: action.entry })
                                            if (action.type !== 'delete') setEntryName(action.entry.name)
                                        }}
                                        variant="panel"
                                        language={language}
                                    />
                                ) : (
                                    <SemanticSearchPanel
                                        projectId={project.id}
                                        rootPath={project.path}
                                        onOpenResult={(file, line) => {
                                            // Find mount for this file
                                            const mount = wm.mounts.find(m => file.startsWith(m.rootPath))
                                            if (mount) {
                                                wm.openFile({
                                                    mountId: mount.id,
                                                    name: file.split(/[/\\]/).pop() || '',
                                                    path: file,
                                                    isDirectory: false,
                                                    initialLine: line
                                                })
                                            }
                                        }}
                                        language={language}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Center: Editor Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative">
                            {wm.openTabs.length > 0 && (
                                <EditorTabs
                                    openTabs={wm.openTabs}
                                    activeTabId={wm.activeTabId}
                                    setActiveTabId={wm.setActiveEditorTabId}
                                    closeTab={wm.closeTab}
                                />
                            )}

                            <div className="flex-1 relative overflow-hidden">
                                <WorkspaceEditor
                                    activeTab={wm.activeTab}
                                    updateTabContent={wm.updateTabContent}
                                    emptyState={
                                        <ProjectDashboard
                                            project={project}
                                            onUpdate={handleUpdateProject}
                                            onOpenLogoGenerator={() => setIsGeneratorOpen(true)}
                                            language={language}
                                        />
                                    }
                                />

                                <div
                                    className={cn(
                                        "absolute bottom-0 left-0 right-0 bg-background border-t border-white/10 z-30",
                                        !showTerminal && "hidden"
                                    )}
                                    style={{ height: terminalHeight }}
                                >
                                    <TerminalPanel
                                        isOpen={showTerminal}
                                        onToggle={() => setShowTerminal(!showTerminal)}
                                        height={terminalHeight}
                                        onHeightChange={setTerminalHeight}
                                        projectPath={project.path}
                                        tabs={tabs}
                                        activeTabId={activeTerminalTabId}
                                        setTabs={setTabs}
                                        setActiveTabId={setActiveTerminalTabId}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Panel: AI & Agents */}
                        {showAgentPanel && (
                            <AIAssistantSidebar
                                viewTab={viewTab}
                                councilEnabled={councilEnabled}
                                toggleCouncil={() => setCouncilEnabled(!councilEnabled)}
                                agents={agents}
                                toggleAgent={() => { }}
                                addAgent={() => { }}
                                runCouncil={() => {
                                    if (agentChatMessage.trim() && sendMessage) {
                                        sendMessage(agentChatMessage)
                                        setAgentChatMessage('')
                                    }
                                }}
                                activityLog={activityLog}
                                clearLogs={() => setActivityLog([])}
                                t={t}
                                agentChatMessage={agentChatMessage}
                                setAgentChatMessage={setAgentChatMessage}
                                isLoading={isLoading}
                                messages={messages}
                                selectedProvider={selectedProvider}
                                selectedModel={selectedModel}
                                onSelectModel={onSelectModel}
                                groupedModels={groupedModels}
                                quotas={quotas}
                                codexUsage={codexUsage}
                                settings={settings}
                                language={language}
                                onSourceClick={(path: string) => {
                                    const mount = wm.mounts.find(m => path.startsWith(m.rootPath)) || wm.mounts[0];
                                    if (mount) {
                                        wm.openFile({
                                            mountId: mount.id,
                                            path: path,
                                            name: path.split(/[\\/]/).pop() || path,
                                            isDirectory: false
                                        });
                                    }
                                }}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Modals & Overlays */}
            <WorkspaceModals
                showMountModal={showMountModal}
                setShowMountModal={setShowMountModal}
                mountForm={mountForm}
                setMountForm={setMountForm}
                addMount={addMount}
                pickLocalFolder={() => { }}
                entryModal={entryModal}
                closeEntryModal={() => setEntryModal(null)}
                entryName={entryName}
                setEntryName={setEntryName}
                submitEntryModal={handleSubmitEntryModal}
                entryBusy={entryBusy}
            />

            <LogoGeneratorModal
                isOpen={isGeneratorOpen}
                onClose={() => setIsGeneratorOpen(false)}
                project={project}
                onApply={handleApplyLogo}
                language={language}
            />

            {notice && (
                <div className={cn(
                    "fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 border flex items-center gap-3",
                    notice.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        notice.type === 'error' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                )}>
                    {notice.type === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                    <div className="text-sm font-bold uppercase tracking-wider">{notice.message}</div>
                </div>
            )}

            <OnboardingTour
                isOpen={showOnboarding}
                onClose={() => setShowOnboarding(false)}
                onComplete={() => setShowOnboarding(false)}
            />
        </div>
    )
}
