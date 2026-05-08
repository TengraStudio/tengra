/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

export type WorkspaceInlineActionType = 'rename' | 'createFile' | 'createFolder';

