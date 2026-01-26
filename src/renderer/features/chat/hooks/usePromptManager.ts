import { useEffect,useState } from 'react';

import { Prompt } from '@/types';

export const usePromptManager = () => {
    const [prompts, setPrompts] = useState<Prompt[]>([]);

    useEffect(() => {
        const loadPrompts = async () => {
            try {
                const allPrompts = await window.electron.db.getPrompts();
                setPrompts(allPrompts as Prompt[]);
            } catch (error) {
                console.error('Failed to load prompts:', error);
            }
        };
        void loadPrompts();
    }, []);

    const createPrompt = async (title: string, content: string, tags: string[] = []) => {
        try {
            const newPrompt = await window.electron.db.createPrompt(title, content, tags);
            setPrompts(prev => [...prev, newPrompt as Prompt]);
        } catch (error) {
            console.error('Failed to create prompt:', error);
        }
    };

    const deletePrompt = async (id: string) => {
        try {
            await window.electron.db.deletePrompt(id);
            setPrompts(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error('Failed to delete prompt:', error);
        }
    };

    const updatePrompt = async (id: string, updates: Partial<Prompt>) => {
        try {
            await window.electron.db.updatePrompt(id, updates);
            setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        } catch (error) {
            console.error('Failed to update prompt:', error);
        }
    };

    return {
        prompts,
        createPrompt,
        deletePrompt,
        updatePrompt
    };
};
