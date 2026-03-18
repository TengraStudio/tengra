import { WorkspaceEntry } from '@/types';

export interface ContextMenuAction {
    type: 'createFile' | 'createFolder' | 'rename' | 'delete';
    entry: WorkspaceEntry;
}

export interface ContextMenuState {
    x: number;
    y: number;
    entry?: WorkspaceEntry;
    mountId?: string;
}

export type MountFileEntry = { name: string; isDirectory: boolean };
