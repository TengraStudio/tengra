const SUPPORTED_CODE_EDITOR_LANGUAGES = new Set([
    'json',
    'markdown',
    'html',
    'css',
    'python',
    'typescript',
    'javascript',
]);

export type CodeEditorErrorCode =
    | 'CODE_EDITOR_INVALID_LANGUAGE'
    | 'CODE_EDITOR_INIT_FAILED';

export function sanitizeCodeEditorLanguage(raw: RendererDataValue): string {
    if (typeof raw !== 'string') {
        return 'javascript';
    }
    const normalized = raw.trim().toLowerCase();
    if (!normalized) {
        return 'javascript';
    }
    return SUPPORTED_CODE_EDITOR_LANGUAGES.has(normalized) ? normalized : 'javascript';
}
