import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import type { FileSearchResult } from '@shared/types/common';
import { app, BrowserWindow } from 'electron';

interface IndexManifest {
    files: Record<string, number>;
}

import {
    analyzeCodeQuality as analyzeWorkspaceCodeQuality
} from './code-intelligence/code-quality-scanner.util';
import {
    generateFileDocumentation as createFileDocumentation,
    generateWorkspaceDocumentation as createWorkspaceDocumentation,
    getFileOutline as readFileOutline
} from './code-intelligence/documentation-generator.util';
import {
    scanDirForTodos,
    scanDirRecursively
} from './code-intelligence/file-scanner.util';
import { renameSymbol as renameWorkspaceSymbol } from './code-intelligence/rename-symbol.util';
import {
    findDefinition as findSymbolDefinition,
    findImplementations as findSymbolImplementations,
    findSymbols as findWorkspaceSymbols,
    findUsage as findSymbolUsage,
    getSymbolRelationships as getRelatedSymbols,
    searchFiles as searchWorkspaceFiles
} from './code-intelligence/symbol-navigation.util';
import { parseFileSymbols } from './code-intelligence/symbol-parser.util';
import type {
    CodeQualityAnalysis,
    CodeSymbol,
    DocumentationPreviewResult,
    IndexingProgress,
    RenameSymbolResult,
    SymbolAnalytics
} from './code-intelligence/types';

export type {
    CodeQualityAnalysis,
    CodeSymbol,
    DocumentationPreviewResult,
    IndexingProgress,
    RenameFileChange,
    RenameLineChange,
    RenameSymbolResult,
    SecurityFinding,
    SymbolAnalytics
} from './code-intelligence/types';

const WORKSPACE_COMPAT_PATH_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN;
const FULL_CHUNK_EXTENSIONS = new Set([
    '.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.py', '.go',
    '.rs', '.kt', '.kts', '.java', '.xml', '.gradle', '.cpp', '.h'
]);
const INCREMENTAL_CHUNK_EXTENSIONS = new Set([
    '.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'
]);
const SEMANTIC_CHUNK_SIZE = 1000;
const SEMANTIC_CHUNK_OVERLAP = 200;
const EMBEDDING_BATCH_SIZE = 4;

export class CodeIntelligenceService {
    private readonly indexingInProgress = new Set<string>();
    private readonly indexedWorkspaces = new Set<string>();
    private manifestPath = '';

    constructor(
        private readonly db: DatabaseService,
        private readonly embedding: EmbeddingService
    ) {
        try {
            const userDataPath = app.getPath('userData');
            this.manifestPath = path.join(userDataPath, 'code-intel-manifests.json');
        } catch {
            this.manifestPath = '';
        }
    }

    private async loadManifest(): Promise<Record<string, IndexManifest>> {
        if (!this.manifestPath) {
            return {};
        }
        try {
            const data = await fs.readFile(this.manifestPath, 'utf8');
            const parsed = JSON.parse(data) as Record<string, IndexManifest>;
            return parsed;
        } catch {
            return {};
        }
    }

    private async saveManifest(manifest: Record<string, IndexManifest>): Promise<void> {
        if (!this.manifestPath) {
            return;
        }
        try {
            await fs.writeFile(this.manifestPath, JSON.stringify(manifest), 'utf8');
        } catch {
            // Ignore write errors to cache
        }
    }

    async queryIndexedSymbols(query: string): Promise<FileSearchResult[]> {
        const vector = await this.embedding.generateEmbedding(query);
        const [symbolResults, fragmentResults] = await Promise.all([
            this.db.searchCodeSymbols(vector),
            this.db.searchSemanticFragments(vector, 10)
        ]);

        const combined: FileSearchResult[] = [];
        combined.push(...symbolResults.map(result => ({
            file: result.path,
            line: result.line,
            text: result.name,
            name: result.name,
            type: 'symbol'
        })));
        combined.push(...fragmentResults.map(result => ({
            file: result.sourceId,
            line: 1,
            text: result.content,
            type: 'content'
        })));

        return combined;
    }

