import { FileNode } from '@renderer/features/workspace/components/WorkspaceTreeItem';

type GitTreeStatusPreviewEntry = {
    statuses: string[]
    path: string
    isDirectory: boolean
    isIgnored: boolean
};

type GitTreeStatusPreviewResponse = {
    success: boolean
    isRepository?: boolean
    repoRoot?: string
    targetPath?: string
    refreshedAt?: number
    entries?: GitTreeStatusPreviewEntry[]
    error?: string
};

const GIT_TREE_STATUS_PREVIEW_TTL_MS = 30_000;
const previewCache = new Map<
    string,
    { expiresAt: number; entries: GitTreeStatusPreviewEntry[]; repoRoot: string }
>();

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');

const toRepoRelative = (repoRoot: string, absolutePath: string): string => {
    const root = normalizePath(repoRoot);
    const candidate = normalizePath(absolutePath);
    if (candidate.toLowerCase() === root.toLowerCase()) {
        return '';
    }
    const prefix = `${root}/`;
    if (candidate.toLowerCase().startsWith(prefix.toLowerCase())) {
        return candidate.slice(prefix.length);
    }
    return candidate;
};

const toBadge = (statuses: string[]): FileNode['gitStatus'] => {
    if (statuses.some(code => code.includes('U') || code === 'AA' || code === 'DD')) { return 'U'; }
    if (statuses.some(code => code.includes('M'))) { return 'M'; }
    if (statuses.some(code => code.includes('A'))) { return 'A'; }
    if (statuses.some(code => code.includes('D'))) { return 'D'; }
    if (statuses.some(code => code.includes('R') || code.includes('C'))) { return 'R'; }
    if (statuses.some(code => code === '??')) { return '?'; }
    if (statuses.some(code => code.includes('T'))) { return 'T'; }
    return undefined;
};

export async function applyGitTreeStatus(
    cwd: string,
    directoryPath: string,
    nodes: FileNode[]
): Promise<FileNode[]> {
    if (nodes.length === 0) {
        return nodes;
    }

    const cacheKey = `${cwd}::${directoryPath}`;
    const cachedEntry = previewCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
        return applyPreviewEntries(nodes, cachedEntry.repoRoot, cachedEntry.entries);
    }

    let response: GitTreeStatusPreviewResponse;
    try {
        response = await window.electron.ipcRenderer.invoke(
            'git:getTreeStatusPreview',
            cwd,
            directoryPath
        ) as GitTreeStatusPreviewResponse;
    } catch {
        return nodes;
    }

    if (
        !response.success ||
        !response.isRepository ||
        !response.repoRoot ||
        !Array.isArray(response.entries)
    ) {
        return nodes;
    }

    previewCache.set(cacheKey, {
        expiresAt: Date.now() + GIT_TREE_STATUS_PREVIEW_TTL_MS,
        entries: response.entries,
        repoRoot: response.repoRoot,
    });
    return applyPreviewEntries(nodes, response.repoRoot, response.entries);
}

function applyPreviewEntries(
    nodes: FileNode[],
    repoRoot: string,
    entries: GitTreeStatusPreviewEntry[]
): FileNode[] {
    const entryMap = new Map(entries.map(entry => [normalizePath(entry.path).toLowerCase(), entry]));

    return nodes.map(node => {
        const relativeNodePath = normalizePath(toRepoRelative(repoRoot, node.path)).toLowerCase();
        const previewEntry = entryMap.get(relativeNodePath);
        if (!previewEntry) {
            return {
                ...node,
                gitStatus: undefined,
                gitRawStatus: undefined,
                isGitIgnored: false,
            };
        }

        return {
            ...node,
            isGitIgnored: previewEntry.isIgnored,
            gitRawStatus: previewEntry.statuses[0],
            gitStatus: toBadge(previewEntry.statuses),
        };
    });
}
