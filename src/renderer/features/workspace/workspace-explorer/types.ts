import { WorkspaceEntry, WorkspaceMountType } from '@/types';

export interface ContextMenuAction {
    type:
        | 'createFile'
        | 'createFolder'
        | 'rename'
        | 'delete'
        | 'stage'
        | 'unstage'
        | 'gitHistory';
    entry: WorkspaceEntry;
}

export interface ContextMenuState {
    x: number;
    y: number;
    entry?: WorkspaceEntry;
    mountId?: string;
    entryGitStatus?: string;
    entryGitRawStatus?: string;
    entryMountType?: WorkspaceMountType;
}

export type MountFileEntry = { name: string; isDirectory: boolean };
