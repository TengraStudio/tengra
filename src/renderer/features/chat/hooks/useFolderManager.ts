/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback,useState } from 'react';

import { Folder } from '@/types';
import { handleError } from '@/utils/error-handler.util';


export const useFolderManager = () => {
    const [folders, setFolders] = useState<Folder[]>([]);

    const loadFolders = useCallback(async () => {
        try {
            const data = await window.electron.db.getFolders();
            setFolders(data as Folder[]);
        } catch (error) {
            handleError(error as TypeAssertionValue, 'FolderManager.loadFolders');
        }
    }, []);

    const createFolder = useCallback(async (name: string, color?: string) => {
        try {
            const newFolder = await window.electron.db.createFolder(name, color);
            setFolders(prev => [...prev, newFolder as Folder]);
            return newFolder as Folder;
        } catch (error) {
            handleError(error as TypeAssertionValue, 'FolderManager.createFolder');
            return null;
        }
    }, []);

    const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
        try {
            await window.electron.db.updateFolder(id, updates);
            setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        } catch (error) {
            handleError(error as TypeAssertionValue, 'FolderManager.updateFolder');
        }
    }, []);

    const deleteFolder = useCallback(async (id: string, onFolderDeleted?: (id: string) => void) => {
        try {
            await window.electron.db.deleteFolder(id);
            setFolders(prev => prev.filter(f => f.id !== id));
            if (onFolderDeleted) { onFolderDeleted(id); }
        } catch (error) {
            handleError(error as TypeAssertionValue, 'FolderManager.deleteFolder');
        }
    }, []);

    return {
        folders,
        setFolders,
        loadFolders,
        createFolder,
        updateFolder,
        deleteFolder
    };
};

