import { useCallback,useState } from 'react'

import { Folder } from '@/types'


export const useFolderManager = () => {
    const [folders, setFolders] = useState<Folder[]>([])

    const loadFolders = useCallback(async () => {
        try {
            const data = await window.electron.db.getFolders()
            setFolders(data as Folder[])
        } catch (error) {
            console.error('Failed to load folders:', error)
        }
    }, [])

    const createFolder = useCallback(async (name: string, color?: string) => {
        try {
            const newFolder = await window.electron.db.createFolder(name, color)
            setFolders(prev => [...prev, newFolder as Folder])
            return newFolder as Folder
        } catch (error) {
            console.error('Failed to create folder:', error)
            return null
        }
    }, [])

    const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
        try {
            await window.electron.db.updateFolder(id, updates)
            setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
        } catch (error) {
            console.error('Failed to update folder:', error)
        }
    }, [])

    const deleteFolder = useCallback(async (id: string, onFolderDeleted?: (id: string) => void) => {
        try {
            await window.electron.db.deleteFolder(id)
            setFolders(prev => prev.filter(f => f.id !== id))
            if (onFolderDeleted) { onFolderDeleted(id) }
        } catch (error) {
            console.error('Failed to delete folder:', error)
        }
    }, [])

    return {
        folders,
        setFolders,
        loadFolders,
        createFolder,
        updateFolder,
        deleteFolder
    }
}
