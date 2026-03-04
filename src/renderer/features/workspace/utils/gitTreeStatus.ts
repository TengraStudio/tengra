import { FileNode } from '@renderer/features/workspace/components/WorkspaceTreeItem';

type GitTreeStatusEntry = {
    status: string
    path: string
    isIgnored: boolean
};

type GitTreeStatusResponse = {
    success: boolean
    isRepository?: boolean
    repoRoot?: string
    targetPath?: string
    entries?: GitTreeStatusEntry[]
    error?: string
};

const SHOW_GIT_IGNORED = true;

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

    let response: GitTreeStatusResponse;
    try {
        response = await window.electron.ipcRenderer.invoke('git:getTreeStatus', cwd, directoryPath) as GitTreeStatusResponse;
    } catch {
        return nodes;
    }

    if (!response.success || !response.isRepository || !response.repoRoot || !Array.isArray(response.entries)) {
        return nodes;
    }

    const entries = response.entries;
    const repoRoot = response.repoRoot;
    const withGitMeta = nodes.map((node) => {
        const rel = toRepoRelative(repoRoot, node.path);
        const relNorm = normalizePath(rel).toLowerCase();

        const matches = entries.filter((entry) => {
            const entryPath = normalizePath(entry.path).toLowerCase();
            if (entryPath === relNorm) {
                return true;
            }
            return node.isDirectory && relNorm.length > 0 && entryPath.startsWith(`${relNorm}/`);
        });

        if (matches.length === 0) {
            return { ...node, gitStatus: undefined, gitRawStatus: undefined, isGitIgnored: false };
        }

        const nonIgnored = matches.filter(match => !match.isIgnored);
        const isIgnored = nonIgnored.length === 0 && matches.some(match => match.isIgnored);
        const statuses = nonIgnored.map(match => match.status);

        return {
            ...node,
            isGitIgnored: isIgnored,
            gitRawStatus: statuses[0],
            gitStatus: isIgnored ? 'I' : toBadge(statuses)
        };
    });

    if (SHOW_GIT_IGNORED) {
        return withGitMeta;
    }

    return withGitMeta.filter(node => !node.isGitIgnored);
}
