import { IpcRendererEvent } from 'electron';
import { useEffect, useState } from 'react';

export function useSidebarIPC() {
    const [localGeneratingMap, setLocalGeneratingMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const handleStarted = (_: IpcRendererEvent, data: { chatId: string }) => {
            setLocalGeneratingMap(prev => ({ ...prev, [data.chatId]: true }));
        };

        const handleUpdate = (_: IpcRendererEvent, data: { chatId: string }) => {
            setLocalGeneratingMap(prev => ({ ...prev, [data.chatId]: true }));
        };

        const handleStatus = (_: IpcRendererEvent, data: { chatId: string, isGenerating: boolean }) => {
            setLocalGeneratingMap(prev => ({ ...prev, [data.chatId]: data.isGenerating }));
        };

        window.electron.ipcRenderer.on('chat-started', handleStarted);
        window.electron.ipcRenderer.on('chat-generation-updated', handleUpdate);
        window.electron.ipcRenderer.on('chat-generation-status', handleStatus);

        return () => {
            window.electron.ipcRenderer.off('chat-started', handleStarted);
            window.electron.ipcRenderer.off('chat-generation-updated', handleUpdate);
            window.electron.ipcRenderer.off('chat-generation-status', handleStatus);
        };
    }, []);

    return { localGeneratingMap };
}
