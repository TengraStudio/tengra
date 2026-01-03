import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation, Language } from '../i18n'
import { createPortal } from 'react-dom'
import {
    ArrowLeft,
    RefreshCw,
    Save,
    Search,
    X,
    Plus,
    Users,
    PanelRightClose,
    PanelRightOpen,
    Terminal
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { cn } from '@/lib/utils'
import { Project, WorkspaceMount } from '@/types'
import { WorkspaceExplorer, WorkspaceEntry, ContextMenuAction } from './WorkspaceExplorer'
import { TerminalPanel } from './TerminalPanel'

interface ProjectWorkspaceProps {
    project: Project
    onBack: () => void
    language: Language
}

interface EditorTab {
    id: string
    mountId: string
    path: string
    name: string
    content: string
    savedContent: string
}

interface MountFormState {
    type: 'local' | 'ssh'
    name: string
    rootPath: string
    host: string
    port: string
    username: string
    authType: 'password' | 'key'
    password: string
    privateKey: string
    passphrase: string
}

interface Notice {
    type: 'success' | 'error' | 'info'
    message: string
}

interface EntryModalState {
    type: 'createFile' | 'createFolder' | 'rename' | 'delete' | 'search'
    entry?: WorkspaceEntry
}

interface CouncilAgent {
    id: string
    name: string
    role: string
    kind: 'local' | 'cloud'
    status: 'ready' | 'busy'
    enabled: boolean
}

interface ActivityEntry {
    id: string
    timestamp: Date
    title: string
    detail?: string
}

const defaultMountForm = (): MountFormState => ({
    type: 'local',
    name: '',
    rootPath: '',
    host: '',
    port: '22',
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: ''
})

const getSeparator = (pathValue: string, mountType: WorkspaceMount['type']) => {
    if (mountType === 'ssh') return '/'
    return pathValue.includes('\\') ? '\\' : '/'
}

const joinPath = (base: string, name: string, mountType: WorkspaceMount['type']) => {
    const sep = getSeparator(base, mountType)
    if (base.endsWith(sep)) return `${base}${name}`
    return `${base}${sep}${name}`
}

const getBaseName = (pathValue: string) => {
    const parts = pathValue.split(/[\\/]/)
    return parts[parts.length - 1] || pathValue
}

const getParentPath = (pathValue: string, mountType: WorkspaceMount['type']) => {
    const sep = getSeparator(pathValue, mountType)
    const idx = pathValue.lastIndexOf(sep)
    if (idx <= 0) return pathValue
    return pathValue.slice(0, idx)
}

const getLanguageExtension = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return javascript({ typescript: ext.startsWith('t'), jsx: ext.includes('x') })
    if (ext === 'json') return json()
    if (['html', 'htm'].includes(ext)) return html()
    if (['css', 'scss', 'sass', 'less'].includes(ext)) return css()
    if (ext === 'py') return python()
    if (ext === 'rs') return rust()
    if (['sql', 'pgsql'].includes(ext)) return sql()
    if (['md', 'markdown'].includes(ext)) return markdown()
    if (['xml', 'svg'].includes(ext)) return xml()
    return javascript()
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ project, onBack, language }) => {
    const { t } = useTranslation(language)
    const [mounts, setMounts] = useState<WorkspaceMount[]>(() => {
        if (Array.isArray(project.mounts) && project.mounts.length > 0) return project.mounts
        if (project.path) {
            return [{
                id: `local-${project.id}`,
                name: 'Local',
                type: 'local',
                rootPath: project.path
            }]
        }
        return []
    })
    const [mountStatus, setMountStatus] = useState<Record<string, 'connected' | 'disconnected' | 'connecting'>>({})
    const [refreshSignal, setRefreshSignal] = useState(0)
    const [selectedEntry, setSelectedEntry] = useState<WorkspaceEntry | null>(null)
    const [openTabs, setOpenTabs] = useState<EditorTab[]>([])
    const [activeTabId, setActiveTabId] = useState<string | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [showMountModal, setShowMountModal] = useState(false)
    const [mountForm, setMountForm] = useState<MountFormState>(defaultMountForm())
    const [sidebarTarget, setSidebarTarget] = useState<HTMLElement | null>(null)
    const [entryModal, setEntryModal] = useState<EntryModalState | null>(null)
    const [entryName, setEntryName] = useState('')
    const [entryBusy, setEntryBusy] = useState(false)
    const [viewTab, setViewTab] = useState<'editor' | 'council' | 'logs'>('editor')
    const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
    const [councilEnabled, setCouncilEnabled] = useState(Boolean(project.councilConfig?.enabled))
    const [agents, setAgents] = useState<CouncilAgent[]>([
        { id: 'planner', name: 'Planner', role: 'Task routing', kind: 'cloud', status: 'ready', enabled: true },
        { id: 'builder', name: 'Builder', role: 'Implementation', kind: 'local', status: 'ready', enabled: true },
        { id: 'reviewer', name: 'Reviewer', role: 'Quality & safety', kind: 'cloud', status: 'ready', enabled: true }
    ])

    // New split panel states
    const [showAgentPanel, setShowAgentPanel] = useState(true)
    const [agentPanelWidth] = useState(30) // percentage
    const [showTerminal, setShowTerminal] = useState(false)
    const [terminalHeight, setTerminalHeight] = useState(250)
    const [agentChatMessage, setAgentChatMessage] = useState('')

    const activeTab = openTabs.find((tab) => tab.id === activeTabId) || null
    const activeMount = activeTab ? mounts.find((m) => m.id === activeTab.mountId) : null

    useEffect(() => {
        let cancelled = false
        const syncStatus = async () => {
            const next: Record<string, 'connected' | 'disconnected' | 'connecting'> = {}
            for (const mount of mounts) {
                if (mount.type === 'local') {
                    next[mount.id] = 'connected'
                } else {
                    try {
                        const isConnected = await window.electron.ssh.isConnected(mount.id)
                        next[mount.id] = isConnected ? 'connected' : 'disconnected'
                    } catch {
                        next[mount.id] = 'disconnected'
                    }
                }
            }
            if (!cancelled) setMountStatus(next)
        }
        syncStatus()
        return () => {
            cancelled = true
        }
    }, [mounts])

    useEffect(() => {
        if (!notice) return
        const timer = setTimeout(() => setNotice(null), 4000)
        return () => clearTimeout(timer)
    }, [notice])

    useEffect(() => {
        if (typeof document === 'undefined') return
        const target = document.getElementById('workspace-sidebar')
        if (target !== sidebarTarget) {
            setSidebarTarget(target)
        }
    })

    useEffect(() => {
        setCouncilEnabled(Boolean(project.councilConfig?.enabled))
    }, [project.id])


    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault()
                saveActiveTab()
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    })

    const notify = (type: Notice['type'], message: string) => {
        setNotice({ type, message })
    }

    const logActivity = (title: string, detail?: string) => {
        setActivityLog((prev) => {
            const next = [{
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                timestamp: new Date(),
                title,
                detail
            }, ...prev]
            return next.slice(0, 50)
        })
    }

    const toggleAgent = (id: string) => {
        setAgents((prev) => prev.map((agent) => (
            agent.id === id ? { ...agent, enabled: !agent.enabled } : agent
        )))
    }

    const addAgent = () => {
        setAgents((prev) => {
            const count = prev.length + 1
            const name = `Agent ${count}`
            const next: CouncilAgent[] = [...prev, {
                id: `agent-${Date.now()}`,
                name,
                role: 'Generalist',
                kind: 'cloud',
                status: 'ready',
                enabled: true
            }]
            logActivity('Added agent', name)
            return next
        })
        notify('info', 'Agent added.')
    }

    const runCouncil = () => {
        if (!councilEnabled) {
            notify('info', 'Council is disabled.')
            return
        }
        notify('info', 'Council run queued.')
        logActivity('Council run', 'Consensus requested')
    }

    const clearLogs = () => {
        setActivityLog([])
        notify('info', 'Logs cleared.')
    }

    const toggleCouncil = () => {
        setCouncilEnabled((prev) => {
            const next = !prev
            logActivity(next ? 'Council enabled' : 'Council disabled')
            return next
        })
    }

    const persistMounts = async (nextMounts: WorkspaceMount[]) => {
        setMounts(nextMounts)
        try {
            await window.electron.db.updateProject(project.id, {
                mounts: JSON.stringify(nextMounts)
            })
        } catch (error) {
            console.error('Failed to save mounts', error)
            notify('error', 'Failed to save mounts.')
        }
    }

    const ensureMountReady = async (mount: WorkspaceMount) => {
        if (mount.type === 'local') return true
        if (!mount.ssh?.host || !mount.ssh?.username) {
            notify('error', 'SSH config is missing.')
            return false
        }
        if (mountStatus[mount.id] === 'connected') return true
        setMountStatus((prev) => ({ ...prev, [mount.id]: 'connecting' }))
        const result = await window.electron.ssh.connect({
            id: mount.id,
            name: mount.name,
            host: mount.ssh.host,
            port: mount.ssh.port ? Number(mount.ssh.port) : 22,
            username: mount.ssh.username,
            authType: mount.ssh.authType || (mount.ssh.privateKey ? 'key' : 'password'),
            password: mount.ssh.password,
            privateKey: mount.ssh.privateKey,
            passphrase: mount.ssh.passphrase
        })
        if (!result?.success) {
            setMountStatus((prev) => ({ ...prev, [mount.id]: 'disconnected' }))
            notify('error', result?.error || 'SSH connection failed.')
            return false
        }
        setMountStatus((prev) => ({ ...prev, [mount.id]: 'connected' }))
        return true
    }

    const openFile = async (entry: WorkspaceEntry) => {
        if (entry.isDirectory) return
        const mount = mounts.find((m) => m.id === entry.mountId)
        if (!mount) return
        const tabId = `${entry.mountId}:${entry.path}`
        const existing = openTabs.find((tab) => tab.id === tabId)
        if (existing) {
            setActiveTabId(existing.id)
            return
        }
        const isReady = await ensureMountReady(mount)
        if (!isReady) return
        const result = mount.type === 'local'
            ? await window.electron.readFile(entry.path)
            : await window.electron.ssh.readFile(mount.id, entry.path)

        if (!result?.success) {
            notify('error', result?.error || 'Failed to read file.')
            return
        }

        const content = result?.content || ''
        const tab: EditorTab = {
            id: tabId,
            mountId: entry.mountId,
            path: entry.path,
            name: entry.name,
            content,
            savedContent: content
        }
        setOpenTabs((prev) => [...prev, tab])
        setActiveTabId(tabId)
        setViewTab('editor')
    }

    const updateTabContent = (value: string) => {
        if (!activeTab) return
        setOpenTabs((prev) =>
            prev.map((tab) => (tab.id === activeTab.id ? { ...tab, content: value } : tab))
        )
    }

    const saveActiveTab = async () => {
        if (!activeTab || !activeMount) return
        const isReady = await ensureMountReady(activeMount)
        if (!isReady) return
        const result = activeMount.type === 'local'
            ? await window.electron.writeFile(activeTab.path, activeTab.content)
            : await window.electron.ssh.writeFile(activeMount.id, activeTab.path, activeTab.content)

        if (!result?.success) {
            notify('error', result?.error || 'Save failed.')
            return
        }
        setOpenTabs((prev) =>
            prev.map((tab) => (tab.id === activeTab.id ? { ...tab, savedContent: tab.content } : tab))
        )
        logActivity('Saved file', activeTab.path)
        notify('success', 'File saved.')
    }

    const saveAllTabs = async () => {
        for (const tab of openTabs) {
            if (tab.content === tab.savedContent) continue
            const mount = mounts.find((m) => m.id === tab.mountId)
            if (!mount) continue
            const isReady = await ensureMountReady(mount)
            if (!isReady) continue
            const result = mount.type === 'local'
                ? await window.electron.writeFile(tab.path, tab.content)
                : await window.electron.ssh.writeFile(mount.id, tab.path, tab.content)
            if (!result?.success) {
                notify('error', result?.error || `Save failed: ${tab.name}`)
                continue
            }
            setOpenTabs((prev) =>
                prev.map((item) => (item.id === tab.id ? { ...item, savedContent: item.content } : item))
            )
        }
        logActivity('Saved all files', `${openTabs.length} tab(s)`)
        notify('success', 'All files saved.')
    }

    const closeTab = (tabId: string) => {
        const tab = openTabs.find((t) => t.id === tabId)
        if (tab && tab.content !== tab.savedContent) {
            const confirmed = window.confirm(`Close without saving "${tab.name}"?`)
            if (!confirmed) return
        }
        setOpenTabs((prev) => prev.filter((t) => t.id !== tabId))
        if (activeTabId === tabId) {
            const remaining = openTabs.filter((t) => t.id !== tabId)
            setActiveTabId(remaining[remaining.length - 1]?.id || null)
        }
    }

    const resolveTargetMount = () => {
        const mountId = selectedEntry?.mountId || activeTab?.mountId || mounts[0]?.id
        if (!mountId) return null
        return mounts.find((m) => m.id === mountId) || null
    }

    const resolveBasePath = (mount: WorkspaceMount) => {
        if (selectedEntry) {
            return selectedEntry.isDirectory
                ? selectedEntry.path
                : getParentPath(selectedEntry.path, mount.type)
        }
        if (activeTab) {
            return getParentPath(activeTab.path, mount.type)
        }
        return mount.rootPath
    }



    const createFile = async (name: string) => {
        const mount = resolveTargetMount()
        if (!mount) return notify('error', 'No mount available.')
        if (!name) return
        const basePath = resolveBasePath(mount)
        const filePath = joinPath(basePath, name, mount.type)
        const isReady = await ensureMountReady(mount)
        if (!isReady) return
        const result = mount.type === 'local'
            ? await window.electron.writeFile(filePath, '')
            : await window.electron.ssh.writeFile(mount.id, filePath, '')
        if (!result?.success) {
            notify('error', result?.error || 'File create failed.')
            return
        }
        logActivity('Created file', filePath)
        setRefreshSignal((prev) => prev + 1)
        openFile({ mountId: mount.id, name, path: filePath, isDirectory: false })
    }

    const createFolder = async (name: string) => {
        const mount = resolveTargetMount()
        if (!mount) return notify('error', 'No mount available.')
        if (!name) return
        const basePath = resolveBasePath(mount)
        const folderPath = joinPath(basePath, name, mount.type)
        const isReady = await ensureMountReady(mount)
        if (!isReady) return
        const result = mount.type === 'local'
            ? await window.electron.createDirectory(folderPath)
            : await window.electron.ssh.mkdir(mount.id, folderPath)
        if (!result?.success) {
            notify('error', result?.error || 'Folder create failed.')
            return
        }
        logActivity('Created folder', folderPath)
        setRefreshSignal((prev) => prev + 1)
    }

    const renameEntry = async (entry: WorkspaceEntry, newName: string) => {
        const mount = mounts.find((m) => m.id === entry.mountId)
        if (!mount) return
        if (!newName || newName === entry.name) return
        const basePath = getParentPath(entry.path, mount.type)
        const newPath = joinPath(basePath, newName, mount.type)
        const isReady = await ensureMountReady(mount)
        if (!isReady) return
        const result = mount.type === 'local'
            ? await window.electron.renamePath(entry.path, newPath)
            : await window.electron.ssh.rename(mount.id, entry.path, newPath)
        if (!result?.success) {
            notify('error', result?.error || 'Rename failed.')
            return
        }
        const sep = getSeparator(entry.path, mount.type)
        setOpenTabs((prev) => prev.map((tab) => {
            if (tab.mountId !== mount.id) return tab
            if (tab.path === entry.path) {
                return { ...tab, path: newPath, name: newName }
            }
            if (tab.path.startsWith(`${entry.path}${sep}`)) {
                const updatedPath = `${newPath}${tab.path.slice(entry.path.length)}`
                return { ...tab, path: updatedPath, name: getBaseName(updatedPath) }
            }
            return tab
        }))
        setSelectedEntry((prev) => prev ? { ...prev, name: newName, path: newPath } : prev)
        logActivity('Renamed item', `${entry.path} -> ${newPath}`)
        setRefreshSignal((prev) => prev + 1)
    }

    const deleteEntry = async (entry: WorkspaceEntry) => {
        const mount = mounts.find((m) => m.id === entry.mountId)
        if (!mount) return
        const isReady = await ensureMountReady(mount)
        if (!isReady) return
        const result = mount.type === 'local'
            ? (entry.isDirectory
                ? await window.electron.deleteDirectory(entry.path)
                : await window.electron.deleteFile(entry.path))
            : (entry.isDirectory
                ? await window.electron.ssh.deleteDir(mount.id, entry.path)
                : await window.electron.ssh.deleteFile(mount.id, entry.path))

        if (!result?.success) {
            notify('error', result?.error || 'Delete failed.')
            return
        }
        logActivity(`Deleted ${entry.isDirectory ? 'folder' : 'file'}`, entry.path)
        setOpenTabs((prev) => prev.filter((tab) => !tab.path.startsWith(entry.path)))
        setSelectedEntry(null)
        setRefreshSignal((prev) => prev + 1)
    }

    // Handle context menu actions from WorkspaceExplorer
    const handleContextAction = (action: ContextMenuAction) => {
        const { type, entry } = action
        if (type === 'rename' || type === 'delete') {
            setEntryModal({ type, entry })
            setEntryName(type === 'rename' ? entry.name : '')
        } else {
            // createFile or createFolder on selected directory
            setSelectedEntry(entry)
            setEntryModal({ type, entry })
            setEntryName('')
        }
    }

    const closeEntryModal = () => {
        setEntryModal(null)
        setEntryName('')
        setEntryBusy(false)
    }

    const submitEntryModal = async () => {
        if (!entryModal) return
        const trimmed = entryName.trim()
        setEntryBusy(true)
        try {
            if (entryModal.type === 'createFile') {
                if (!trimmed) {
                    notify('info', 'Enter a file name.')
                    return
                }
                await createFile(trimmed)
                closeEntryModal()
                return
            }
            if (entryModal.type === 'createFolder') {
                if (!trimmed) {
                    notify('info', 'Enter a folder name.')
                    return
                }
                await createFolder(trimmed)
                closeEntryModal()
                return
            }
            if (entryModal.type === 'rename') {
                if (!entryModal.entry) return
                if (!trimmed) {
                    notify('info', 'Enter a new name.')
                    return
                }
                await renameEntry(entryModal.entry, trimmed)
                closeEntryModal()
                return
            }
            if (entryModal.type === 'delete') {
                if (!entryModal.entry) return
                await deleteEntry(entryModal.entry)
                closeEntryModal()
                return
            }
            if (entryModal.type === 'search') {
                if (!trimmed) {
                    notify('info', 'Enter a search term.')
                    return
                }
                const mount = resolveTargetMount()
                if (!mount) return
                if (mount.type === 'ssh') {
                    notify('info', 'Search is not available for SSH yet.')
                    return
                }
                const result = await window.electron.searchFiles(mount.rootPath, trimmed)
                if (!result?.success) {
                    notify('error', result?.error || 'Search failed.')
                    return
                }
                const count = result.matches?.length || 0
                notify('success', `Found ${count} match${count === 1 ? '' : 'es'} for "${trimmed}".`)
                closeEntryModal()
            }
        } finally {
            setEntryBusy(false)
        }
    }

    const handleSearch = () => {
        const mount = resolveTargetMount()
        if (!mount) return notify('info', 'No mount available.')
        setEntryModal({ type: 'search' })
        setEntryName('')
    }

    const handleRemoveMount = async (mountId: string) => {
        const mount = mounts.find((m) => m.id === mountId)
        if (!mount) return
        const confirmed = window.confirm(`Remove mount "${mount.name}"?`)
        if (!confirmed) return
        if (mount.type === 'ssh') {
            try {
                await window.electron.ssh.disconnect(mount.id)
            } catch (error) {
                console.error('SSH disconnect failed', error)
            }
        }
        const nextMounts = mounts.filter((m) => m.id !== mountId)
        await persistMounts(nextMounts)
        setOpenTabs((prev) => prev.filter((tab) => tab.mountId !== mountId))
        if (activeTab?.mountId === mountId) setActiveTabId(null)
        if (selectedEntry?.mountId === mountId) setSelectedEntry(null)
        logActivity('Removed mount', mount.name)
    }

    const addMount = async () => {
        if (mountForm.type === 'local') {
            if (!mountForm.rootPath) return notify('info', 'Pick a local folder first.')
        } else {
            if (!mountForm.host || !mountForm.username || !mountForm.rootPath) {
                return notify('info', 'Fill host, username, and root path.')
            }
        }

        const newMount: WorkspaceMount = {
            id: `mount-${Date.now()}`,
            name: mountForm.name || (mountForm.type === 'ssh' ? `${mountForm.username}@${mountForm.host}` : 'Local'),
            type: mountForm.type,
            rootPath: mountForm.rootPath,
            ssh: mountForm.type === 'ssh' ? {
                host: mountForm.host,
                port: mountForm.port ? Number(mountForm.port) : 22,
                username: mountForm.username,
                authType: mountForm.authType,
                password: mountForm.authType === 'password' ? mountForm.password : undefined,
                privateKey: mountForm.authType === 'key' ? mountForm.privateKey : undefined,
                passphrase: mountForm.passphrase || undefined
            } : undefined
        }
        const nextMounts = [...mounts, newMount]
        await persistMounts(nextMounts)
        logActivity('Added mount', newMount.name)
        setMountForm(defaultMountForm())
        setShowMountModal(false)
        setRefreshSignal((prev) => prev + 1)
        if (newMount.type === 'ssh') {
            await ensureMountReady(newMount)
        }
    }

    const pickLocalFolder = async () => {
        const result = await window.electron.selectDirectory()
        if (result?.success && result.path) {
            const path = result.path
            setMountForm((prev) => ({ ...prev, rootPath: path }))
        }
    }

    const editorExtensions = useMemo(() => {
        if (!activeTab) return [javascript()]
        return [getLanguageExtension(activeTab.name)]
    }, [activeTab?.name])

    const statusText = activeTab
        ? `${activeTab.path} ${activeTab.content !== activeTab.savedContent ? '(unsaved)' : '(saved)'}`
        : selectedEntry
            ? selectedEntry.path
            : 'No file selected'

    const explorerNode = (
        <WorkspaceExplorer
            mounts={mounts}
            mountStatus={mountStatus}
            refreshSignal={refreshSignal}
            onOpenFile={openFile}
            onSelectEntry={setSelectedEntry}
            onAddMount={() => setShowMountModal(true)}
            onRemoveMount={handleRemoveMount}
            selectedEntry={selectedEntry}
            onEnsureMount={ensureMountReady}
            onContextAction={handleContextAction}
            variant={sidebarTarget ? 'embedded' : 'panel'}
        />
    )
    const explorerPortal = sidebarTarget ? createPortal(explorerNode, sidebarTarget) : null

    const renderCouncil = () => {
        const enabledAgents = agents.filter((agent) => agent.enabled)
        const localCount = enabledAgents.filter((agent) => agent.kind === 'local').length
        const cloudCount = enabledAgents.filter((agent) => agent.kind === 'cloud').length
        return (
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                        <div className="text-xs uppercase text-zinc-500 tracking-widest">Council</div>
                        <div className="text-2xl font-bold text-white">{councilEnabled ? 'Enabled' : 'Disabled'}</div>
                        <button
                            onClick={toggleCouncil}
                            className={cn(
                                "w-full px-3 py-2 rounded-lg text-xs font-semibold border transition-colors",
                                councilEnabled
                                    ? "bg-primary/20 text-primary border-primary/40"
                                    : "bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10"
                            )}
                        >
                            {councilEnabled ? 'Disable council' : 'Enable council'}
                        </button>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                        <div className="text-xs uppercase text-zinc-500 tracking-widest">Agents</div>
                        <div className="text-2xl font-bold text-white">{enabledAgents.length}</div>
                        <div className="text-xs text-zinc-500">{localCount} local / {cloudCount} cloud</div>
                        <button
                            onClick={addAgent}
                            className="w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                        >
                            Add agent
                        </button>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                        <div className="text-xs uppercase text-zinc-500 tracking-widest">Consensus</div>
                        <div className="text-2xl font-bold text-white">2/3</div>
                        <div className="text-xs text-zinc-500">Default voting threshold</div>
                        <button
                            onClick={runCouncil}
                            disabled={!councilEnabled}
                            className={cn(
                                "w-full px-3 py-2 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 transition-colors",
                                councilEnabled ? "hover:bg-white/10" : "opacity-60 cursor-not-allowed"
                            )}
                        >
                            Run council
                        </button>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-semibold text-white">Agents</div>
                        <div className="text-xs text-zinc-500">{enabledAgents.length} active</div>
                    </div>
                    <div className="space-y-3">
                        {agents.map((agent) => (
                            <div key={agent.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                                <div className={cn(
                                    "h-2.5 w-2.5 rounded-full",
                                    agent.status === 'ready' ? "bg-emerald-400" : "bg-amber-400"
                                )} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{agent.name}</div>
                                    <div className="text-xs text-zinc-500 truncate">{agent.role}</div>
                                </div>
                                <span className="text-xs uppercase font-semibold text-zinc-400">{agent.kind}</span>
                                <button
                                    onClick={() => toggleAgent(agent.id)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                                        agent.enabled
                                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                            : "bg-white/5 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {agent.enabled ? 'On' : 'Off'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="text-sm font-semibold text-white mb-3">Task routing</div>
                        <div className="space-y-2 text-xs text-zinc-500">
                            <div className="flex items-center justify-between">
                                <span>Strategy</span>
                                <span className="text-zinc-300">Round robin</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Soft deadline</span>
                                <span className="text-zinc-300">4s</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Hard deadline</span>
                                <span className="text-zinc-300">25s</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="text-sm font-semibold text-white mb-3">Decision rules</div>
                        <div className="space-y-2 text-xs text-zinc-500">
                            <div className="flex items-center justify-between">
                                <span>Confidence gate</span>
                                <span className="text-zinc-300"> {'>'}= 0.7</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Conflict handling</span>
                                <span className="text-zinc-300">Escalate to user</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Late suggestions</span>
                                <span className="text-zinc-300">Allowed</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const renderLogs = () => (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{t('workspace.activityLogs') || 'Activity Logs'}</div>
                <button
                    onClick={clearLogs}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                >
                    Clear
                </button>
            </div>
            {activityLog.length === 0 ? (
                <div className="text-sm text-zinc-500">No activity yet.</div>
            ) : (
                <div className="space-y-2">
                    {activityLog.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <div className="text-xs text-zinc-500 pt-0.5">
                                {entry.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white">{entry.title}</div>
                                {entry.detail && <div className="text-xs text-zinc-500 truncate">{entry.detail}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    return (
        <div className="flex flex-col h-full bg-background text-foreground">
            <div className="flex flex-1 min-h-0">
                {!sidebarTarget && explorerNode}

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onBack}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-muted/20 hover:bg-muted/30 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {t('sidebar.projects')}
                            </button>
                            <div>
                                <div className="text-base font-semibold text-foreground">{project.title || 'Project'}</div>
                                <div className="text-xs text-muted-foreground">{project.description || 'Workspace editor'}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setRefreshSignal((prev) => prev + 1)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setShowMountModal(true)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Bağla
                            </button>
                            <button
                                onClick={() => setShowTerminal(!showTerminal)}
                                className={cn(
                                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                                    showTerminal
                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                        : "bg-muted/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Terminal className="w-4 h-4" />
                                Terminal
                            </button>
                            <button
                                onClick={() => setShowAgentPanel(!showAgentPanel)}
                                className={cn(
                                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                                    showAgentPanel
                                        ? "bg-primary/20 text-primary border border-primary/30"
                                        : "bg-muted/20 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {showAgentPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                                AI
                            </button>
                        </div>
                    </div>

                    {/* Status bar for editor - save buttons only */}
                    {activeTab && (
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/20">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="truncate max-w-md">{activeTab.path}</span>
                                {activeTab.content !== activeTab.savedContent && (
                                    <span className="w-2 h-2 rounded-full bg-amber-400" title="Kaydedilmemiş değişiklikler" />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={saveActiveTab} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors">
                                    <Save className="w-4 h-4" />
                                    Kaydet
                                </button>
                                <button onClick={saveAllTabs} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors">
                                    Tümünü Kaydet
                                </button>
                                <button onClick={handleSearch} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors">
                                    <Search className="w-4 h-4" />
                                    Search
                                </button>
                            </div>
                        </div>
                    )}

                    {viewTab === 'editor' && (
                        <>
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/40 overflow-x-auto">
                                {openTabs.length === 0 && (
                                    <div className="text-xs text-muted-foreground px-2">Open a file from the left panel.</div>
                                )}
                                {openTabs.map((tab) => {
                                    const isActive = tab.id === activeTabId
                                    const isDirty = tab.content !== tab.savedContent
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTabId(tab.id)}
                                            className={cn(
                                                "group flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all",
                                                isActive ? "bg-white/10 border-white/10 text-white" : "bg-transparent border-transparent text-muted-foreground hover:text-white hover:bg-white/5"
                                            )}
                                        >
                                            <span className="truncate max-w-xs">{tab.name}</span>
                                            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                            <span
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    closeTab(tab.id)
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white"
                                            >
                                                <X className="w-3 h-3" />
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="flex-1 min-h-0 bg-black/40">
                                {activeTab ? (
                                    <CodeMirror
                                        value={activeTab.content}
                                        height="100%"
                                        theme={oneDark}
                                        extensions={editorExtensions}
                                        onChange={updateTabContent}
                                        basicSetup={{
                                            lineNumbers: true,
                                            highlightActiveLine: true,
                                            highlightSelectionMatches: true,
                                            foldGutter: false
                                        }}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
                                        <div className="text-lg font-semibold text-white/80">Workspace ready</div>
                                        <div className="text-sm max-w-md">
                                            Select a file from the left panel, or create a new file to start editing.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {viewTab === 'council' && renderCouncil()}
                    {viewTab === 'logs' && renderLogs()}

                    {viewTab === 'editor' && (
                        <div className="px-4 py-2 border-t border-white/5 bg-black/20 text-xs text-muted-foreground flex items-center justify-between">
                            <span className="truncate">{statusText}</span>
                            <span className="text-muted-foreground/70">
                                {activeMount ? `${activeMount.name} (${activeMount.type})` : 'No mount'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Agent Panel */}
                {showAgentPanel && (
                    <div
                        className="border-l border-border/50 bg-muted/10 flex flex-col overflow-hidden"
                        style={{ width: `${agentPanelWidth}%`, minWidth: '320px', maxWidth: '500px' }}
                    >
                        {/* Panel Header with Tabs */}
                        <div className="border-b border-border/50">
                            <div className="px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary" />
                                    <span className="text-sm font-bold">AI Asistan</span>
                                </div>
                                <button
                                    onClick={() => setShowAgentPanel(false)}
                                    className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {/* Panel Tabs */}
                            <div className="flex px-4 pb-0">
                                {(['chat', 'council', 'logs'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setViewTab(tab === 'chat' ? 'editor' : tab)}
                                        className={cn(
                                            "px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px",
                                            (viewTab === 'editor' && tab === 'chat') || viewTab === tab
                                                ? "border-primary text-primary"
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {tab === 'chat' ? 'Sohbet' : tab === 'council' ? 'Konsey' : 'Günlükler'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Chat Tab Content */}
                        {viewTab === 'editor' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Model Selector */}
                                <div className="px-4 py-3 border-b border-border/30">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Model</label>
                                    <select className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2.5 text-sm text-foreground">
                                        <option value="gpt-4o">GPT-4o</option>
                                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                                        <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                                        <option value="gemini-pro">Gemini Pro</option>
                                    </select>
                                </div>

                                {/* Chat Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <div className="text-center text-sm text-muted-foreground py-8">
                                        <div className="text-4xl mb-2">💬</div>
                                        <p>Proje hakkında sorular sorun</p>
                                        <p className="text-xs mt-1">AI asistanınız size yardımcı olacak</p>
                                    </div>
                                </div>

                                {/* Chat Input */}
                                <div className="p-4 border-t border-border/30">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={agentChatMessage}
                                            onChange={(e) => setAgentChatMessage(e.target.value)}
                                            placeholder="Mesajınızı yazın..."
                                            className="flex-1 bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                        <button
                                            onClick={() => {
                                                if (agentChatMessage.trim()) {
                                                    logActivity('AI Chat', agentChatMessage)
                                                    setAgentChatMessage('')
                                                }
                                            }}
                                            className="px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                                        >
                                            Gönder
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Council Tab Content */}
                        {viewTab === 'council' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Council Mode Toggle */}
                                <div className="px-4 py-4 border-b border-border/30">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-foreground">Konsey Modu</div>
                                            <div className="text-xs text-muted-foreground">Çoklu AI işbirliği</div>
                                        </div>
                                        <button
                                            onClick={toggleCouncil}
                                            className={cn(
                                                "relative w-12 h-6 rounded-full transition-all",
                                                councilEnabled
                                                    ? "bg-emerald-500"
                                                    : "bg-muted/40"
                                            )}
                                        >
                                            <span className={cn(
                                                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                                                councilEnabled ? "left-6" : "left-0.5"
                                            )} />
                                        </button>
                                    </div>
                                </div>

                                {/* Agent List */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Aktif Modeller</div>
                                    {agents.filter(a => a.enabled).map((agent) => (
                                        <div key={agent.id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-3 w-3 rounded-full",
                                                    agent.status === 'ready' ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-white">{agent.name}</div>
                                                </div>
                                                <button className="text-xs text-muted-foreground hover:text-red-400 transition-colors">
                                                    Kaldır
                                                </button>
                                            </div>
                                            <div className="text-xs text-muted-foreground">{agent.role}</div>
                                            <select className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-foreground">
                                                <option>GPT-4o</option>
                                                <option>Claude 3.5 Sonnet</option>
                                                <option>Gemini Pro</option>
                                                <option>Llama 3.1</option>
                                            </select>
                                        </div>
                                    ))}

                                    <button
                                        onClick={addAgent}
                                        className="w-full px-4 py-3 rounded-xl text-sm font-semibold border border-dashed border-white/20 text-muted-foreground hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Model Ekle
                                    </button>
                                </div>

                                {/* Run Council Button */}
                                <div className="p-4 border-t border-border/30">
                                    <button
                                        onClick={runCouncil}
                                        disabled={!councilEnabled}
                                        className={cn(
                                            "w-full px-4 py-3.5 rounded-xl text-sm font-bold transition-all",
                                            councilEnabled
                                                ? "bg-gradient-to-r from-primary to-purple-600 text-white hover:opacity-90"
                                                : "bg-muted/20 text-muted-foreground cursor-not-allowed"
                                        )}
                                    >
                                        Konseyi Başlat
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Logs Tab Content */}
                        {viewTab === 'logs' && (
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Aktivite Günlüğü</div>
                                {activityLog.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground py-8">
                                        <div className="text-4xl mb-2">📋</div>
                                        <p>Henüz aktivite yok</p>
                                    </div>
                                ) : (
                                    activityLog.map((entry) => (
                                        <div key={entry.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-white">{entry.title}</span>
                                                <span className="text-xs text-zinc-500">
                                                    {entry.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {entry.detail && (
                                                <div className="text-xs text-muted-foreground mt-1 truncate">{entry.detail}</div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Terminal Panel */}
            <TerminalPanel
                isOpen={showTerminal}
                onToggle={() => setShowTerminal(!showTerminal)}
                height={terminalHeight}
                onHeightChange={setTerminalHeight}
                projectPath={project.path}
            />

            {notice && (
                <div className="fixed bottom-6 right-6 z-50">
                    <div
                        className={cn(
                            "px-4 py-3 rounded-xl border shadow-xl text-sm font-semibold",
                            notice.type === 'success' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
                            notice.type === 'error' && "bg-red-500/10 border-red-500/20 text-red-300",
                            notice.type === 'info' && "bg-white/5 border-white/10 text-white/80"
                        )}
                    >
                        {notice.message}
                    </div>
                </div>
            )}

            {entryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEntryModal} />
                    <div className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-bold text-white">
                                {entryModal.type === 'createFile' && 'New File'}
                                {entryModal.type === 'createFolder' && 'New Folder'}
                                {entryModal.type === 'rename' && 'Rename'}
                                {entryModal.type === 'delete' && 'Delete'}
                                {entryModal.type === 'search' && 'Search Files'}
                            </div>
                            <button onClick={closeEntryModal} className="p-1 rounded-lg hover:bg-white/10">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        {entryModal.type !== 'delete' && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase">
                                    {entryModal.type === 'search' ? 'Search query' : 'Name'}
                                </label>
                                <input
                                    value={entryName}
                                    onChange={(event) => setEntryName(event.target.value)}
                                    placeholder={
                                        entryModal.type === 'createFile' ? 'example.ts' :
                                            entryModal.type === 'search' ? 'Enter search term...' :
                                                'folder-name'
                                    }
                                    className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') submitEntryModal()
                                    }}
                                />
                                {entryModal.type === 'rename' && entryModal.entry && (
                                    <div className="text-xs text-zinc-500">Current: {entryModal.entry.name}</div>
                                )}
                            </div>
                        )}

                        {entryModal.type === 'delete' && entryModal.entry && (
                            <div className="text-sm text-muted-foreground">
                                Delete {entryModal.entry.isDirectory ? 'folder' : 'file'} "{entryModal.entry.name}"?
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-end gap-2">
                            <button
                                onClick={closeEntryModal}
                                className="px-4 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitEntryModal}
                                disabled={entryBusy}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-xs font-bold transition-colors",
                                    entryModal.type === 'delete'
                                        ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                        : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                                )}
                            >
                                {entryModal.type === 'delete' ? 'Delete' : entryModal.type === 'rename' ? 'Rename' : entryModal.type === 'search' ? 'Search' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMountModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMountModal(false)} />
                    <div className="relative w-full max-w-lg bg-popover border border-border rounded-3xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-lg font-bold text-foreground">Add Mount</div>
                                <div className="text-xs text-muted-foreground">Attach local or SSH workspace.</div>
                            </div>
                            <button onClick={() => setShowMountModal(false)} className="p-2 rounded-full hover:bg-muted/20">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <button
                                onClick={() => setMountForm((prev) => ({ ...prev, type: 'local' }))}
                                className={cn("px-3 py-2 rounded-lg text-xs font-semibold border", mountForm.type === 'local' ? "bg-primary/20 border-primary/30 text-primary" : "border-white/10 text-muted-foreground")}
                            >
                                Local
                            </button>
                            <button
                                onClick={() => setMountForm((prev) => ({ ...prev, type: 'ssh' }))}
                                className={cn("px-3 py-2 rounded-lg text-xs font-semibold border", mountForm.type === 'ssh' ? "bg-primary/20 border-primary/30 text-primary" : "border-white/10 text-muted-foreground")}
                            >
                                SSH
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">Name</label>
                                <input
                                    className="input-field w-full"
                                    value={mountForm.name}
                                    onChange={(e) => setMountForm((prev) => ({ ...prev, name: e.target.value }))}
                                    placeholder="Workspace name"
                                />
                            </div>

                            {mountForm.type === 'local' ? (
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Local Path</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="input-field flex-1"
                                            value={mountForm.rootPath}
                                            onChange={(e) => setMountForm((prev) => ({ ...prev, rootPath: e.target.value }))}
                                            placeholder="C:\\path\\to\\project"
                                        />
                                        <button onClick={pickLocalFolder} className="btn-ghost">Browse</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Host</label>
                                            <input
                                                className="input-field w-full"
                                                value={mountForm.host}
                                                onChange={(e) => setMountForm((prev) => ({ ...prev, host: e.target.value }))}
                                                placeholder="10.0.0.2"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Port</label>
                                            <input
                                                className="input-field w-full"
                                                value={mountForm.port}
                                                onChange={(e) => setMountForm((prev) => ({ ...prev, port: e.target.value }))}
                                                placeholder="22"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Username</label>
                                            <input
                                                className="input-field w-full"
                                                value={mountForm.username}
                                                onChange={(e) => setMountForm((prev) => ({ ...prev, username: e.target.value }))}
                                                placeholder="root"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Root Path</label>
                                            <input
                                                className="input-field w-full"
                                                value={mountForm.rootPath}
                                                onChange={(e) => setMountForm((prev) => ({ ...prev, rootPath: e.target.value }))}
                                                placeholder="/var/www/app"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setMountForm((prev) => ({ ...prev, authType: 'password' }))}
                                            className={cn("px-3 py-2 rounded-lg text-xs font-semibold border", mountForm.authType === 'password' ? "bg-white/10 border-white/20 text-white" : "border-white/10 text-muted-foreground")}
                                        >
                                            Password
                                        </button>
                                        <button
                                            onClick={() => setMountForm((prev) => ({ ...prev, authType: 'key' }))}
                                            className={cn("px-3 py-2 rounded-lg text-xs font-semibold border", mountForm.authType === 'key' ? "bg-white/10 border-white/20 text-white" : "border-white/10 text-muted-foreground")}
                                        >
                                            SSH Key
                                        </button>
                                    </div>

                                    {mountForm.authType === 'password' ? (
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Password</label>
                                            <input
                                                type="password"
                                                className="input-field w-full"
                                                value={mountForm.password}
                                                onChange={(e) => setMountForm((prev) => ({ ...prev, password: e.target.value }))}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Private Key</label>
                                            <textarea
                                                className="input-field w-full min-h-32 resize-none"
                                                value={mountForm.privateKey}
                                                onChange={(e) => setMountForm((prev) => ({ ...prev, privateKey: e.target.value }))}
                                                placeholder="-----BEGIN PRIVATE KEY-----"
                                            />
                                            <label className="text-xs text-muted-foreground">Passphrase (optional)</label>
                                            <input
                                                type="password"
                                                className="input-field w-full"
                                                value={mountForm.passphrase}
                                                onChange={(e) => setMountForm((prev) => ({ ...prev, passphrase: e.target.value }))}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-6">
                            <button onClick={() => setShowMountModal(false)} className="btn-ghost">Cancel</button>
                            <button onClick={addMount} className="btn-primary">Add Mount</button>
                        </div>
                    </div>
                </div>
            )}

            {explorerPortal}
        </div>
    )
}
