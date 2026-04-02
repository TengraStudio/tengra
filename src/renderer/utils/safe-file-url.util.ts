function normalizeSafeFilePath(inputPath: string): string {
    const trimmedPath = inputPath.trim();
    if (!trimmedPath) {
        return '';
    }

    if (/^(https?:|data:|blob:)/i.test(trimmedPath)) {
        return trimmedPath;
    }

    if (/^safe-file:\/\//i.test(trimmedPath)) {
        return trimmedPath;
    }

    const normalizedSlashes = trimmedPath.replace(/\\/g, '/');
    const encodedPath = encodeURI(normalizedSlashes);
    if (/^[A-Za-z]:\//.test(normalizedSlashes)) {
        return `safe-file:///${encodedPath}`;
    }

    if (normalizedSlashes.startsWith('/')) {
        return `safe-file://${encodedPath}`;
    }

    return `safe-file:///${encodedPath}`;
}

export function toSafeFileUrl(inputPath: string | null | undefined): string | null {
    if (typeof inputPath !== 'string') {
        return null;
    }

    const normalizedUrl = normalizeSafeFilePath(inputPath);
    return normalizedUrl.length > 0 ? normalizedUrl : null;
}
