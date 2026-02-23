export interface ProjectSnippet {
    id: string;
    name: string;
    language: string;
    projectKey: string;
    content: string;
    createdAt: number;
}

const SNIPPETS_STORAGE_KEY = 'workspace.editor.snippets.v1';

function parseSnippets(raw: string | null): ProjectSnippet[] {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw) as ProjectSnippet[];
        return parsed.filter(
            snippet =>
                typeof snippet.id === 'string'
                && typeof snippet.name === 'string'
                && typeof snippet.language === 'string'
                && typeof snippet.projectKey === 'string'
                && typeof snippet.content === 'string'
        );
    } catch {
        return [];
    }
}

export function loadProjectSnippets(): ProjectSnippet[] {
    return parseSnippets(localStorage.getItem(SNIPPETS_STORAGE_KEY));
}

export function saveProjectSnippets(snippets: ProjectSnippet[]): void {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
}

export function filterSnippets(
    snippets: ProjectSnippet[],
    language: string,
    projectKey: string
): ProjectSnippet[] {
    return snippets.filter(
        snippet =>
            (snippet.language === language || snippet.language === 'all')
            && (snippet.projectKey === projectKey || snippet.projectKey === 'global')
    );
}

export function createShareCode(snippet: ProjectSnippet): string {
    return btoa(unescape(encodeURIComponent(JSON.stringify(snippet))));
}

export function parseShareCode(shareCode: string): ProjectSnippet | null {
    try {
        const decoded = decodeURIComponent(escape(atob(shareCode)));
        const snippet = JSON.parse(decoded) as ProjectSnippet;
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
            projectKey: snippet.projectKey || 'global',
            createdAt: Date.now(),
        };
    } catch {
        return null;
    }
}
