import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation, Language } from '@/i18n'
import { cn } from '@/lib/utils'
import { Project, WorkspaceEntry, TerminalTab, Message, QuotaResponse, CodexUsage, AppSettings, CouncilAgent, ActivityEntry, ProjectDashboardTab, CouncilSession } from '@/types'
import { GroupedModels } from '@/features/models/utils/model-fetcher'
import { WorkspaceToolbar } from '@renderer/features/projects/components/workspace/WorkspaceToolbar'
import { CommandStrip } from '@renderer/features/projects/components/workspace/CommandStrip'
import { WorkspaceExplorer } from '@renderer/features/projects/components/WorkspaceExplorer'
import { WorkspaceEditor } from '@renderer/features/projects/components/workspace/WorkspaceEditor'
import { TerminalPanel } from '@/features/terminal/TerminalPanel'
import { ProjectDashboard } from '@renderer/features/projects/components/ProjectDashboard'
import { AIAssistantSidebar } from '@renderer/features/projects/components/workspace/AIAssistantSidebar'
import { useWorkspaceManager } from '@renderer/features/projects/hooks/useWorkspaceManager'
import { EditorTabs } from '@renderer/features/projects/components/workspace/EditorTabs'
import { LogoGeneratorModal } from '@renderer/features/projects/components/LogoGeneratorModal'
import { X, Activity } from 'lucide-react'

// Types are now shared from @/types

