/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

export function isPathAllowed(absolutePath: string, allowedRoots: string[]): boolean {
    const normalizedPath = path.resolve(absolutePath);
    return allowedRoots.some(root => isWithinRoot(normalizedPath, root));
}

export function assertPathWithinRoot(candidatePath: string, rootPath: string, label: string = 'path'): string {
    const resolvedPath = path.resolve(candidatePath);
    if (!isWithinRoot(resolvedPath, rootPath)) {
        throw new Error(`Unauthorized ${label} access outside root: ${candidatePath}`);
    }
    return resolvedPath;
}

