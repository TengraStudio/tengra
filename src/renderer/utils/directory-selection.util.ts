export interface DirectorySelectionResult {
    success: boolean;
    path?: string;
}

export function normalizeDirectorySelectionResult(
    value: DirectorySelectionResult | string | null | undefined
): DirectorySelectionResult {
    if (typeof value === 'string') {
        return value.trim().length > 0 ? { success: true, path: value } : { success: false };
    }

    if (!value) {
        return { success: false };
    }

    if (typeof value.path === 'string' && value.path.trim().length > 0) {
        return { success: true, path: value.path };
    }

    return { success: Boolean(value.success) };
}
