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

        let start = 0;
        while (start < content.length) {
            const end = Math.min(start + CHUNK_SIZE, content.length);
            const chunk = content.substring(start, end);

            // Generate embedding
            try {
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
            } catch (e) {
                appLogger.error('CodeIntelligenceService', `Failed to chunk/embed ${path.basename(filePath)}`, e as Error);
            }

            start += (CHUNK_SIZE - OVERLAP);
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

    // 2.5 Advanced Agent Tool: Find Usage
    async findUsage(rootPath: string, symbol: string): Promise<FileSearchResult[]> {
        const results: FileSearchResult[] = [];
        await this.scanDirForText(rootPath, `\\b${symbol} \\b`, true, results);
        return results;
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
}
