import { buildActions, McpDeps, validatePath, validateString, validateUrl } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { JsonObject } from '@shared/types/common';
import * as os from 'os';

export function buildFilesystemServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'filesystem',
            description: 'File system operations with line-level editing capabilities',
            actions: buildActions([
                ...buildBasicFileActions(deps),
                ...buildLineEditActions(deps),
                ...buildFileManagementActions(deps)
            ], 'filesystem', deps.auditLog)
        }
    ];
}

function buildBasicFileActions(deps: McpDeps) {
    // Get allowed file roots from settings, default to user home directory
    const getAllowedRoots = (): string[] => {
        const settings = deps.settings.getSettings();
        const allowedRoots = settings.allowedFileRoots;
        // Validate and convert to string array
        if (Array.isArray(allowedRoots) && allowedRoots.length > 0) {
            return allowedRoots.filter((r): r is string => typeof r === 'string');
        }
        // Fallback to home directory if no roots configured
        return [os.homedir()];
    };

    // Validate path against allowed roots
    const validateFilePath = (inputPath: string): string => {
        const validatedInput = validateString(inputPath, 2000);
        const allowedRoots = getAllowedRoots();

        // Try to validate against each allowed root
        for (const root of allowedRoots) {
            try {
                return validatePath(root, validatedInput);
            } catch {
                // Continue to next root
            }
        }

        // If no root matched, throw error
        throw new Error(`Path not allowed. Must be within one of: ${allowedRoots.join(', ')}`);
    };

    return [
        {
            name: 'read',
            description: 'Read a UTF-8 file content (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.readFile(validateFilePath(args.path as string))
        },
        {
            name: 'write',
            description: 'Write text to file (creates directories if needed, path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.writeFile(
                validateFilePath(args.path as string),
                validateString(args.content, 10485760) // 10MB max content
            )
        },
        {
            name: 'list',
            description: 'List directory entries with metadata (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.listDirectory(validateFilePath(args.path as string))
        },
        {
            name: 'exists',
            description: 'Check if file or directory exists (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.fileExists(validateFilePath(args.path as string))
        },
        {
            name: 'info',
            description: 'Get detailed file/directory information (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.getFileInfo(validateFilePath(args.path as string))
        },
        {
            name: 'mkdir',
            description: 'Create a directory (recursive, path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.createDirectory(validateFilePath(args.path as string))
        },
        {
            name: 'delete',
            description: 'Delete a file (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.deleteFile(validateFilePath(args.path as string))
        },
        {
            name: 'deleteDir',
            description: 'Delete a directory recursively (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.deleteDirectory(validateFilePath(args.path as string))
        },
        {
            name: 'copy',
            description: 'Copy a file (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.copyFile(
                validateFilePath(args.source as string),
                validateFilePath(args.destination as string)
            )
        },
        {
            name: 'move',
            description: 'Move/rename a file or directory (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.moveFile(
                validateFilePath(args.source as string),
                validateFilePath(args.destination as string)
            )
        }
    ];
}

