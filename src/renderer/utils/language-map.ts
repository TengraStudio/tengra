
export const getLanguageFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    const map: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'json': 'json',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'less': 'less',
        'md': 'markdown',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'sql': 'sql',
        'sh': 'shell',
        'bash': 'shell',
        'zsh': 'shell',
        'go': 'go',
        'rs': 'rust',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'lua': 'lua',
        'r': 'r',
        'swift': 'swift',
        'kt': 'kotlin',
        'dart': 'dart',
        'vue': 'html', // Fallback for vue files if vue lang not avail
        'svelte': 'html' // Fallback
    };

    return map[ext] || 'plaintext';
};

export const normalizeLanguage = (lang: string): string => {
    const map: Record<string, string> = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'sh': 'shell',
        'bash': 'shell',
        'zsh': 'shell',
        'cs': 'csharp',
        'rb': 'ruby',
        'rs': 'rust',
        'yml': 'yaml',
        'tsx': 'typescript',
        'jsx': 'javascript',
        // Add more direct mappings if needed
    };
    return map[lang.toLowerCase()] || lang.toLowerCase();
};
