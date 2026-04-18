/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FileNode } from '@renderer/features/workspace/components/WorkspaceTreeItem';

import { WorkspaceMount } from '@/types';

export const joinPath = (base: string, name: string, type: WorkspaceMount['type']) => {
    const sep = type === 'ssh' ? '/' : (base.includes('\\') ? '\\' : '/');
    if (base.endsWith(sep)) { return `${base}${name}`; }
    return `${base}${sep}${name}`;
};

export const sortNodes = (nodes: FileNode[]) => (
    nodes.slice().sort((a, b) => {
        if (a.isDirectory === b.isDirectory) { return a.name.localeCompare(b.name); }
        return a.isDirectory ? -1 : 1;
    })
);

export const getWorkspaceExplorerStorageKey = (
    workspaceId: string,
    mounts: WorkspaceMount[]
): string => {
    const workspaceSignature = mounts
        .map(mount => `${mount.type}:${mount.rootPath}`)
        .sort()
        .join('|');
    return `workspace.explorer.expanded.v1:${workspaceId}:${workspaceSignature}`;
};

export const getWorkspaceTreeStorageKey = (workspaceId: string): string =>
    `workspace.explorer.tree.v1:${workspaceId}`;

export const loadExpandedMountState = (storageKey: string): Record<string, boolean> => {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        return Object.entries(parsed).reduce<Record<string, boolean>>((acc, [key, value]) => {
            if (typeof value === 'boolean') {
                acc[key] = value;
            }
            return acc;
        }, {});
    } catch {
        return {};
    }
};

export const saveExpandedMountState = (
    storageKey: string,
    expandedMounts: Record<string, boolean>
): void => {
    localStorage.setItem(storageKey, JSON.stringify(expandedMounts));
};

export const loadExpandedTreeState = (storageKey: string): Record<string, boolean> =>
    loadExpandedMountState(storageKey);

export const saveExpandedTreeState = (
    storageKey: string,
    expandedNodes: Record<string, boolean>
): void => {
    localStorage.setItem(storageKey, JSON.stringify(expandedNodes));
};
