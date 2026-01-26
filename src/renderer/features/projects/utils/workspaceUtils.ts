import { FileNode } from '@renderer/features/projects/components/WorkspaceTreeItem';

import { WorkspaceMount } from '@/types';

export const joinPath = (base: string, name: string, type: WorkspaceMount['type']) => {
    const sep = type === 'ssh' ? '/' : (base.includes('\\') ? '\\' : '/');
    if (base.endsWith(sep)) {return `${base}${name}`;}
    return `${base}${sep}${name}`;
};

export const sortNodes = (nodes: FileNode[]) => (
    nodes.slice().sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {return a.name.localeCompare(b.name);}
        return a.isDirectory ? -1 : 1;
    })
);
