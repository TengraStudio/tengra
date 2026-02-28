import { IpcValue } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface IdeasBridge {
    createSession: (config: {
        model: string;
        provider: string;
        categories: string[];
        maxIdeas: number;
    }) => Promise<IpcValue>;
    getSession: (id: string) => Promise<IpcValue>;
    getSessions: () => Promise<IpcValue[]>;
    cancelSession: (id: string) => Promise<{ success: boolean }>;
    generateMarketPreview: (
        categories: string[]
    ) => Promise<{ success: boolean; data?: IpcValue[] }>;
    startResearch: (sessionId: string) => Promise<{ success: boolean; data?: IpcValue }>;
    startGeneration: (sessionId: string) => Promise<{ success: boolean }>;
    enrichIdea: (ideaId: string) => Promise<{ success: boolean; data?: IpcValue }>;
    getIdea: (id: string) => Promise<IpcValue>;
    getIdeas: (sessionId?: string) => Promise<IpcValue[]>;
    regenerateIdea: (ideaId: string) => Promise<{ success: boolean; idea?: IpcValue }>;
    approveIdea: (
        ideaId: string,
        projectPath: string,
        selectedName?: string
    ) => Promise<{ success: boolean; project?: IpcValue }>;
    rejectIdea: (ideaId: string) => Promise<{ success: boolean }>;
    canGenerateLogo: () => Promise<boolean>;
    generateLogo: (
        ideaId: string,
        prompt: string
    ) => Promise<{ success: boolean; logoPath?: string }>;
    queryResearch: (
        ideaId: string,
        question: string
    ) => Promise<{ success: boolean; answer: string }>;
    deepResearch: (
        topic: string,
        category: string
    ) => Promise<{ success: boolean; report?: IpcValue }>;
    validateIdea: (
        title: string,
        description: string,
        category: string
    ) => Promise<{ success: boolean; validation?: IpcValue }>;
    clearResearchCache: () => Promise<{ success: boolean }>;
    scoreIdea: (ideaId: string) => Promise<{ success: boolean; score?: IpcValue }>;
    rankIdeas: (ideaIds: string[]) => Promise<{ success: boolean; ranked?: IpcValue[] }>;
    compareIdeas: (
        ideaId1: string,
        ideaId2: string
    ) => Promise<{ success: boolean; comparison?: IpcValue }>;
    quickScore: (
        title: string,
        description: string,
        category: string
    ) => Promise<{ success: boolean; score?: number }>;
    deleteIdea: (ideaId: string) => Promise<{ success: boolean }>;
    deleteSession: (sessionId: string) => Promise<{ success: boolean }>;
    archiveIdea: (ideaId: string) => Promise<{ success: boolean }>;
    restoreIdea: (ideaId: string) => Promise<{ success: boolean }>;
    getArchivedIdeas: (sessionId?: string) => Promise<IpcValue[]>;
    onResearchProgress: (callback: (progress: IpcValue) => void) => () => void;
    onIdeaProgress: (callback: (progress: IpcValue) => void) => () => void;
    onDeepResearchProgress: (callback: (progress: IpcValue) => void) => () => void;
}

export function createIdeasBridge(ipc: IpcRenderer): IdeasBridge {
    return {
        createSession: config => ipc.invoke('ideas:createSession', config),
        getSession: id => ipc.invoke('ideas:getSession', id),
        getSessions: () => ipc.invoke('ideas:getSessions'),
        cancelSession: id => ipc.invoke('ideas:cancelSession', id),
        generateMarketPreview: categories =>
            ipc.invoke('ideas:generateMarketPreview', categories),
        startResearch: sessionId => ipc.invoke('ideas:startResearch', sessionId),
        startGeneration: sessionId => ipc.invoke('ideas:startGeneration', sessionId),
        enrichIdea: ideaId => ipc.invoke('ideas:enrichIdea', ideaId),
        getIdea: id => ipc.invoke('ideas:getIdea', id),
        getIdeas: sessionId => ipc.invoke('ideas:getIdeas', sessionId),
        regenerateIdea: ideaId => ipc.invoke('ideas:regenerateIdea', ideaId),
        approveIdea: (ideaId, projectPath, selectedName) =>
            ipc.invoke('ideas:approveIdea', ideaId, projectPath, selectedName),
        rejectIdea: ideaId => ipc.invoke('ideas:rejectIdea', ideaId),
        canGenerateLogo: () => ipc.invoke('ideas:canGenerateLogo'),
        generateLogo: (ideaId, prompt) =>
            ipc.invoke('ideas:generateLogo', ideaId, prompt),
        queryResearch: (ideaId, question) =>
            ipc.invoke('ideas:queryResearch', ideaId, question),
        deepResearch: (topic, category) =>
            ipc.invoke('ideas:deepResearch', topic, category),
        validateIdea: (title, description, category) =>
            ipc.invoke('ideas:validateIdea', title, description, category),
        clearResearchCache: () => ipc.invoke('ideas:clearResearchCache'),
        scoreIdea: ideaId => ipc.invoke('ideas:scoreIdea', ideaId),
        rankIdeas: ideaIds => ipc.invoke('ideas:rankIdeas', ideaIds),
        compareIdeas: (ideaId1, ideaId2) =>
            ipc.invoke('ideas:compareIdeas', ideaId1, ideaId2),
        quickScore: (title, description, category) =>
            ipc.invoke('ideas:quickScore', title, description, category),
        deleteIdea: ideaId => ipc.invoke('ideas:deleteIdea', ideaId),
        deleteSession: sessionId => ipc.invoke('ideas:deleteSession', sessionId),
        archiveIdea: ideaId => ipc.invoke('ideas:archiveIdea', ideaId),
        restoreIdea: ideaId => ipc.invoke('ideas:restoreIdea', ideaId),
        getArchivedIdeas: sessionId =>
            ipc.invoke('ideas:getArchivedIdeas', sessionId),
        onResearchProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: IpcValue) => callback(progress);
            ipc.on('ideas:research-progress', listener);
            return () => ipc.removeListener('ideas:research-progress', listener);
        },
        onIdeaProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: IpcValue) => callback(progress);
            ipc.on('ideas:idea-progress', listener);
            return () => ipc.removeListener('ideas:idea-progress', listener);
        },
        onDeepResearchProgress: callback => {
            const listener = (_event: IpcRendererEvent, progress: IpcValue) => callback(progress);
            ipc.on('ideas:deep-research-progress', listener);
            return () => ipc.removeListener('ideas:deep-research-progress', listener);
        },
    };
}
