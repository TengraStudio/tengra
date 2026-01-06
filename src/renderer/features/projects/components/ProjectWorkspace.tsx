import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { aiGutter } from '@/lib/cm-suggestions'
import { useTranslation, Language } from '@/i18n'
import {
    Code
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Project, TerminalTab, CouncilAgent, ActivityEntry, WorkspaceEntry, WorkspaceMount } from '@/types'
import { WorkspaceExplorer } from './WorkspaceExplorer'
import { TerminalPanel } from '@/features/terminal/TerminalPanel'
import { OnboardingTour } from '@/features/onboarding/OnboardingTour'
import { AnimatePresence } from 'framer-motion'
import { useWorkspaceManager } from '../hooks/useWorkspaceManager'
import { EditorView } from '@codemirror/view'

// Sub-components
import { WorkspaceToolbar } from './workspace/WorkspaceToolbar'
import { EditorTabs } from './workspace/EditorTabs'
import { WorkspaceEditor } from './workspace/WorkspaceEditor'
import { AIAssistantSidebar } from './workspace/AIAssistantSidebar'
import { WorkspaceModals } from './workspace/WorkspaceModals'

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
    selectedProvider, selectedModel, onSelectModel, groupedModels, quotas, codexUsage, settings
}) => {
    const { t } = useTranslation(language)
    const [showOnboarding, setShowOnboarding] = useState(false)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
    const [agents] = useState<CouncilAgent[]>([
        { id: 'planner', name: 'Planner', role: 'Task routing', kind: 'cloud', status: 'ready', enabled: true },
        { id: 'builder', name: 'Builder', role: 'Implementation', kind: 'local', status: 'ready', enabled: true },
        { id: 'reviewer', name: 'Reviewer', role: 'Quality & safety', kind: 'cloud', status: 'ready', enabled: true }
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

    // Side Props
    const [viewTab] = useState<'editor' | 'council' | 'logs'>('editor')
    const [councilEnabled, setCouncilEnabled] = useState(false)

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
                notify('success', `File created: ${entryName}`)
            } else if (entryModal.type === 'createFolder') {
                const parentPath = entryModal.entry?.path || ''
                const fullPath = parentPath ? `${parentPath}/${entryName}` : entryName
                await wm.createFolder(fullPath)
                notify('success', `Folder created: ${entryName}`)
            } else if (entryModal.type === 'rename' && entryModal.entry) {
                await wm.renameEntry(entryModal.entry, entryName)
                notify('success', `Renamed: ${entryName}`)
            }
            setEntryModal(null)
            setEntryName('')
        } catch (error: any) {
            notify('error', error.message || 'Operation failed')
        } finally {
            setEntryBusy(false)
        }
    }

    const handleDeleteEntry = async () => {
        if (!entryModal?.entry) return
        setEntryBusy(true)
        try {
            await wm.deleteEntry(entryModal.entry)
            notify('success', `Deleted: ${entryModal.entry.name}`)
            setEntryModal(null)
        } catch (error: any) {
            notify('error', error.message || 'Deletion failed')
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
        const defaultName = mountForm.type === 'ssh' ? `${mountForm.username}@${mountForm.host}` : (mountForm.rootPath.split(/[\\/]/).pop() || 'Local')
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

    const editorExtensions = useMemo(() => [EditorView.theme({ "&": { height: "100%" } }), aiGutter], [])

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

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-foreground overflow-hidden">
            <WorkspaceToolbar
                project={project}
                onBack={onBack}
                handleRunProject={() => { }}
                showTerminal={showTerminal}
                toggleTerminal={() => setShowTerminal(!showTerminal)}
                handleSearch={handleSearch}
                showAgentPanel={showAgentPanel}
                toggleAgentPanel={() => setShowAgentPanel(!showAgentPanel)}
            />

            <div className="flex-1 flex flex-row overflow-hidden relative h-full">
                {/* Left Panel: Explorer */}
                <div className="w-72 flex flex-col border-r border-white/5 bg-background/20 shrink-0">
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
                    />
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
                            editorExtensions={editorExtensions}
                            emptyState={
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <Code className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p className="text-lg font-medium">No file open</p>
                                        <p className="text-sm opacity-60">Select a file from the explorer to start editing</p>
                                    </div>
                                </div>
                            }
                        />

                        <AnimatePresence>
                            {showTerminal && (
                                <div
                                    className="absolute bottom-0 left-0 right-0 bg-background border-t border-white/10 z-30"
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
                            )}
                        </AnimatePresence>
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
                        runCouncil={() => { }}
                        activityLog={activityLog}
                        clearLogs={() => setActivityLog([])}
                        t={t}
                        agentChatMessage={agentChatMessage}
                        setAgentChatMessage={setAgentChatMessage}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSelectModel={onSelectModel}
                        groupedModels={groupedModels}
                        quotas={quotas}
                        codexUsage={codexUsage}
                        settings={settings}
                    />
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
