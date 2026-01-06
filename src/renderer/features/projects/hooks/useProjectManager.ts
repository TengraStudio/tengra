import { useState, useCallback, useEffect } from 'react'
import { Project, Folder, TerminalTab } from '@/types'
import { v4 as uuidv4 } from 'uuid'

export function useProjectManager() {
    const [projects, setProjects] = useState<Project[]>([])
    const [folders, setFolders] = useState<Folder[]>([])
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([])
    const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)

    const handleOpenTerminal = useCallback((name: string, command?: string) => {
        const id = uuidv4()
        const newTab: TerminalTab = {
            id,
            name: name || 'Terminal',
            type: 'bash',
            status: 'idle',
            history: [],
            command: command || ''
        }
        setTerminalTabs(prev => [...prev, newTab])
        setActiveTerminalId(id)
    }, [])

    const loadFolders = useCallback(async () => {
        try {
            const data = await window.electron.db.getFolders()
            setFolders(data || [])
        } catch (e) {
            console.error('Failed to load folders:', e)
        }
    }, [])

    const loadProjects = useCallback(async () => {
        try {
            const data = await window.electron.db.getProjects()
            const normalized = (Array.isArray(data) ? data : []).map((project: any) => {
                let councilConfig = project.councilConfig
                if (typeof councilConfig === 'string') {
                    try { councilConfig = JSON.parse(councilConfig) } catch { councilConfig = null }
                }
                let mounts = project.mounts
                if (typeof mounts === 'string') {
                    try { mounts = JSON.parse(mounts) } catch { mounts = null }
                }

                const createdAt = project.createdAt instanceof Date
                    ? project.createdAt
                    : new Date(project.createdAt || Date.now())

                if (!Array.isArray(mounts) || mounts.length === 0) {
                    if (project.path) {
                        mounts = [{ id: `local-${project.id}`, name: 'Local', type: 'local', rootPath: project.path }]
                    } else {
                        mounts = []
                    }
                }

                return {
                    id: project.id,
                    title: project.title || project.name || 'Yeni Proje',
                    description: project.description || '',
                    path: project.path || '',
                    mounts,
                    createdAt,
                    chatIds: Array.isArray(project.chatIds) ? project.chatIds : [],
                    councilConfig: councilConfig && typeof councilConfig === 'object'
                        ? councilConfig
                        : { enabled: false, members: [], consensusThreshold: 0.7 },
                    status: project.status || 'active'
                } as Project
            })
            setProjects(normalized)
        } catch (e) {
            console.error('Failed to load projects:', e)
        }
    }, [])

    const handleCreateFolder = async (name: string) => {
        try {
            await window.electron.db.createFolder(name)
            await loadFolders()
        } catch (e) {
            console.error('Failed to create folder:', e)
        }
    }

    const handleDeleteFolder = async (id: string, onFolderDeleted?: () => void) => {
        if (!confirm('Klasörü silmek istediğinize emin misiniz?')) return
        try {
            await window.electron.db.deleteFolder(id)
            await loadFolders()
            if (onFolderDeleted) onFolderDeleted()
        } catch (e) {
            console.error('Failed to delete folder:', e)
        }
    }

    useEffect(() => {
        loadFolders()
        loadProjects()
    }, [loadFolders, loadProjects])

    return {
        projects,
        setProjects,
        folders,
        setFolders,
        selectedProject,
        setSelectedProject,
        terminalTabs,
        setTerminalTabs,
        activeTerminalId,
        setActiveTerminalId,
        loadFolders,
        loadProjects,
        handleCreateFolder,
        handleDeleteFolder,
        handleOpenTerminal
    }
}
