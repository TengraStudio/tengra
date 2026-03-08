/**
 * Documentation generation utilities
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { FileSearchResult } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';

import { scanDirRecursively } from './file-scanner.util';
import { parseFileSymbols } from './symbol-parser.util';
import { DocumentationPreviewResult } from './types';

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i;

/** Get file outline (symbols) for a given file */
export async function getFileOutline(filePath: string): Promise<FileSearchResult[]> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const symbols = parseFileSymbols(filePath, content);
        return symbols.map(r => ({
            file: filePath,
            type: r.kind,
            name: r.name,
            line: r.line,
            text: r.signature
        }));
    } catch (error) {
        appLogger.error('DocumentationGenerator', `Failed to get file outline for ${filePath}`, error as Error);
        return [];
    }
}

/** Generate JSDoc comment stubs from symbols */
function generateJsdocContent(outline: FileSearchResult[]): string {
    const functionSymbols = outline.filter(item => item.type === 'function');
    const sections = functionSymbols.map(item => {
        const name = item.name ?? 'anonymous';
        return [
            '/**',
            ` * ${name}`,
            ' *',
            ' * @returns {unknown}',
            ' */',
        ].join('\n');
    });
    return sections.join('\n\n');
}

/** Generate markdown documentation from symbols */
function generateMarkdownContent(filePath: string, outline: FileSearchResult[]): string {
    const basename = path.basename(filePath);
    const symbolLines = outline.map(item => {
        const symbolName = item.name ?? '(anonymous)';
        const symbolType = item.type ?? 'symbol';
        return `- \`${symbolName}\` (${symbolType}) at line ${item.line}`;
    });

    return [
        `# Documentation: ${basename}`,
        '',
        `- File: \`${filePath}\``,
        `- Generated: ${new Date().toISOString()}`,
        '',
        '## Symbols',
        ...(symbolLines.length > 0 ? symbolLines : ['- No symbols found']),
    ].join('\n');
}

/** Generate documentation for a single file */
export async function generateFileDocumentation(
    filePath: string,
    format: 'markdown' | 'jsdoc-comments' = 'markdown'
): Promise<DocumentationPreviewResult> {
    try {
        const outline = await getFileOutline(filePath);
        const content = format === 'jsdoc-comments'
            ? generateJsdocContent(outline)
            : generateMarkdownContent(filePath, outline);

        return {
            success: true,
            filePath,
            format,
            content,
            symbolCount: outline.length,
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        return {
            success: false,
            filePath,
            format,
            content: '',
            symbolCount: 0,
            generatedAt: new Date().toISOString(),
            error: getErrorMessage(error as Error),
        };
    }
}

/** Generate documentation summary for an entire workspace */
export async function generateWorkspaceDocumentation(
    rootPath: string,
    maxFiles: number = 30
): Promise<DocumentationPreviewResult> {
    const safeMaxFiles = Number.isFinite(maxFiles) && maxFiles > 0
        ? Math.min(Math.trunc(maxFiles), 200)
        : 30;

    try {
        const files: string[] = [];
        await scanDirRecursively(rootPath, files);
        const targetFiles = files.filter(f => CODE_FILE_PATTERN.test(f)).slice(0, safeMaxFiles);

        const sections: string[] = [];
        let totalSymbols = 0;

        for (const filePath of targetFiles) {
            const outline = await getFileOutline(filePath);
            totalSymbols += outline.length;
            const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
            const lines = outline.map(
                item => `- \`${item.name ?? '(anonymous)'}\` (${item.type}) @${item.line}`
            );
            sections.push(
                [`### ${relativePath}`, '', ...(lines.length > 0 ? lines : ['- No symbols found'])].join('\n')
            );
        }

        const content = [
            '# Workspace Documentation Summary',
            '',
            `- Root: \`${rootPath}\``,
            `- Files covered: ${targetFiles.length}`,
            `- Symbols found: ${totalSymbols}`,
            `- Generated: ${new Date().toISOString()}`,
            '',
            '## File Outlines',
            '',
            ...(sections.length > 0 ? sections : ['No files were scanned.']),
        ].join('\n');

        return {
            success: true,
            filePath: rootPath,
            format: 'markdown',
            content,
            symbolCount: totalSymbols,
            generatedAt: new Date().toISOString(),
        };
    } catch (error) {
        return {
            success: false,
            filePath: rootPath,
            format: 'markdown',
            content: '',
            symbolCount: 0,
            generatedAt: new Date().toISOString(),
            error: getErrorMessage(error as Error),
        };
    }
}