interface ProjectWorkspaceProps {
    project: Project
    onBack: () => void
    onUpdateProject?: (updates: Partial<Project>) => Promise<void>
    onDeleteProject?: () => void
    language: Language
    // Terminal props passed from parent
    tabs: TerminalTab[]
    activeTabId: string | null
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
    // AI / Model props
    selectedProvider: string
    selectedModel: string
    onSelectModel: (provider: string, model: string) => void
    groupedModels?: GroupedModels
    quotas?: QuotaResponse | null
    codexUsage?: CodexUsage
    settings?: AppSettings
    sendMessage?: (content?: string) => void
    messages?: Message[]
    isLoading?: boolean
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
    project,
    onBack,
    onUpdateProject,
    onDeleteProject,
    language,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    selectedProvider,
    selectedModel,
    onSelectModel,
    groupedModels,
    quotas,
    codexUsage,
    settings,
    sendMessage: _sendMessage,
    messages,
    isLoading
}) => {
    const { t } = useTranslation(language)
    const [notifications, setNotifications] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string }[]>([])

    const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        const id = Math.random().toString(36).substr(2, 9)
        setNotifications(prev => [...prev, { id, type, message }])
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000)
    }, [])

    const logActivity = useCallback((title: string, detail?: string) => {
        console.log(`[Activity] ${title}: ${detail}`)
    }, [])

    const wm = useWorkspaceManager({ project, notify, logActivity })

    const [selectedEntry, setSelectedEntry] = useState<WorkspaceEntry | null>(null)
    const [viewTab, setViewTab] = useState<'editor' | 'council' | 'logs'>('editor')

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    // AI Assistant Panel
    const [showAgentPanel, setShowAgentPanel] = useState(false)
    const [agentPanelWidth, setAgentPanelWidth] = useState(380)

    // Terminal
    const [showTerminal, setShowTerminal] = useState(false)
    const [terminalHeight, setTerminalHeight] = useState(250)

    // Modals
    const [, setShowMountModal] = useState(false)
    const [, setEntryModal] = useState<{ type: 'createFile' | 'createFolder' | 'rename' | 'delete'; entry: WorkspaceEntry } | null>(null)
    const [showLogoModal, setShowLogoModal] = useState(false)
    const [, setEntryName] = useState('')

    const handleUpdateProject = async (updates: Partial<Project>) => {
        if (onUpdateProject) {
            await onUpdateProject(updates)
            notify('success', t('workspace.projectUpdated'))
        }
    }

    const [councilSession, setCouncilSession] = useState<CouncilSession | null>(null)
    const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])

    // WebSocket Connection for Council
    useEffect(() => {
        if (!councilSession?.id) return

        // Get WebSocket URL from environment or use default
        // In production, this should use wss:// for secure connections
        // Note: For Vite, use import.meta.env.VITE_* prefix for env vars
        const wsUrl = (import.meta.env.VITE_WEBSOCKET_URL as string | undefined) || 'ws://localhost:3001'
        
        // Validate WebSocket URL
        if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
            console.error('[ProjectWorkspace] Invalid WebSocket URL:', wsUrl)
            notify('error', 'Invalid WebSocket configuration')
            return
        }

        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'join', sessionId: councilSession.id }))
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                if (msg.sessionId === councilSession.id) {
                    setActivityLog(prev => [...prev, {
                        id: msg.id,
                        title: msg.sender.toUpperCase(),
                        agentId: msg.sender, // generic sender from WS
                        message: msg.content,
                        type: (msg.type === 'job' ? 'info' : (msg.type === 'error' ? 'error' : 'info')) as 'info' | 'error' | 'success' | 'plan', // Map types broadly
                        timestamp: msg.timestamp
                    }])
                }
            } catch (e) {
                console.error('Failed to parse WS message:', e)
            }
        }

        ws.onerror = (error) => {
            console.error('[ProjectWorkspace] WebSocket error:', error)
            notify('error', 'WebSocket connection error')
        }

        ws.onclose = () => {
            console.log('[ProjectWorkspace] WebSocket connection closed')
        }

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close()
            }
        }
    }, [councilSession, notify])

    const [agentChatMessage, setAgentChatMessage] = useState('')

    const runCouncil = async () => {
        if (!agentChatMessage.trim()) return;
        try {
            notify('info', 'Initializing Council Session...')
            const session = await window.electron.council.createSession(agentChatMessage)
            if (session) {
                setCouncilSession(session)
                setActivityLog([]) // Clear previous logs
                window.electron.council.startLoop(session.id)
                notify('success', 'Council started.')
            }
        } catch (e: unknown) {
            notify('error', 'Failed to start council: ' + (e instanceof Error ? e.message : 'Unknown error'))
        }
    }

    useEffect(() => {
        if (wm.dashboardTab === 'council') {
            const timer = setTimeout(() => setViewTab('council'), 0)
            return () => clearTimeout(timer)
        } else if (wm.dashboardTab === 'overview' || wm.dashboardTab === 'editor') {
            const timer = setTimeout(() => setViewTab('editor'), 0)
            return () => clearTimeout(timer)
        }
    }, [wm.dashboardTab])


    const [agents, setAgents] = useState<CouncilAgent[]>([
        { id: '1', name: 'Architect', role: 'System Design & Structure', enabled: true, status: 'ready', kind: 'local' },
        { id: '2', name: 'Developer', role: 'Implementation & Logic', enabled: true, status: 'ready', kind: 'local' },
        { id: '3', name: 'Reviewer', role: 'Security & Optimization', enabled: true, status: 'ready', kind: 'cloud' }
    ])

    const toggleAgent = (id: string) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))
    }



    return (
        <div className="h-full flex flex-col bg-background relative overflow-hidden">
            {/* Top Toolbar */}
            <WorkspaceToolbar
                project={project}
                onBack={onBack}
                onUpdate={handleUpdateProject}
                handleRunProject={() => wm.setDashboardTab('terminal')}
                showTerminal={showTerminal} // deprecated
                toggleTerminal={() => setShowTerminal(!showTerminal)} // deprecated
                showAgentPanel={showAgentPanel}
                toggleAgentPanel={() => setShowAgentPanel(!showAgentPanel)}
                language={language}
                dashboardTab={wm.dashboardTab}
                onDashboardTabChange={wm.setDashboardTab}
                sidebarCollapsed={sidebarCollapsed}
                toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Panel: Explorer - Collapsible Navigation Plate */}
                <div className={cn(
                    "flex flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl shrink-0 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-20",
                    sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-72 opacity-100"
                )}>
                    <div className="flex-1 overflow-hidden">
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
                    </div>
                </div>

                {/* Center: Editor Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative">
                    {wm.openTabs.length > 0 && wm.dashboardTab === 'editor' && (
                        <div className="z-20 relative">
                            <EditorTabs
                                openTabs={wm.openTabs}
                                activeTabId={wm.activeTabId}
                                setActiveTabId={wm.setActiveEditorTabId}
                                closeTab={wm.closeTab}
                            />
                        </div>
                    )}

                    <div className="flex-1 relative overflow-hidden">
                        <div className={cn("absolute inset-0 z-0", wm.dashboardTab !== 'editor' && "pointer-events-none opacity-0")}>
                            <WorkspaceEditor
                                activeTab={wm.activeTab}
                                updateTabContent={wm.updateTabContent}
                                emptyState={null}
                            />
                        </div>

                        {wm.dashboardTab !== 'editor' && (
                            <div className="absolute inset-0 z-10 bg-background animate-in fade-in duration-200">
                                <ProjectDashboard
                                    project={project}
                                    onUpdate={handleUpdateProject}
                                    onOpenLogoGenerator={() => setShowLogoModal(true)}
                                    language={language}
                                    activeTab={wm.dashboardTab as ProjectDashboardTab}
                                    onTabChange={(tab: ProjectDashboardTab) => wm.setDashboardTab(tab)}
                                    onDelete={onDeleteProject}
                                />
                            </div>
                        )}

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
                                activeTabId={activeTabId}
                                setTabs={setTabs}
                                setActiveTabId={setActiveTabId}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Panel: AI Assistant */}
                <div
                    className={cn(
                        "border-l border-white/5 bg-background/40 backdrop-blur-xl shrink-0 transition-all duration-300 relative",
                        showAgentPanel ? "opacity-100" : "w-0 opacity-0 overflow-hidden"
                    )}
                    style={{ width: showAgentPanel ? agentPanelWidth : 0 }}
                >
                    {/* Resizer */}
                    <div
                        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-50"
                        onMouseDown={(e) => {
                            const startX = e.clientX
                            const startWidth = agentPanelWidth
                            const doDrag = (dragEvent: MouseEvent) => {
                                setAgentPanelWidth(Math.max(300, Math.min(800, startWidth - (dragEvent.clientX - startX))))
                            }
                            const stopDrag = () => {
                                window.removeEventListener('mousemove', doDrag)
                                window.removeEventListener('mouseup', stopDrag)
                            }
                            window.addEventListener('mousemove', doDrag)
                            window.addEventListener('mouseup', stopDrag)
                        }}
                    />
                    <div className="h-full flex flex-col">
                        <AIAssistantSidebar
                            viewTab={viewTab}
                            selectedProvider={selectedProvider}
                            selectedModel={selectedModel}
                            onSelectModel={onSelectModel}
                            settings={settings as AppSettings}
                            groupedModels={groupedModels as GroupedModels}
                            quotas={quotas || null}
                            codexUsage={codexUsage || null}
                            agentChatMessage={agentChatMessage}
                            setAgentChatMessage={setAgentChatMessage}
                            councilEnabled={wm.councilEnabled}
                            toggleCouncil={() => wm.setCouncilEnabled(!wm.councilEnabled)}
                            agents={agents}
                            toggleAgent={toggleAgent}
                            addAgent={() => notify('info', 'Agent creation coming soon')}
                            runCouncil={runCouncil}
                            activityLog={activityLog}
                            clearLogs={() => setActivityLog([])}
                            t={t}
                            messages={messages}
                            isLoading={isLoading}
                            language={language}
                            onSourceClick={(path) => wm.openFile({ mountId: wm.mounts[0]?.id, path, name: path.split('/').pop() || '', isDirectory: false })}
                        />
                    </div>
                </div>
            </div>

            {/* Notifications */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
                {notifications.map(n => (
                    <div key={n.id} className={cn(
                        "px-4 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-right-10 fade-in pointer-events-auto min-w-[300px] flex items-center gap-3",
                        n.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                            n.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                "bg-blue-500/10 border-blue-500/20 text-blue-400"
                    )}>
                        {n.type === 'success' ? <Activity className="w-4 h-4" /> : n.type === 'error' ? <X className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        <span className="text-xs font-bold tracking-tight">{n.message}</span>
                    </div>
                ))}
            </div>

            {/* Modals */}
            <LogoGeneratorModal
                isOpen={showLogoModal}
                onClose={() => setShowLogoModal(false)}
                project={project}
                onApply={async (logoPath) => {
                    await handleUpdateProject({ logo: logoPath })
                    setShowLogoModal(false)
                }}
                language={language}
            />

            {/* Global Command Strip */}
            <CommandStrip
                language={language}
                branchName="main"
                notificationCount={notifications.length}
                status={isLoading ? 'busy' : 'ready'}
                onCommandClick={() => notify('info', 'Command Palette coming soon')}
            />
        </div>
    )
}
