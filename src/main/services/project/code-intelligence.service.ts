import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { FileSearchResult } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow } from 'electron';

export interface CodeSymbol {
    file: string;
    line: number;
    name: string;
    kind: string;
    signature: string;
    docstring: string;
}

export interface IndexingProgress {
    projectId: string;
    current: number;
    total: number;
    status: string;
}

export interface SymbolAnalytics {
    totalSymbols: number;
    uniqueFiles: number;
    uniqueKinds: number;
    byKind: Record<string, number>;
    byExtension: Record<string, number>;
    topFiles: Array<{ path: string; count: number }>;
    topSymbols: Array<{ name: string; count: number }>;
    generatedAt: string;
}

export interface RenameLineChange {
    line: number;
    occurrences: number;
    before: string;
    after: string;
}

export interface RenameFileChange {
    file: string;
    replacements: RenameLineChange[];
}

export interface RenameSymbolResult {
    success: boolean;
    applied: boolean;
    symbol: string;
    newSymbol: string;
    totalFiles: number;
    totalOccurrences: number;
    changes: RenameFileChange[];
    updatedFiles: string[];
    errors: Array<{ file: string; error: string }>;
}

export interface DocumentationPreviewResult {
    success: boolean;
    filePath: string;
    format: 'markdown' | 'jsdoc-comments';
    content: string;
    symbolCount: number;
    generatedAt: string;
    error?: string;
}

export interface CodeQualityAnalysis {
    rootPath: string;
    filesScanned: number;
    totalLines: number;
    functionSymbols: number;
    classSymbols: number;
    longLineCount: number;
    todoLikeCount: number;
    consoleUsageCount: number;
    averageComplexity: number;
    securityIssueCount: number;
    topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
    highestComplexityFiles: Array<{ file: string; complexity: number }>;
    qualityScore: number;
    generatedAt: string;
}



export class CodeIntelligenceService {