    async getSymbolAnalytics(rootPath: string): Promise<SymbolAnalytics> {
        try {
            const symbols = await this.db.getCodeSymbolsByWorkspacePath(rootPath);
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
                .sort((left, right) => right.count - left.count)
                .slice(0, 20);
            const topSymbols = Object.entries(symbolCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((left, right) => right.count - left.count)
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

    async indexWorkspace(rootPath: string, workspaceId: string, force = false): Promise<void> {
        if (!await this.shouldStartIndexing(workspaceId, rootPath, force)) {
            return;
        }

        this.indexingInProgress.add(workspaceId);
        appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexing workspace ${workspaceId} at ${rootPath} (force=${force})`);

        try {
            this.sendIndexingProgress(workspaceId, 0, 0, 'Scanning files...');
            const files: string[] = [];
            await scanDirRecursively(rootPath, files);

            const total = files.length;
            
            const allManifests = await this.loadManifest();
            const manifest = allManifests[workspaceId] ?? { files: {} };
            const newFileManifest: Record<string, number> = {};
            const filesToIndex: string[] = [];
            
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Found ${total} total files. Checking index manifest...`);

            // Identify changed and removed files
            for (const filePath of files) {
                try {
                    const stats = await fs.stat(filePath);
                    newFileManifest[filePath] = stats.mtimeMs;
                    if (force || !manifest.files[filePath] || manifest.files[filePath] !== stats.mtimeMs) {
                        filesToIndex.push(filePath);
                    }
                } catch {
                    // Ignore stat errors, skip file
                }
            }

            if (force) {
                await this.db.clearCodeSymbols(rootPath);
                await this.db.clearSemanticFragments(rootPath);
            } else {
                for (const filePath of Object.keys(manifest.files)) {
                    if (!newFileManifest[filePath]) {
                        await this.db.deleteCodeSymbolsForFile(rootPath, filePath);
                        await this.db.deleteSemanticFragmentsForFile(rootPath, filePath);
                    }
                }
            }

            appLogger.info('code-intelligence.service', `[CodeIntelligence] Found ${filesToIndex.length} files that need indexing.`);

            for (let index = 0; index < filesToIndex.length; index++) {
                const filePath = filesToIndex[index];
                if (!filePath) {
                    continue;
                }
                
                if (!force && manifest.files[filePath]) {
                    await this.db.deleteCodeSymbolsForFile(rootPath, filePath);
                    await this.db.deleteSemanticFragmentsForFile(rootPath, filePath);
                }
                
                await this.processWorkspaceFile(workspaceId, rootPath, filePath, index, filesToIndex.length);
                
                if (index > 0 && index % 10 === 0) {
                    await new Promise(r => setImmediate(r));
                }
            }
            
            allManifests[workspaceId] = { files: newFileManifest };
            await this.saveManifest(allManifests);

            this.indexedWorkspaces.add(workspaceId);
            this.sendIndexingProgress(workspaceId, total, total, 'Complete');
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexing complete for ${workspaceId}`);
        } catch (error) {
            appLogger.error('code-intelligence.service', `[CodeIntelligence] Indexing failed for ${workspaceId}`, error as Error);
            this.sendIndexingProgress(workspaceId, 0, 0, 'Failed');
        } finally {
            this.indexingInProgress.delete(workspaceId);
        }
    }

    async updateFileIndex(workspaceId: string, rootPath: string, filePath: string): Promise<void> {
        try {
            void workspaceId;
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Updating index for ${filePath}`);

            await this.db.deleteCodeSymbolsForFile(rootPath, filePath);
            await this.db.deleteSemanticFragmentsForFile(rootPath, filePath);

            const content = await fs.readFile(filePath, 'utf-8');
            await this.storeCodeSymbols(rootPath, filePath, parseFileSymbols(filePath, content), 'update');

            const extension = path.extname(filePath).toLowerCase();
            if (INCREMENTAL_CHUNK_EXTENSIONS.has(extension)) {
                await this.chunkAndIndexFile(rootPath, filePath, content);
            }
        } catch (error) {
            appLogger.error('CodeIntelligenceService', `Failed to update index for ${filePath}`, error as Error);
        }
    }

    async findSymbols(rootPath: string, query: string): Promise<FileSearchResult[]> {
        return await findWorkspaceSymbols(this.db, rootPath, query);
    }

    async searchFiles(rootPath: string, query: string, workspaceId?: string, isRegex: boolean = false): Promise<FileSearchResult[]> {
        return await searchWorkspaceFiles(this.db, rootPath, query, workspaceId, isRegex);
    }

    async scanTodos(rootPath: string): Promise<FileSearchResult[]> {
        const todos: FileSearchResult[] = [];
        await scanDirForTodos(rootPath, todos);
        return todos;
    }

