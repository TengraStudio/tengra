import * as path from 'path';

function normalizeForComparison(inputPath: string): string {
    const normalized = path.normalize(inputPath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function isWithinRoot(candidatePath: string, rootPath: string): boolean {
    const normalizedCandidate = normalizeForComparison(path.resolve(candidatePath));
    const normalizedRoot = normalizeForComparison(path.resolve(rootPath));

    const relative = path.relative(normalizedRoot, normalizedCandidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function assertPathWithinRoot(candidatePath: string, rootPath: string, label: string = 'path'): string {
    const resolvedPath = path.resolve(candidatePath);
    if (!isWithinRoot(resolvedPath, rootPath)) {
        throw new Error(`Unauthorized ${label} access outside root: ${candidatePath}`);
    }
    return resolvedPath;
}
