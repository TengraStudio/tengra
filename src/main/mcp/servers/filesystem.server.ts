import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';
import { JsonObject } from '@shared/types/common';

export function buildFilesystemServers(deps: McpDeps): McpService[] {
    return [
        {
            name: 'filesystem',
            description: 'File system operations with line-level editing capabilities',
            actions: buildActions([
                ...buildBasicFileActions(deps),
                ...buildLineEditActions(deps),
                ...buildFileManagementActions(deps)
            ])
        }
    ];
}

function buildBasicFileActions(deps: McpDeps) {
    return [
        {
            name: 'read',
            description: 'Read a UTF-8 file content',
            handler: (args: JsonObject) => deps.filesystem.readFile(args.path as string)
        },
        {
            name: 'write',
            description: 'Write text to file (creates directories if needed)',
            handler: (args: JsonObject) => deps.filesystem.writeFile(args.path as string, args.content as string)
        },
        {
            name: 'list',
            description: 'List directory entries with metadata',
            handler: (args: JsonObject) => deps.filesystem.listDirectory(args.path as string)
        },
        {
            name: 'exists',
            description: 'Check if file or directory exists',
            handler: (args: JsonObject) => deps.filesystem.fileExists(args.path as string)
        },
        {
            name: 'info',
            description: 'Get detailed file/directory information',
            handler: (args: JsonObject) => deps.filesystem.getFileInfo(args.path as string)
        },
        {
            name: 'mkdir',
            description: 'Create a directory (recursive)',
            handler: (args: JsonObject) => deps.filesystem.createDirectory(args.path as string)
        },
        {
            name: 'delete',
            description: 'Delete a file',
            handler: (args: JsonObject) => deps.filesystem.deleteFile(args.path as string)
        },
        {
            name: 'deleteDir',
            description: 'Delete a directory recursively',
            handler: (args: JsonObject) => deps.filesystem.deleteDirectory(args.path as string)
        },
        {
            name: 'copy',
            description: 'Copy a file',
            handler: (args: JsonObject) => deps.filesystem.copyFile(args.source as string, args.destination as string)
        },
        {
            name: 'move',
            description: 'Move/rename a file or directory',
            handler: (args: JsonObject) => deps.filesystem.moveFile(args.source as string, args.destination as string)
        }
    ];
}

function buildLineEditActions(deps: McpDeps) {
    return [
        {
            name: 'readLines',
            description: 'Read specific lines from a file',
            handler: async (args: JsonObject) => {
                const path = args.path as string;
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
            description: 'Replace a single line in a file',
            handler: async (args: JsonObject) => {
                const path = args.path as string;
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
            description: 'Insert a new line at specific position',
            handler: async (args: JsonObject) => {
                const path = args.path as string;
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
            description: 'Delete a specific line from a file',
            handler: async (args: JsonObject) => {
                const path = args.path as string;
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
            description: 'Apply multiple line edits to a file atomically',
            handler: (args: JsonObject) => deps.filesystem.applyEdits(args.path as string, args.edits as Array<{
                startLine: number;
                endLine: number;
                replacement: string;
            }>)
        },
        {
            name: 'searchInFile',
            description: 'Search for text in a file and return matching line numbers',
            handler: async (args: JsonObject) => {
                const path = args.path as string;
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
    return [
        {
            name: 'unzip',
            description: 'Extract a zip archive',
            handler: (args: JsonObject) => deps.filesystem.unzip(args.zipPath as string, args.destPath as string)
        },
        {
            name: 'download',
            description: 'Download a file from URL',
            handler: (args: JsonObject) => deps.filesystem.downloadFile(args.url as string, args.destPath as string)
        },
        {
            name: 'getHash',
            description: 'Calculate file hash (md5, sha1, sha256)',
            handler: (args: JsonObject) => deps.filesystem.getFileHash(
                args.path as string,
                args.algorithm as 'md5' | 'sha1' | 'sha256'
            )
        },
        {
            name: 'searchFiles',
            description: 'Search for files by name pattern',
            handler: (args: JsonObject) => deps.filesystem.searchFiles(args.rootPath as string, args.pattern as string)
        }
    ];
}
