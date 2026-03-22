import type { WorkspaceEntry } from '@/types';

export interface WorkspaceRenamePlanItem {
    entry: WorkspaceEntry;
    newName: string;
    newPath: string;
}

export interface WorkspaceTransferPlanItem {
    entry: WorkspaceEntry;
    targetPath: string;
}

function getPathSeparator(entryPath: string): '/' | '\\' {
    return entryPath.includes('\\') ? '\\' : '/';
}

function getParentPath(entryPath: string): string {
    const separatorIndex = Math.max(entryPath.lastIndexOf('/'), entryPath.lastIndexOf('\\'));
    if (separatorIndex <= 0) {
        return '';
    }
    return entryPath.slice(0, separatorIndex);
}

function splitFileName(name: string): { stem: string; extension: string } {
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex <= 0) {
        return { stem: name, extension: '' };
    }
    return {
        stem: name.slice(0, lastDotIndex),
        extension: name.slice(lastDotIndex),
    };
}

function sortEntriesForDeterministicBulkActions(entries: WorkspaceEntry[]): WorkspaceEntry[] {
    return [...entries].sort((left, right) => left.path.localeCompare(right.path));
}

export function canUseSharedTargetDirectory(entries: WorkspaceEntry[]): boolean {
    if (entries.length === 0) {
        return false;
    }
    const mountId = entries[0]?.mountId;
    return entries.every(entry => entry.mountId === mountId);
}

export function buildWorkspaceBulkRenamePlan(
    entries: WorkspaceEntry[],
    baseName: string
): WorkspaceRenamePlanItem[] {
    const trimmedBaseName = baseName.trim();
    if (!trimmedBaseName) {
        return [];
    }

    const sortedEntries = sortEntriesForDeterministicBulkActions(entries);
    const baseNameParts = splitFileName(trimmedBaseName);
    const baseStem = baseNameParts.stem || trimmedBaseName;
    return sortedEntries.map((entry, index) => {
        const originalName = entry.isDirectory ? { stem: entry.name, extension: '' } : splitFileName(entry.name);
        const numberedStem = `${baseStem}-${index + 1}`;
        const nextName = `${numberedStem}${entry.isDirectory ? '' : originalName.extension}`;
        const parentPath = getParentPath(entry.path);
        const separator = getPathSeparator(entry.path);

        return {
            entry,
            newName: nextName,
            newPath: parentPath ? `${parentPath}${separator}${nextName}` : nextName,
        };
    });
}

export function buildWorkspaceBulkTransferPlan(
    entries: WorkspaceEntry[],
    targetDirectoryPath: string
): WorkspaceTransferPlanItem[] {
    const trimmedTargetDirectoryPath = targetDirectoryPath.trim();
    if (!trimmedTargetDirectoryPath) {
        return [];
    }

    return sortEntriesForDeterministicBulkActions(entries).map(entry => {
        const separator = getPathSeparator(entry.path);
        const targetPath = `${trimmedTargetDirectoryPath.replace(/[\\/]+$/, '')}${separator}${entry.name}`;
        return {
            entry,
            targetPath,
        };
    });
}