    private indexingInProgress = new Set<string>();
    private indexedProjects = new Set<string>();

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService
    ) { }

    // Indexing
    async queryIndexedSymbols(query: string): Promise<FileSearchResult[]> {
        const vector = await this.embedding.generateEmbedding(query);

        // Parallel search: Symbols + Fragments
        const [symbolResults, fragmentResults] = await Promise.all([
            this.db.searchCodeSymbols(vector),
            this.db.searchSemanticFragments(vector, 10)
        ]);

        const combined: FileSearchResult[] = [];

        // Map symbols
        combined.push(...symbolResults.map(r => ({
            file: r.path,
            line: r.line,
            text: r.name,
            name: r.name,
            type: 'symbol'
        })));

        // Map fragments
        combined.push(...fragmentResults.map(r => ({
            file: r.sourceId, // We store filePath in sourceId for files
            line: 1, // Fragments don't always track precise line, defaulting
            text: r.content,
            type: 'content'
        })));

        return combined;
    }

    async getSymbolAnalytics(rootPath: string): Promise<SymbolAnalytics> {
        try {
            const symbols = await this.db.getCodeSymbolsByProjectPath(rootPath);
            const byKind: Record<string, number> = {};
            const byExtension: Record<string, number> = {};
            const fileCounts: Record<string, number> = {};
            const symbolCounts: Record<string, number> = {};
            const fileSet = new Set<string>();

            for (const symbol of symbols) {
                const kind = symbol.kind.trim() || 'unknown';
                const filePath = symbol.path.trim();
                const extension = path.extname(filePath).toLowerCase() || '(none)';
                const symbolName = symbol.name.trim() || '(anonymous)';

                byKind[kind] = (byKind[kind] ?? 0) + 1;
                byExtension[extension] = (byExtension[extension] ?? 0) + 1;
                fileCounts[filePath] = (fileCounts[filePath] ?? 0) + 1;
                symbolCounts[symbolName] = (symbolCounts[symbolName] ?? 0) + 1;
                if (filePath.length > 0) {
                    fileSet.add(filePath);
                }
            }

            const topFiles = Object.entries(fileCounts)
                .map(([file, count]) => ({ path: file, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20);
            const topSymbols = Object.entries(symbolCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20);

            return {
                totalSymbols: symbols.length,
                uniqueFiles: fileSet.size,
                uniqueKinds: Object.keys(byKind).length,
                byKind,
                byExtension,
                topFiles,
                topSymbols,
                generatedAt: new Date().toISOString(),
            };
        } catch (error) {
            appLogger.error(
                'CodeIntelligenceService',
                `Failed to build symbol analytics for ${rootPath}`,
                error as Error
            );
            return {
                totalSymbols: 0,
                uniqueFiles: 0,
                uniqueKinds: 0,
                byKind: {},
                byExtension: {},
                topFiles: [],
                topSymbols: [],
                generatedAt: new Date().toISOString(),
            };
        }
    }

    async indexProject(rootPath: string, projectId: string, force = false): Promise<void> {
        if (!await this.shouldStartIndexing(projectId, rootPath, force)) { return; }

        this.indexingInProgress.add(projectId);
        appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexing project ${projectId} at ${rootPath} (force=${force})`);

        try {
            this.sendIndexingProgress(projectId, 0, 0, 'Scanning files...');
            const files: string[] = [];
            await this.scanDirRecursively(rootPath, files);

            const total = files.length;
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Found ${total} files. Clearing old index...`);

            await this.db.clearCodeSymbols(rootPath);
            await this.db.clearSemanticFragments(rootPath);

            for (let i = 0; i < total; i++) {
                await this.processProjectFile(projectId, rootPath, files[i], i, total);
            }

            this.indexedProjects.add(projectId);
            this.sendIndexingProgress(projectId, total, total, 'Complete');
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexing complete for ${projectId}`);
        } catch (error) {
            appLogger.error('code-intelligence.service', 'Indexing failed', error as Error);
            this.sendIndexingProgress(projectId, 0, 0, 'Failed');
        } finally {
            this.indexingInProgress.delete(projectId);
        }
    }

    private async shouldStartIndexing(projectId: string, rootPath: string, force: boolean): Promise<boolean> {
        if (this.indexingInProgress.has(projectId)) { return false; }
        if (!force && this.indexedProjects.has(projectId)) { return false; }
        if (!force) {
            const alreadyHasData = await this.db.hasIndexedSymbols(rootPath);
            if (alreadyHasData) {
                this.indexedProjects.add(projectId);
                return false;
            }
        }
        return true;
    }

    private sendIndexingProgress(projectId: string, current: number, total: number, status: string) {
        const windows = BrowserWindow.getAllWindows();
        const progress: IndexingProgress = { projectId, current, total, status };
        windows.forEach((win) => win.webContents.send('code:indexing-progress', progress));
    }

    private async processProjectFile(projectId: string, rootPath: string, filePath: string, index: number, total: number) {
        const relativeName = path.basename(filePath);
        this.sendIndexingProgress(projectId, index + 1, total, `Indexing ${relativeName}...`);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const symbols = this.parseFileSymbols(filePath, content);

            for (const sym of symbols) {
                const text = `${sym.kind} ${sym.name} ${sym.signature}\n${sym.docstring}`;
                const vector = await this.embedding.generateEmbedding(text);
                await this.db.storeCodeSymbol({
                    id: crypto.randomUUID(),
                    project_path: rootPath,
                    file_path: sym.file,
                    name: sym.name,
                    kind: sym.kind,
                    line: sym.line,
                    signature: sym.signature,
                    docstring: sym.docstring,
                    vector
                });
            }

            const ext = path.extname(filePath).toLowerCase();
            const supported = ['.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.kt', '.kts', '.java', '.xml', '.gradle', '.cpp', '.h'];
            if (supported.includes(ext)) {
                await this.chunkAndIndexFile(projectId, rootPath, filePath, content);
            }

            if ((index + 1) % 50 === 0) {
                appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexed ${index + 1}/${total} files...`);
            }
        } catch (error) {
            appLogger.error('code-intelligence.service', `[CodeIntelligence] Failed to index ${relativeName}`, error as Error);
        }
    }

    async updateFileIndex(projectId: string, rootPath: string, filePath: string): Promise<void> {
        try {
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Updating index for ${filePath}`);

            // 1. Clear existing data for this file
            await this.db.deleteCodeSymbolsForFile(rootPath, filePath);
            await this.db.deleteSemanticFragmentsForFile(rootPath, filePath);

            // 2. Read content
            const content = await fs.readFile(filePath, 'utf-8');

            // 3. Re-index Symbols
            const symbols = this.parseFileSymbols(filePath, content);
            for (const sym of symbols) {
                const text = `${sym.kind} ${sym.name}\n${sym.signature}\n${sym.docstring}`;
                const vector = await this.embedding.generateEmbedding(text);
                await this.db.storeCodeSymbol({
                    id: crypto.randomUUID(),
                    project_path: rootPath,
                    file_path: sym.file,
                    name: sym.name,
                    kind: sym.kind,
                    line: sym.line,
                    signature: sym.signature,
                    docstring: sym.docstring,
                    vector
                });
            }

            // 4. Re-index Chunks
            const ext = path.extname(filePath).toLowerCase();
            if (['.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'].includes(ext)) {
                await this.chunkAndIndexFile(projectId, rootPath, filePath, content);
            }
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to update index for ${filePath}`, error as Error);
        }
    }

    private async scanDirRecursively(dir: string, fileList: string[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'out', 'coverage', 'bin', 'obj'].includes(entry.name)) { continue; }

                if (entry.isDirectory()) {
                    await this.scanDirRecursively(fullPath, fileList);
                } else if (entry.isFile() && /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|hpp|md|txt|json)$/.test(entry.name)) {
                    fileList.push(fullPath);
                }
            }
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to scan dir ${dir}`, error as Error);
        }
    }

    private async chunkAndIndexFile(_projectId: string, rootPath: string, filePath: string, content: string) {
        // Simple sliding window
        // Chunk size ~500 chars, overlap 100
        const CHUNK_SIZE = 1000;
        const OVERLAP = 200;
        const EMBEDDING_BATCH_SIZE = 4;
        const chunks: string[] = [];

        for (let start = 0; start < content.length; start += (CHUNK_SIZE - OVERLAP)) {
            const end = Math.min(start + CHUNK_SIZE, content.length);
            chunks.push(content.substring(start, end));
        }

        for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
            const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
            const batchResults = await Promise.allSettled(
                batch.map(async chunk => {
                    const vector = await this.embedding.generateEmbedding(chunk);
                    const fragment: SemanticFragment = {
                        id: crypto.randomUUID(),
                        content: chunk,
                        embedding: vector,
                        source: 'file',
                        sourceId: filePath,
                        tags: ['code', path.extname(filePath)],
                        importance: 0.5,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        projectPath: rootPath
                    };

                    await this.db.storeSemanticFragment(fragment);
                })
            );

            for (const result of batchResults) {
                if (result.status === 'rejected') {
                    const reason = result.reason instanceof Error
                        ? result.reason
                        : new Error(String(result.reason));
                    appLogger.error('CodeIntelligenceService', `Failed to chunk/embed ${path.basename(filePath)}`, reason);
                }
            }
        }
    }

    private parseFileSymbols(filePath: string, content: string): CodeSymbol[] {
        const results: CodeSymbol[] = [];
        try {
            const ext = path.extname(filePath);
            const regexes = this.getRegexesForExtension(ext);
            if (regexes.length === 0) { return []; }

            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]?.trim();
                if (!line) { continue; }

                for (const { kind, regex } of regexes) {
                    const match = line.match(regex);
                    if (match?.[1]) {
                        results.push(this.createSymbolFromMatch(match, filePath, i, lines, kind));
                    }
                }
            }
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to parse file ${filePath}`, error as Error);
        }
        return results;
    }

    private getRegexesForExtension(ext: string): { kind: string, regex: RegExp }[] {
        const jsRegexes = [
            { kind: 'function', regex: /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/ },
            { kind: 'class', regex: /(?:export\s+)?class\s+([a-zA-Z0-9_]+)/ },
            { kind: 'interface', regex: /(?:export\s+)?interface\s+([a-zA-Z0-9_]+)/ },
            { kind: 'type', regex: /(?:export\s+)?type\s+([a-zA-Z0-9_]+)\s*=/ },
            { kind: 'variable', regex: /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=/ }
        ];

        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) { return jsRegexes; }
        if (ext === '.py') {
            return [
                { kind: 'function', regex: /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/ },
                { kind: 'class', regex: /class\s+([a-zA-Z0-9_]+)/ }
            ];
        }
        if (ext === '.go') {
            return [
                { kind: 'function', regex: /func\s+([a-zA-Z0-9_]+)\s*\(/ },
                { kind: 'type', regex: /type\s+([a-zA-Z0-9_]+)\s+struct/ }
            ];
        }
        return [];
    }

    private createSymbolFromMatch(match: RegExpMatchArray, filePath: string, lineIndex: number, lines: string[], kind: string): CodeSymbol {
        const name = match[1];
        const signature = match[0];
        let docstring = '';
        const prevLine = lineIndex > 0 ? lines[lineIndex - 1]?.trim() : null;

        if (prevLine && (prevLine.startsWith('//') || prevLine.startsWith('#') || prevLine.endsWith('*/'))) {
            docstring = prevLine.replace(/^\/\/\s*/, '').replace(/^#\s*/, '').replace(/\*\/$/, '').replace(/^\/\*\*\s*/, '');
        }

        return {
            file: filePath,
            line: lineIndex + 1,
            name,
            kind,
            signature,
            docstring
        };
    }

    // 2.4.41 Symbol Search (Regex) - Legacy/Quick
    async findSymbols(rootPath: string, query: string): Promise<FileSearchResult[]> {
        const results: FileSearchResult[] = [];

        // 1. Try Vector Index (Semantic Navigation)
        try {
            const projects = await this.db.getProjects();
            const project = projects.find(p => p.path === rootPath || rootPath.startsWith(p.path)); // Flexible match

            if (project) {
                const dbSymbols = await this.db.findCodeSymbolsByName(project.path, query);
                if (dbSymbols.length > 0) {
                    return dbSymbols.map(s => ({
                        file: s.path,
                        line: s.line,
                        text: (s.signature && s.signature.length > 0) ? s.signature : s.name,
                        name: s.name,
                        type: s.kind
                    }));
                }
            }
        } catch (e) {
            appLogger.warn('CodeIntelligenceService', `Index lookup failed for ${query}, falling back to regex`, e as Error);
        }

        // 2. Fallback to Regex Scan
        await this.scanDirForSymbols(rootPath, query, results);
        return results;
    }

    // Advanced Hybrid Search (Indexed + Semantic + Regex Fallback)
    async searchFiles(rootPath: string, query: string, projectId?: string, isRegex: boolean = false): Promise<FileSearchResult[]> {
        const results: FileSearchResult[] = [];
        appLogger.info('code-intelligence.service', `[CodeIntelligence] Starting search for "${query}" (regex=${isRegex}) project=${projectId} root=${rootPath}`);

        try {
            // 1. Try Indexed Database Search if projectId is available
            if (projectId || rootPath) {
                // A. Indexed Symbols (Name matches)
                const symbols = await this.db.findCodeSymbolsByName(rootPath, query);
                appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexed symbols found: ${symbols.length}`);
                results.push(...symbols.map(s => ({
                    file: s.path,
                    line: s.line,
                    text: (s.signature && s.signature.length > 0) ? s.signature : s.name,
                    name: s.name,
                    type: s.kind
                })));

                // B. Indexed Content (Text fragments)
                const fragments = await this.db.searchCodeContentByText(rootPath, query);
                appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexed content fragments found: ${fragments.length}`);
                results.push(...fragments.map(f => ({
                    file: f.path,
                    line: f.line,
                    text: f.docstring,
                    type: 'content'
                })));
            }
        } catch (e) {
            appLogger.warn('code-intelligence.service', `[CodeIntelligence] Indexed search failed: ${getErrorMessage(e as Error)}`);
        }

        // 2. If we have few results or it's a regex, perform a scoped FS scan
        // Only run FS scan if we have less than 20 indexed results or if it's explicitly regex
        if (results.length < 20 || isRegex) {
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Too few indexed results(${results.length}), running FS scan on ${rootPath}...`);
            await this.scanDirForText(rootPath, query, isRegex, results);
        }

        // Deduplicate and limit
        const seen = new Set<string>();
        const finalResults = results.filter(r => {
            const key = `${r.file}: ${r.line}: ${r.text}`;
            if (seen.has(key)) { return false; }
            seen.add(key);
            return true;
        }).slice(0, 500);

        appLogger.info('code-intelligence.service', `[CodeIntelligence] Search finished. Total unique results: ${finalResults.length}`);
        return finalResults;
    }

    // 2.4.42 TODO Scanner
    async scanTodos(rootPath: string): Promise<FileSearchResult[]> {
        const todos: FileSearchResult[] = [];
        await this.scanDirForTodos(rootPath, todos);
        return todos;
    }

    /**
     * Optimized project-wide TODO scan
     * Consolidates files and line items into a simplified structure
     */
    async scanProjectTodos(rootPath: string): Promise<Array<{ path: string; relativePath: string; items: Array<{ id: string; text: string; completed: boolean; line: number; filePath: string; relativePath: string }> }>> {
        const results: FileSearchResult[] = await this.scanTodos(rootPath);
        const fileMap = new Map<string, { path: string; relativePath: string; items: Array<{ id: string; text: string; completed: boolean; line: number; filePath: string; relativePath: string }> }>();

        for (const item of results) {
            let entry = fileMap.get(item.file);
            if (!entry) {
                const relativePath = path.relative(rootPath, item.file).replace(/\\/g, '/');
                entry = { path: item.file, relativePath, items: [] };
                fileMap.set(item.file, entry);
            }
            entry.items.push({
                id: `${item.file}-${item.line}`,
                text: item.text,
                completed: false, // Default for non-checkbox items
                line: item.line,
                filePath: item.file,
                relativePath: entry.relativePath
            });
        }

        return Array.from(fileMap.values());
    }

    // 2.4.47 Code Structure (Outline)
    async getFileDimensions(filePath: string): Promise<FileSearchResult[]> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const symbols = this.parseFileSymbols(filePath, content);
            return symbols.map(r => ({
                file: filePath,
                type: r.kind,
                name: r.name,
                line: r.line,
                text: r.signature
            }));
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to get file dimensions for ${filePath}`, error as Error);
            return [];
        }
    }

    async getFileOutline(filePath: string): Promise<FileSearchResult[]> {
        return this.getFileDimensions(filePath);
    }

    async findDefinition(rootPath: string, symbol: string): Promise<FileSearchResult | null> {
        const trimmed = symbol.trim();
        if (!trimmed) {
            return null;
        }

        try {
            const candidates = await this.db.findCodeSymbolsByName(rootPath, trimmed);
            const exact = candidates.find(
                item => item.name.localeCompare(trimmed, undefined, { sensitivity: 'accent' }) === 0
            );
            const selected = exact ?? candidates[0];
            if (!selected) {
                return null;
            }
            return {
                file: selected.path,
                line: selected.line,
                text: selected.signature || selected.name,
                name: selected.name,
                type: selected.kind || 'symbol',
            };
        } catch (error) {
            appLogger.error(
                'CodeIntelligenceService',
                `Failed to find definition for ${trimmed}`,
                error as Error
            );
            return null;
        }
    }

    // 2.5 Advanced Agent Tool: Find Usage
    async findUsage(rootPath: string, symbol: string): Promise<FileSearchResult[]> {
        const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const results: FileSearchResult[] = [];
        await this.scanDirForText(rootPath, `\\b${escapedSymbol}\\b`, true, results);
        return results;
    }

    async findReferences(rootPath: string, symbol: string): Promise<FileSearchResult[]> {
        return this.findUsage(rootPath, symbol);
    }

    /**
     * Scans a single file for implementation patterns
     * @param filePath Path to the file to scan
     * @param patterns Patterns to search for
     * @param symbolName Name of the symbol being searched
     * @returns Array of search results found in this file
     */
    private async scanFileForImplementations(
        filePath: string,
        patterns: Array<{ type: string; regex: RegExp }>,
        symbolName: string
    ): Promise<FileSearchResult[]> {
        const results: FileSearchResult[] = [];
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split(/\r?\n/);
            for (let index = 0; index < lines.length; index++) {
                const line = lines[index] ?? '';
                for (const pattern of patterns) {
                    if (pattern.regex.test(line)) {
                        results.push({
                            file: filePath,
                            line: index + 1,
                            text: line.trim(),
                            type: pattern.type,
                            name: symbolName,
                        });
                        break;
                    }
                }
            }
        } catch {
            // best-effort scan
        }
        return results;
    }

    async findImplementations(rootPath: string, symbol: string): Promise<FileSearchResult[]> {
        const trimmed = symbol.trim();
        if (!trimmed) {
            return [];
        }

        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns: Array<{ type: string; regex: RegExp }> = [
            { type: 'implementation', regex: new RegExp(`\\bimplements\\s+[^\\n{]*\\b${escaped}\\b`, 'i') },
            { type: 'implementation', regex: new RegExp(`\\bextends\\s+${escaped}\\b`, 'i') },
            { type: 'implementation', regex: new RegExp(`\\bclass\\s+[A-Za-z0-9_]+\\s*:\\s*${escaped}\\b`, 'i') }, // Python
            { type: 'implementation', regex: new RegExp(`\\b${escaped}\\s*\\([^)]*\\)\\s*\\{`, 'i') }, // function/method
        ];

        const files: string[] = [];
        await this.scanDirRecursively(rootPath, files);
        const candidates = files.filter(filePath =>
            /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i.test(filePath)
        );

        const results: FileSearchResult[] = [];
        for (const filePath of candidates) {
            const fileResults = await this.scanFileForImplementations(filePath, patterns, trimmed);
            results.push(...fileResults);
        }

        const seen = new Set<string>();
        return results.filter(item => {
            const key = `${item.file}:${item.line}:${item.text}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }).slice(0, 500);
    }

    async getSymbolRelationships(rootPath: string, symbol: string, maxItems: number = 200): Promise<FileSearchResult[]> {
        const trimmed = symbol.trim();
        if (!trimmed) {
            return [];
        }

        try {
            const baseSymbols = await this.db.findCodeSymbolsByName(rootPath, trimmed);
            if (baseSymbols.length === 0) {
                return [];
            }

            const allSymbols = await this.db.getCodeSymbolsByProjectPath(rootPath);
            const results: FileSearchResult[] = [];

            for (const base of baseSymbols) {
                const sameFile = allSymbols.filter(item => item.path === base.path);
                for (const rel of sameFile) {
                    if (rel.name === base.name && rel.line === base.line) {
                        continue;
                    }
                    const distance = Math.abs((rel.line ?? 0) - (base.line ?? 0));
                    const relation = distance <= 30 ? 'related-nearby' : 'related-same-file';
                    results.push({
                        file: rel.path,
                        line: rel.line,
                        text: rel.signature || rel.name,
                        type: relation,
                        name: rel.name,
                    });
                }

                const similar = allSymbols.filter(item => {
                    const lower = item.name.toLowerCase();
                    const query = trimmed.toLowerCase();
                    return lower !== query && (lower.includes(query) || query.includes(lower));
                });
                for (const rel of similar) {
                    results.push({
                        file: rel.path,
                        line: rel.line,
                        text: rel.signature || rel.name,
                        type: 'related-similar-name',
                        name: rel.name,
                    });
                }
            }

            const implementations = await this.findImplementations(rootPath, trimmed);
            results.push(...implementations.map(item => ({ ...item, type: 'related-implementation' })));

            const seen = new Set<string>();
            return results.filter(item => {
                const key = `${item.file}:${item.line}:${item.text}:${item.type}`;
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            }).slice(0, Math.max(1, Math.min(maxItems, 1000)));
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to resolve relationships for ${trimmed}`, error as Error);
            return [];
        }
    }

    async renameSymbol(
        rootPath: string,
        symbol: string,
        newSymbol: string,
        apply: boolean = false,
        maxFiles: number = 500
    ): Promise<RenameSymbolResult> {
        const trimmedSymbol = symbol.trim();
        const trimmedNewSymbol = newSymbol.trim();
        const safeMaxFiles = Number.isFinite(maxFiles) && maxFiles > 0
            ? Math.min(Math.trunc(maxFiles), 5000)
            : 500;

        if (!this.isValidIdentifier(trimmedSymbol) || !this.isValidIdentifier(trimmedNewSymbol)) {
            return {
                success: false,
                applied: apply,
                symbol: trimmedSymbol,
                newSymbol: trimmedNewSymbol,
                totalFiles: 0,
                totalOccurrences: 0,
                changes: [],
                updatedFiles: [],
                errors: [{ file: '', error: 'Invalid identifier payload for rename operation' }],
            };
        }

        const files: string[] = [];
        await this.scanDirRecursively(rootPath, files);
        const candidateFiles = files
            .filter(filePath => /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i.test(filePath))
            .slice(0, safeMaxFiles);

        const escapedSymbol = trimmedSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b${escapedSymbol}\\b`, 'g');
        const changes: RenameFileChange[] = [];
        const updatedFiles: string[] = [];
        const errors: Array<{ file: string; error: string }> = [];
        let totalOccurrences = 0;

        for (const filePath of candidateFiles) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
                const lines = content.split(/\r?\n/);
                const replacements: RenameLineChange[] = [];
                let fileChanged = false;

                for (let index = 0; index < lines.length; index++) {
                    const originalLine = lines[index] ?? '';
                    const matches = [...originalLine.matchAll(pattern)];
                    if (matches.length === 0) {
                        continue;
                    }

                    const nextLine = originalLine.replace(pattern, trimmedNewSymbol);
                    lines[index] = nextLine;
                    totalOccurrences += matches.length;
                    fileChanged = true;
                    replacements.push({
                        line: index + 1,
                        occurrences: matches.length,
                        before: originalLine,
                        after: nextLine,
                    });
                }

                if (!fileChanged) {
                    continue;
                }

                changes.push({ file: filePath, replacements });

                if (apply) {
                    await fs.writeFile(filePath, lines.join(lineEnding), 'utf-8');
                    updatedFiles.push(filePath);
                }
            } catch (error) {
                errors.push({
                    file: filePath,
                    error: getErrorMessage(error as Error),
                });
            }
        }

        return {
            success: errors.length === 0,
            applied: apply,
            symbol: trimmedSymbol,
            newSymbol: trimmedNewSymbol,
            totalFiles: changes.length,
            totalOccurrences,
            changes,
            updatedFiles,
            errors,
        };
    }

    async generateFileDocumentation(
        filePath: string,
        format: 'markdown' | 'jsdoc-comments' = 'markdown'
    ): Promise<DocumentationPreviewResult> {
        try {
            const outline = await this.getFileOutline(filePath);
            const basename = path.basename(filePath);
            let content = '';

            if (format === 'jsdoc-comments') {
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
                content = sections.join('\n\n');
            } else {
                const symbolLines = outline.map(item => {
                    const symbolName = item.name ?? '(anonymous)';
                    const symbolType = item.type ?? 'symbol';
                    return `- \`${symbolName}\` (${symbolType}) at line ${item.line}`;
                });

                content = [
                    `# Documentation: ${basename}`,
                    '',
                    `- File: \`${filePath}\``,
                    `- Generated: ${new Date().toISOString()}`,
                    '',
                    '## Symbols',
                    ...(symbolLines.length > 0 ? symbolLines : ['- No symbols found']),
                ].join('\n');
            }

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

    async generateProjectDocumentation(
        rootPath: string,
        maxFiles: number = 30
    ): Promise<DocumentationPreviewResult> {
        const safeMaxFiles = Number.isFinite(maxFiles) && maxFiles > 0
            ? Math.min(Math.trunc(maxFiles), 200)
            : 30;

        try {
            const files: string[] = [];
            await this.scanDirRecursively(rootPath, files);
            const targetFiles = files
                .filter(filePath => /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i.test(filePath))
                .slice(0, safeMaxFiles);

            const sections: string[] = [];
            let totalSymbols = 0;
            for (const filePath of targetFiles) {
                const outline = await this.getFileOutline(filePath);
                totalSymbols += outline.length;
                const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/');
                const lines = outline.map(item => `- \`${item.name ?? '(anonymous)'}\` (${item.type}) @${item.line}`);
                sections.push(
                    [
                        `### ${relativePath}`,
                        '',
                        ...(lines.length > 0 ? lines : ['- No symbols found']),
                    ].join('\n')
                );
            }

            const content = [
                '# Project Documentation Summary',
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

    /**
     * Scans a file for security issues
     * @param filePath Path to the file being scanned
     * @param lines Array of lines from the file
     * @returns Object containing issue count and findings
     */
    private scanFileForSecurityIssues(
        filePath: string,
        lines: string[]
    ): { issueCount: number; findings: Array<{ file: string; line: number; rule: string; snippet: string }> } {
        const securityRules: Array<{ rule: string; pattern: RegExp }> = [
            { rule: 'unsafe-eval', pattern: /\beval\s*\(/ },
            { rule: 'unsafe-new-function', pattern: /\bnew\s+Function\s*\(/ },
            { rule: 'unsafe-inner-html', pattern: /\.innerHTML\s*=/ },
            { rule: 'unsafe-child-process-exec', pattern: /\bexec\s*\(/ },
            { rule: 'unsafe-shell-true', pattern: /shell\s*:\s*true/ },
        ];

        let issueCount = 0;
        const findings: Array<{ file: string; line: number; rule: string; snippet: string }> = [];

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index] ?? '';
            for (const rule of securityRules) {
                if (rule.pattern.test(line)) {
                    issueCount += 1;
                    findings.push({
                        file: filePath,
                        line: index + 1,
                        rule: rule.rule,
                        snippet: line.trim().slice(0, 200),
                    });
                }
            }
        }

        return { issueCount, findings };
    }

    async analyzeCodeQuality(rootPath: string, maxFiles: number = 300): Promise<CodeQualityAnalysis> {
        const safeMaxFiles = Number.isFinite(maxFiles) && maxFiles > 0
            ? Math.min(Math.trunc(maxFiles), 3000)
            : 300;

        const files: string[] = [];
        await this.scanDirRecursively(rootPath, files);
        const candidateFiles = files
            .filter(filePath => /\.(ts|tsx|js|jsx|py|go|rs|java|kt|kts|cpp|c|h|hpp|cs)$/i.test(filePath))
            .slice(0, safeMaxFiles);

        let totalLines = 0;
        let functionSymbols = 0;
        let classSymbols = 0;
        let longLineCount = 0;
        let todoLikeCount = 0;
        let consoleUsageCount = 0;
        let securityIssueCount = 0;
        let complexityTotal = 0;
        const complexityByFile: Array<{ file: string; complexity: number }> = [];
        const securityFindings: Array<{ file: string; line: number; rule: string; snippet: string }> = [];

        for (const filePath of candidateFiles) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.split(/\r?\n/);
                const symbols = this.parseFileSymbols(filePath, content);
                const complexity = this.estimateFileComplexity(content);

                totalLines += lines.length;
                functionSymbols += symbols.filter(item => item.kind === 'function').length;
                classSymbols += symbols.filter(item => item.kind === 'class').length;
                longLineCount += lines.filter(line => line.length > 120).length;
                todoLikeCount += lines.filter(line => /(TODO|FIXME|HACK|XXX)/i.test(line)).length;
                consoleUsageCount += lines.filter(line => /console\.(log|warn|error|debug)\s*\(/.test(line)).length;
                const fileSecurityResults = this.scanFileForSecurityIssues(filePath, lines);
                securityIssueCount += fileSecurityResults.issueCount;
                securityFindings.push(...fileSecurityResults.findings.slice(0, 200 - securityFindings.length));
                complexityTotal += complexity;
                complexityByFile.push({ file: filePath, complexity });
            } catch {
                // Best-effort quality scan; skip unreadable files.
            }
        }

        const filesScanned = candidateFiles.length;
        const averageComplexity = filesScanned > 0 ? complexityTotal / filesScanned : 0;
        const penalties =
            Math.min(longLineCount * 0.15, 20) +
            Math.min(todoLikeCount * 0.5, 15) +
            Math.min(consoleUsageCount * 0.2, 10) +
            Math.min(securityIssueCount * 0.8, 25) +
            Math.min(averageComplexity * 2.5, 35);
        const qualityScore = Math.max(0, Math.round(100 - penalties));

        return {
            rootPath,
            filesScanned,
            totalLines,
            functionSymbols,
            classSymbols,
            longLineCount,
            todoLikeCount,
            consoleUsageCount,
            averageComplexity: Number(averageComplexity.toFixed(2)),
            securityIssueCount,
            topSecurityFindings: securityFindings.slice(0, 50),
            highestComplexityFiles: complexityByFile
                .sort((a, b) => b.complexity - a.complexity)
                .slice(0, 20),
            qualityScore,
            generatedAt: new Date().toISOString(),
        };
    }

    private async scanDirForTodos(dir: string, results: FileSearchResult[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') { continue; }

                if (entry.isDirectory()) {
                    await this.scanDirForTodos(fullPath, results);
                } else if (entry.isFile() && /\.(ts|js|py|kt|java|go|rs|cpp|h|gradle)$/.test(entry.name)) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const lines = content.split('\n');

                    const todoRegex = /(:?\/\/|#)\s*(TODO|FIXME|BUG|HACK|NOTE|XXX)\b\s*:?(.*)/i;

                    lines.forEach((line, index) => {
                        const match = line.match(todoRegex);
                        if (match) {
                            const type = match[2].toUpperCase(); // TODO, FIXME, etc.
                            const text = match[3].trim() || line.trim();
                            results.push({
                                file: fullPath,
                                line: index + 1,
                                text: text,
                                type: type
                            });
                        }
                    });
                }
            }
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to scan todos in ${dir}`, error as Error);
        }
    }

    private async scanDirForSymbols(dir: string, query: string, results: FileSearchResult[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') { continue; }

                if (entry.isDirectory()) {
                    await this.scanDirForSymbols(fullPath, query, results);
                } else if (entry.isFile() && /\.(ts|tsx|js|jsx|py|kt|java|go|rs|cpp|h|cs)$/.test(entry.name)) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const lines = content.split('\n');
                    const symbolRegex = new RegExp(`(function|class|const|let|var|interface|type|fun|object|interface|void|public|private|protected|internal)\\s+(${query}\\w*)`, 'i');

                    lines.forEach((line, index) => {
                        const match = line.match(symbolRegex);
                        if (match?.[1] && match[2]) {
                            results.push({
                                file: fullPath,
                                line: index + 1,
                                text: line.trim(),
                                type: match[1],
                                name: match[2]
                            });
                        }
                    });
                }
            }
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to scan symbols in ${dir}`, error as Error);
        }
    }

    private async scanDirForText(dir: string, query: string, isRegex: boolean, results: FileSearchResult[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') { continue; }

                if (entry.isDirectory()) {
                    await this.scanDirForText(fullPath, query, isRegex, results);
                } else if (entry.isFile() && !/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp4|webm)$/i.test(entry.name)) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const lines = content.split('\n');

                    lines.forEach((line, index) => {
                        let match = false;
                        if (isRegex) {
                            try {
                                if (new RegExp(query, 'i').test(line)) { match = true; }
                            } catch { /* ignore invalid regex */ }
                        } else {
                            if (line.toLowerCase().includes(query.toLowerCase())) { match = true; }
                        }

                        if (match) {
                            if (results.length < 1000) {
                                results.push({
                                    file: fullPath,
                                    line: index + 1,
                                    text: line.trim().substring(0, 200)
                                });
                            }
                        }
                    });
                }
            }
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to scan text in ${dir}`, error as Error);
        }
    }

    private isValidIdentifier(value: string): boolean {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
    }

    private estimateFileComplexity(content: string): number {
        const branchKeywords = content.match(/\b(if|else\s+if|for|while|case|catch)\b/g)?.length ?? 0;
        const logicalOperators = content.match(/&&|\|\|/g)?.length ?? 0;
        const ternaryOperators = content.match(/\?/g)?.length ?? 0;
        return 1 + branchKeywords + logicalOperators + Math.floor(ternaryOperators / 2);
    }
}
