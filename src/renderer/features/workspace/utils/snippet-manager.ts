export interface WorkspaceSnippet {
    id: string;
    name: string;
    language: string;
    workspaceKey: string;
    content: string;
    createdAt: number;
}

const SNIPPETS_STORAGE_KEY = 'workspace.editor.snippets.v1';

function parseWorkspaceSnippets(raw: string | null): WorkspaceSnippet[] {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw) as WorkspaceSnippet[];
        return parsed.filter(
            snippet =>
                typeof snippet.id === 'string'
                && typeof snippet.name === 'string'
                && typeof snippet.language === 'string'
                && typeof snippet.workspaceKey === 'string'
                && typeof snippet.content === 'string'
        );
    } catch {
        return [];
    }
}

export function loadWorkspaceSnippets(): WorkspaceSnippet[] {
    return parseWorkspaceSnippets(localStorage.getItem(SNIPPETS_STORAGE_KEY));
}

export function saveWorkspaceSnippets(snippets: WorkspaceSnippet[]): void {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
}

export function filterWorkspaceSnippets(
    snippets: WorkspaceSnippet[],
    language: string,
    workspaceKey: string
): WorkspaceSnippet[] {
    return snippets.filter(
        snippet =>
            (snippet.language === language || snippet.language === 'all')
            && (snippet.workspaceKey === workspaceKey || snippet.workspaceKey === 'global')
    );
}

export function createWorkspaceShareCode(snippet: WorkspaceSnippet): string {
    return btoa(unescape(encodeURIComponent(JSON.stringify(snippet))));
}

export function parseWorkspaceShareCode(shareCode: string): WorkspaceSnippet | null {
    try {
        const decoded = decodeURIComponent(escape(atob(shareCode)));
        const snippet = JSON.parse(decoded) as WorkspaceSnippet;
        if (
            typeof snippet.name !== 'string'
            || typeof snippet.content !== 'string'
            || typeof snippet.language !== 'string'
        ) {
            return null;
        }
        return {
            id: `${Date.now()}`,
            name: snippet.name,
            content: snippet.content,
            language: snippet.language,
            workspaceKey: snippet.workspaceKey || 'global',
            createdAt: Date.now(),
        };
    } catch {
        return null;
    }
}
export const filterSnippets = filterWorkspaceSnippets;
export const createShareCode = createWorkspaceShareCode;
export const parseShareCode = parseWorkspaceShareCode;