function buildLineEditActions(deps: McpDeps) {
    // Reuse the same path validation logic
    const getAllowedRoots = (): string[] => {
        const settings = deps.settings.getSettings();
        const allowedRoots = settings.allowedFileRoots;
        // Validate and convert to string array
        if (Array.isArray(allowedRoots) && allowedRoots.length > 0) {
            return allowedRoots.filter((r): r is string => typeof r === 'string');
        }
        // Fallback to home directory if no roots configured
        return [os.homedir()];
    };

    const validateFilePath = (inputPath: string): string => {
        const validatedInput = validateString(inputPath, 2000);
        const allowedRoots = getAllowedRoots();
        for (const root of allowedRoots) {
            try {
                return validatePath(root, validatedInput);
            } catch {
                // Continue to next root
            }
        }
        throw new Error(`Path not allowed. Must be within one of: ${allowedRoots.join(', ')}`);
    };

    return [
        {
            name: 'readLines',
            description: 'Read specific lines from a file (path traversal protected)',
            handler: async (args: JsonObject) => {
                const path = validateFilePath(args.path as string);
                const startLine = args.startLine as number;
                const endLine = args.endLine as number;
                const result = await deps.filesystem.readFile(path);
                if (!result.success || !result.data) {
                    return { success: false, error: result.error ?? 'Failed to read file' };
                }
                const lines = result.data.split('\n');
                const start = Math.max(0, startLine - 1);
                const end = Math.min(lines.length, endLine);
                const selectedLines = lines.slice(start, end);
                return {
                    success: true,
                    data: {
                        lines: selectedLines,
                        lineNumbers: selectedLines.map((_, i) => start + i + 1),
                        totalLines: lines.length
                    }
                };
            }
        },
        {
            name: 'replaceLine',
            description: 'Replace a single line in a file (path traversal protected)',
            handler: async (args: JsonObject) => {
                const path = validateFilePath(args.path as string);
                const lineNumber = args.lineNumber as number;
                const content = args.content as string;
                const result = await deps.filesystem.readFile(path);
                if (!result.success || !result.data) {
                    return { success: false, error: result.error ?? 'Failed to read file' };
                }
                const lines = result.data.split('\n');
                const index = lineNumber - 1;
                if (index < 0 || index >= lines.length) {
                    return { success: false, error: `Line ${lineNumber} does not exist. File has ${lines.length} lines.` };
                }
                lines[index] = content;
                return deps.filesystem.writeFile(path, lines.join('\n'));
            }
        },
        {
            name: 'insertLine',
            description: 'Insert a new line at specific position (path traversal protected)',
            handler: async (args: JsonObject) => {
                const path = validateFilePath(args.path as string);
                const lineNumber = args.lineNumber as number;
                const content = args.content as string;
                const result = await deps.filesystem.readFile(path);
                if (!result.success || !result.data) {
                    return { success: false, error: result.error ?? 'Failed to read file' };
                }
                const lines = result.data.split('\n');
                const index = lineNumber - 1;
                if (index < 0 || index > lines.length) {
                    return { success: false, error: `Invalid line number ${lineNumber}. File has ${lines.length} lines.` };
                }
                lines.splice(index, 0, content);
                return deps.filesystem.writeFile(path, lines.join('\n'));
            }
        },
        {
            name: 'deleteLine',
            description: 'Delete a specific line from a file (path traversal protected)',
            handler: async (args: JsonObject) => {
                const path = validateFilePath(args.path as string);
                const lineNumber = args.lineNumber as number;
                const result = await deps.filesystem.readFile(path);
                if (!result.success || !result.data) {
                    return { success: false, error: result.error ?? 'Failed to read file' };
                }
                const lines = result.data.split('\n');
                const index = lineNumber - 1;
                if (index < 0 || index >= lines.length) {
                    return { success: false, error: `Line ${lineNumber} does not exist. File has ${lines.length} lines.` };
                }
                lines.splice(index, 1);
                return deps.filesystem.writeFile(path, lines.join('\n'));
            }
        },
        {
            name: 'applyEdits',
            description: 'Apply multiple line edits to a file atomically (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.applyEdits(validateFilePath(args.path as string), args.edits as Array<{
                startLine: number;
                endLine: number;
                replacement: string;
            }>)
        },
        {
            name: 'searchInFile',
            description: 'Search for text in a file and return matching line numbers (path traversal protected)',
            handler: async (args: JsonObject) => {
                const path = validateFilePath(args.path as string);
                const pattern = args.pattern as string;
                const caseSensitive = args.caseSensitive as boolean;
                const result = await deps.filesystem.readFile(path);
                if (!result.success || !result.data) {
                    return { success: false, error: result.error ?? 'Failed to read file' };
                }
                const lines = result.data.split('\n');
                const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();
                const matches = lines
                    .map((line, index) => ({
                        lineNumber: index + 1,
                        line: line,
                        matches: caseSensitive
                            ? line.includes(pattern)
                            : line.toLowerCase().includes(searchPattern)
                    }))
                    .filter(m => m.matches);
                return {
                    success: true,
                    data: {
                        matches,
                        totalMatches: matches.length
                    }
                };
            }
        }
    ];
}

function buildFileManagementActions(deps: McpDeps) {
    // Reuse the same path validation logic
    const getAllowedRoots = (): string[] => {
        const settings = deps.settings.getSettings();
        const allowedRoots = settings.allowedFileRoots;
        // Validate and convert to string array
        if (Array.isArray(allowedRoots) && allowedRoots.length > 0) {
            return allowedRoots.filter((r): r is string => typeof r === 'string');
        }
        // Fallback to home directory if no roots configured
        return [os.homedir()];
    };

    const validateFilePath = (inputPath: string): string => {
        const validatedInput = validateString(inputPath, 2000);
        const allowedRoots = getAllowedRoots();
        for (const root of allowedRoots) {
            try {
                return validatePath(root, validatedInput);
            } catch {
                // Continue to next root
            }
        }
        throw new Error(`Path not allowed. Must be within one of: ${allowedRoots.join(', ')}`);
    };

    return [
        {
            name: 'unzip',
            description: 'Extract a zip archive (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.unzip(
                validateFilePath(args.zipPath as string),
                validateFilePath(args.destPath as string)
            )
        },
        {
            name: 'download',
            description: 'Download a file from URL (path traversal protected, URL validated)',
            handler: (args: JsonObject) => deps.filesystem.downloadFile(
                validateUrl(args.url),
                validateFilePath(args.destPath as string)
            )
        },
        {
            name: 'getHash',
            description: 'Calculate file hash (md5, sha1, sha256) (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.getFileHash(
                validateFilePath(args.path as string),
                args.algorithm as 'md5' | 'sha1' | 'sha256'
            )
        },
        {
            name: 'searchFiles',
            description: 'Search for files by name pattern (path traversal protected)',
            handler: (args: JsonObject) => deps.filesystem.searchFiles(
                validateFilePath(args.rootPath as string),
                validateString(args.pattern, 500)
            )
        }
    ];
}