    async scanWorkspaceTodos(rootPath: string): Promise<Array<{
        path: string;
        relativePath: string;
        items: Array<{
            id: string;
            text: string;
            completed: boolean;
            line: number;
            filePath: string;
            relativePath: string;
        }>;
    }>> {
        const results = await this.scanTodos(rootPath);
        const fileMap = new Map<string, {
            path: string;
            relativePath: string;
            items: Array<{
                id: string;
                text: string;
                completed: boolean;
                line: number;
                filePath: string;
                relativePath: string;
            }>;
        }>();

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
                completed: false,
                line: item.line,
                filePath: item.file,
                relativePath: entry.relativePath
            });
        }

        return Array.from(fileMap.values());
    }

    async getFileDimensions(filePath: string): Promise<FileSearchResult[]> {
        return await readFileOutline(filePath);
    }

    async getFileOutline(filePath: string): Promise<FileSearchResult[]> {
        return await readFileOutline(filePath);
    }

    async findDefinition(rootPath: string, symbol: string): Promise<FileSearchResult | null> {
        return await findSymbolDefinition(this.db, rootPath, symbol);
    }

    async findUsage(rootPath: string, symbol: string): Promise<FileSearchResult[]> {
        return await findSymbolUsage(rootPath, symbol);
    }

    async findReferences(rootPath: string, symbol: string): Promise<FileSearchResult[]> {
        return await this.findUsage(rootPath, symbol);
    }

    async findImplementations(rootPath: string, symbol: string): Promise<FileSearchResult[]> {
        return await findSymbolImplementations(rootPath, symbol);
    }

    async getSymbolRelationships(rootPath: string, symbol: string, maxItems: number = 200): Promise<FileSearchResult[]> {
        return await getRelatedSymbols(this.db, rootPath, symbol, maxItems);
    }

    async renameSymbol(
        rootPath: string,
        symbol: string,
        newSymbol: string,
        apply: boolean = false,
        maxFiles: number = 500
    ): Promise<RenameSymbolResult> {
        return await renameWorkspaceSymbol(rootPath, symbol, newSymbol, apply, maxFiles);
    }

    async generateFileDocumentation(
        filePath: string,
        format: 'markdown' | 'jsdoc-comments' = 'markdown'
    ): Promise<DocumentationPreviewResult> {
        return await createFileDocumentation(filePath, format);
    }

    async generateWorkspaceDocumentation(
        rootPath: string,
        maxFiles: number = 30
    ): Promise<DocumentationPreviewResult> {
        return await createWorkspaceDocumentation(rootPath, maxFiles);
    }

    async analyzeCodeQuality(rootPath: string, maxFiles: number = 300): Promise<CodeQualityAnalysis> {
        return await analyzeWorkspaceCodeQuality(rootPath, maxFiles);
    }

    private async shouldStartIndexing(workspaceId: string, rootPath: string, force: boolean): Promise<boolean> {
        if (this.indexingInProgress.has(workspaceId)) {
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexing already in progress for ${workspaceId}, skipping.`);
            return false;
        }

        if (!force && this.indexedWorkspaces.has(workspaceId)) {
            appLogger.info('code-intelligence.service', `[CodeIntelligence] Workspace ${workspaceId} already indexed, skipping.`);
            return false;
        }

        if (!force) {
            const alreadyHasData = await this.db.hasIndexedSymbols(rootPath);
            if (alreadyHasData) {
                this.indexedWorkspaces.add(workspaceId);
                return false;
            }
        }

        return true;
    }

    private sendIndexingProgress(workspaceId: string, current: number, total: number, status: string): void {
        const windows = BrowserWindow.getAllWindows();
        const progress: IndexingProgress = { workspaceId, current, total, status };
        windows.forEach(window => { window.webContents.send('code:indexing-progress', progress); });
    }

    private async processWorkspaceFile(
        workspaceId: string,
        rootPath: string,
        filePath: string,
        index: number,
        total: number
    ): Promise<void> {
        const relativeName = path.basename(filePath);
        this.sendIndexingProgress(workspaceId, index + 1, total, `Indexing ${relativeName}...`);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            await this.storeCodeSymbols(rootPath, filePath, parseFileSymbols(filePath, content), 'workspace');

            const extension = path.extname(filePath).toLowerCase();
            if (FULL_CHUNK_EXTENSIONS.has(extension)) {
                await this.chunkAndIndexFile(rootPath, filePath, content);
            }

            if ((index + 1) % 50 === 0) {
                appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexed ${index + 1}/${total} files...`);
            }
        } catch (error) {
            appLogger.error('code-intelligence.service', `[CodeIntelligence] Failed to index ${relativeName}`, error as Error);
        }
    }

    private async storeCodeSymbols(
        rootPath: string,
        filePath: string,
        symbols: CodeSymbol[],
        mode: 'workspace' | 'update'
    ): Promise<void> {
        for (const symbol of symbols) {
            const text = mode === 'workspace'
                ? `${symbol.kind} ${symbol.name} ${symbol.signature}\n${symbol.docstring}`
                : `${symbol.kind} ${symbol.name}\n${symbol.signature}\n${symbol.docstring}`;
            const vector = await this.embedding.generateEmbedding(text);

            await this.db.storeCodeSymbol({
                id: crypto.randomUUID(),
                [WORKSPACE_COMPAT_PATH_COLUMN]: rootPath,
                file_path: filePath,
                name: symbol.name,
                kind: symbol.kind,
                line: symbol.line,
                signature: symbol.signature,
                docstring: symbol.docstring,
                vector
            });
        }
    }

    private async chunkAndIndexFile(rootPath: string, filePath: string, content: string): Promise<void> {
        const chunks: string[] = [];

        for (let start = 0; start < content.length; start += (SEMANTIC_CHUNK_SIZE - SEMANTIC_CHUNK_OVERLAP)) {
            const end = Math.min(start + SEMANTIC_CHUNK_SIZE, content.length);
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
                        workspacePath: rootPath
                    };

                    await this.db.storeSemanticFragment(fragment);
                })
            );

            for (const result of batchResults) {
                if (result.status !== 'rejected') {
                    continue;
                }

                const reason = result.reason instanceof Error
                    ? result.reason
                    : new Error(String(result.reason));
                appLogger.error('CodeIntelligenceService', `Failed to chunk/embed ${path.basename(filePath)}`, reason);
            }
        }
    }
}
