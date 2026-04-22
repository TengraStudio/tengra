/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService, SemanticFragment } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { getDataFilePath } from '@main/services/system/app-layout-paths.util';
import {
    DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
    getWorkspaceIgnoreMatcher,
} from '@main/services/workspace/workspace-ignore.util';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import {
    WorkspaceCodeMap,
    WorkspaceCodeMapFile,
    WorkspaceCodeMapFolder,
    WorkspaceCodeMapSymbol,
    WorkspaceDependencyGraph,
    WorkspaceDependencyGraphEdge,
    WorkspaceDependencyGraphNode,
} from '@shared/types';
import type { FileSearchResult } from '@shared/types/common';
import { BrowserWindow } from 'electron';

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
const SKIPPED_INCREMENTAL_INDEX_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
    '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.wav', '.flac',
    '.zip', '.tar', '.gz', '.7z', '.rar',
    '.pdf', '.db', '.sqlite', '.woff', '.woff2', '.ttf', '.eot',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.class',
]);
const SEMANTIC_CHUNK_SIZE = 1000;
const SEMANTIC_CHUNK_OVERLAP = 200;
const EMBEDDING_BATCH_SIZE = 4;
const DEPENDENCY_SCAN_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs'
]);
const RESOLVABLE_IMPORT_EXTENSIONS = [
    '', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs',
    '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.py', '/index.go', '/index.rs'
] as const;

function normalizeWorkspaceFilePath(filePath: string): string {
    return path.normalize(filePath);
}

function toRelativeWorkspacePath(rootPath: string, filePath: string): string {
    return path.relative(rootPath, filePath).replace(/\\/g, '/');
}

function isPackageDependency(specifier: string): boolean {
    return !specifier.startsWith('.') && !specifier.startsWith('/');
}

function collectDependencySpecifiers(filePath: string, content: string): string[] {
    const extension = path.extname(filePath).toLowerCase();
    const matches = new Set<string>();
    const pushMatch = (candidate: string | undefined): void => {
        if (!candidate) {
            return;
        }
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
            matches.add(trimmed);
        }
    };

    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
        for (const match of content.matchAll(/(?:import|export)\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
            pushMatch(match[1]);
        }
        for (const match of content.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            pushMatch(match[1]);
        }
    }

    if (extension === '.py') {
        for (const match of content.matchAll(/^\s*from\s+([A-Za-z0-9_./-]+)\s+import\s+/gm)) {
            pushMatch(match[1]);
        }
        for (const match of content.matchAll(/^\s*import\s+([A-Za-z0-9_.,\s-]+)/gm)) {
            const imports = match[1]?.split(',').map(item => item.trim().split(/\s+/)[0]);
            imports?.forEach(pushMatch);
        }
    }

    if (extension === '.go') {
        for (const match of content.matchAll(/^\s*import\s+(?:[A-Za-z0-9_]+\s+)?["`]([^"`]+)["`]/gm)) {
            pushMatch(match[1]);
        }
    }

    if (extension === '.rs') {
        for (const match of content.matchAll(/^\s*use\s+([A-Za-z0-9_:]+)\s*;/gm)) {
            pushMatch(match[1]);
        }
    }

    return Array.from(matches);
}

function resolveWorkspaceDependencyTarget(
    filePath: string,
    specifier: string,
    workspaceFilesByNormalizedPath: Map<string, string>
): string | null {
    if (isPackageDependency(specifier)) {
        return null;
    }

    const baseDirectory = path.dirname(filePath);
    for (const extension of RESOLVABLE_IMPORT_EXTENSIONS) {
        const candidatePath = normalizeWorkspaceFilePath(path.resolve(baseDirectory, `${specifier}${extension}`));
        const matchedPath = workspaceFilesByNormalizedPath.get(candidatePath);
        if (matchedPath) {
            return matchedPath;
        }
    }

    return null;
}

export class CodeIntelligenceService {
    private readonly indexingInProgress = new Set<string>();
    private readonly indexedWorkspaces = new Set<string>();
    private readonly derivedArtifactsInProgress = new Set<string>();
    private readonly dependencyGraphCache = new Map<string, WorkspaceDependencyGraph>();
    private readonly codeMapCache = new Map<string, WorkspaceCodeMap>();
    private manifestPath = '';

    constructor(
        private readonly db: DatabaseService,
        private readonly embedding: EmbeddingService
    ) {
        try {
            this.manifestPath = getDataFilePath('workspace', 'code-intel-manifests.json');
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

    private async getWorkspaceIndexingConfig(
        workspaceId: string
    ): Promise<{
        enabled: boolean;
        ignorePatterns: string[];
        maxFileSize: number;
        maxConcurrency: number;
    }> {
        try {
            const workspace = await this.db.getWorkspace(workspaceId);
            const advanced = workspace?.advancedOptions;
            return {
                enabled: advanced?.indexingEnabled !== false,
                ignorePatterns: [
                    ...DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
                    ...(advanced?.fileWatchIgnore ?? []),
                    ...(advanced?.indexingExclude ?? []),
                ],
                maxFileSize: advanced?.indexingMaxFileSize ?? 1024 * 1024 * 10, // 10MB default
                maxConcurrency: advanced?.maxConcurrency ?? 5, // 5 default
            };
        } catch (error) {
            appLogger.warn(
                'CodeIntelligenceService',
                `Failed to load workspace indexing config for ${workspaceId}`,
                error as Error
            );
            return {
                enabled: true,
                ignorePatterns: [...DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS],
                maxFileSize: 1024 * 1024 * 10,
                maxConcurrency: 5,
            };
        }
    }

    private async getIgnoreMatcher(rootPath: string, ignorePatterns: readonly string[] = []) {
        return getWorkspaceIgnoreMatcher(rootPath, {
            defaultPatterns: DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
            extraPatterns: ignorePatterns,
        });
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

    async getWorkspaceDependencyGraph(rootPath: string): Promise<WorkspaceDependencyGraph> {
        const cachedGraph = this.dependencyGraphCache.get(rootPath);
        if (cachedGraph) {
            return cachedGraph;
        }

        await this.refreshDerivedArtifacts(rootPath);
        return this.dependencyGraphCache.get(rootPath) ?? this.buildEmptyDependencyGraph(rootPath);
    }

    async getWorkspaceCodeMap(rootPath: string): Promise<WorkspaceCodeMap> {
        const cachedCodeMap = this.codeMapCache.get(rootPath);
        if (cachedCodeMap) {
            return cachedCodeMap;
        }

        await this.refreshDerivedArtifacts(rootPath);
        return this.codeMapCache.get(rootPath) ?? this.buildEmptyCodeMap(rootPath);
    }

    async indexWorkspace(rootPath: string, workspaceId: string, force = false): Promise<void> {
        if (!await this.shouldStartIndexing(workspaceId, rootPath, force)) {
            return;
        }

        this.indexingInProgress.add(workspaceId);
        appLogger.info('code-intelligence.service', `[CodeIntelligence] Indexing workspace ${workspaceId} at ${rootPath} (force=${force})`);

        try {
            const indexingConfig = await this.getWorkspaceIndexingConfig(workspaceId);
            if (!indexingConfig.enabled) {
                appLogger.info(
                    'code-intelligence.service',
                    `[CodeIntelligence] Skipping indexing for ${workspaceId} because indexing is disabled`
                );
                return;
            }

            const ignoreMatcher = await this.getIgnoreMatcher(
                rootPath,
                indexingConfig.ignorePatterns
            );
            this.sendIndexingProgress(workspaceId, 0, 0, 'Scanning files...');
            const files: string[] = [];
            await scanDirRecursively(rootPath, files, ignoreMatcher);

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

                    if (stats.size > indexingConfig.maxFileSize) {
                        continue;
                    }

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

            appLogger.debug('code-intelligence.service', `[CodeIntelligence] Found ${filesToIndex.length} files that need indexing.`);

            const concurrency = indexingConfig.maxConcurrency;
            for (let i = 0; i < filesToIndex.length; i += concurrency) {
                const batch = filesToIndex.slice(i, i + concurrency);
                await Promise.all(
                    batch.map((filePath, batchIndex) =>
                        this.processWorkspaceFile(workspaceId, rootPath, filePath, i + batchIndex, filesToIndex.length)
                    )
                );

                if (i > 0 && i % 50 === 0) {
                    await new Promise(r => setImmediate(r));
                }
            }
            
            allManifests[workspaceId] = { files: newFileManifest };
            await this.saveManifest(allManifests);

            this.indexedWorkspaces.add(workspaceId);
            void this.refreshDerivedArtifacts(rootPath, files);
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
            appLogger.debug('code-intelligence.service', `[CodeIntelligence] Updating index for ${filePath}`);
            this.invalidateDerivedArtifacts(rootPath);

            await this.db.deleteCodeSymbolsForFile(rootPath, filePath);
            await this.db.deleteSemanticFragmentsForFile(rootPath, filePath);

            const ignoreMatcher = await this.getIgnoreMatcher(rootPath);
            if (ignoreMatcher.ignoresAbsolute(filePath)) {
                return;
            }

            if (this.shouldSkipIncrementalIndex(filePath)) {
                return;
            }

            if (!await this.isIndexableFile(filePath)) {
                return;
            }

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

    private shouldSkipIncrementalIndex(filePath: string): boolean {
        const extension = path.extname(filePath).toLowerCase();
        return SKIPPED_INCREMENTAL_INDEX_EXTENSIONS.has(extension);
    }

    private async isIndexableFile(filePath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(filePath);
            return stats.isFile();
        } catch {
            return false;
        }
    }

    private invalidateDerivedArtifacts(rootPath: string): void {
        this.dependencyGraphCache.delete(rootPath);
        this.codeMapCache.delete(rootPath);
    }

    private async refreshDerivedArtifacts(
        rootPath: string,
        scannedFiles?: readonly string[]
    ): Promise<void> {
        if (this.derivedArtifactsInProgress.has(rootPath)) {
            return;
        }

        this.derivedArtifactsInProgress.add(rootPath);
        try {
            const files = scannedFiles ? [...scannedFiles] : await this.loadWorkspaceFiles(rootPath);
            const symbols = await this.db.getCodeSymbolsByWorkspacePath(rootPath);
            const symbolCountsByFile = new Map<string, number>();

            for (const symbol of symbols) {
                const filePath = typeof symbol.path === 'string' ? symbol.path.trim() : '';
                if (!filePath) {
                    continue;
                }
                symbolCountsByFile.set(filePath, (symbolCountsByFile.get(filePath) ?? 0) + 1);
            }

            const dependencyGraph = await this.buildWorkspaceDependencyGraph(
                rootPath,
                files,
                symbolCountsByFile
            );
            const codeMap = this.buildWorkspaceCodeMap(rootPath, symbols);

            this.dependencyGraphCache.set(rootPath, dependencyGraph);
            this.codeMapCache.set(rootPath, codeMap);
        } catch (error) {
            appLogger.error(
                'CodeIntelligenceService',
                `Failed to refresh derived workspace artifacts for ${rootPath}`,
                error as Error
            );
            this.dependencyGraphCache.set(rootPath, this.buildEmptyDependencyGraph(rootPath));
            this.codeMapCache.set(rootPath, this.buildEmptyCodeMap(rootPath));
        } finally {
            this.derivedArtifactsInProgress.delete(rootPath);
        }
    }

    private async loadWorkspaceFiles(rootPath: string): Promise<string[]> {
        const ignoreMatcher = await this.getIgnoreMatcher(rootPath);
        const files: string[] = [];
        await scanDirRecursively(rootPath, files, ignoreMatcher);
        return files;
    }

    private async buildWorkspaceDependencyGraph(
        rootPath: string,
        files: readonly string[],
        symbolCountsByFile: ReadonlyMap<string, number>
    ): Promise<WorkspaceDependencyGraph> {
        const graphFiles = files.filter(filePath =>
            DEPENDENCY_SCAN_EXTENSIONS.has(path.extname(filePath).toLowerCase())
        );
        const workspaceFilesByNormalizedPath = new Map<string, string>(
            graphFiles.map(filePath => [normalizeWorkspaceFilePath(filePath), filePath])
        );
        const inboundCounts = new Map<string, number>();
        const edges: WorkspaceDependencyGraphEdge[] = [];
        const externalDependencies = new Set<string>();
        const edgeKeys = new Set<string>();
        const externalDependencyCounts = new Map<string, number>();
        const outboundCounts = new Map<string, number>();

        for (const filePath of graphFiles) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const specifiers = collectDependencySpecifiers(filePath, content);
                for (const specifier of specifiers) {
                    const targetPath = resolveWorkspaceDependencyTarget(
                        filePath,
                        specifier,
                        workspaceFilesByNormalizedPath
                    );
                    const edge = targetPath
                        ? { from: filePath, to: targetPath, kind: 'workspace' as const, specifier }
                        : { from: filePath, to: specifier, kind: 'package' as const, specifier };
                    const edgeKey = `${edge.from}::${edge.kind}::${edge.to}`;
                    if (edgeKeys.has(edgeKey)) {
                        continue;
                    }

                    edgeKeys.add(edgeKey);
                    edges.push(edge);
                    outboundCounts.set(filePath, (outboundCounts.get(filePath) ?? 0) + 1);

                    if (edge.kind === 'workspace') {
                        inboundCounts.set(edge.to, (inboundCounts.get(edge.to) ?? 0) + 1);
                        continue;
                    }

                    externalDependencies.add(edge.to);
                    externalDependencyCounts.set(
                        filePath,
                        (externalDependencyCounts.get(filePath) ?? 0) + 1
                    );
                }
            } catch (error) {
                appLogger.warn(
                    'CodeIntelligenceService',
                    `Skipping dependency graph scan for ${path.basename(filePath)}`,
                    error as Error
                );
            }
        }

        const nodes: WorkspaceDependencyGraphNode[] = graphFiles
            .map(filePath => ({
                path: filePath,
                relativePath: toRelativeWorkspacePath(rootPath, filePath),
                extension: path.extname(filePath).toLowerCase() || '(none)',
                symbolCount: symbolCountsByFile.get(filePath) ?? 0,
                outboundDependencyCount: outboundCounts.get(filePath) ?? 0,
                inboundDependencyCount: inboundCounts.get(filePath) ?? 0,
                externalDependencyCount: externalDependencyCounts.get(filePath) ?? 0,
            }))
            .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

        return {
            rootPath,
            indexedFileCount: graphFiles.length,
            generatedAt: new Date().toISOString(),
            nodes,
            edges: edges.sort((left, right) => {
                const leftKey = `${left.from}:${left.to}:${left.kind}`;
                const rightKey = `${right.from}:${right.to}:${right.kind}`;
                return leftKey.localeCompare(rightKey);
            }),
            externalDependencies: Array.from(externalDependencies).sort((left, right) =>
                left.localeCompare(right)
            ),
        };
    }

    private buildWorkspaceCodeMap(
        rootPath: string,
        symbols: Array<{
            path?: string;
            name?: string;
            kind?: string;
            line?: number;
            signature?: string;
        }>
    ): WorkspaceCodeMap {
        const symbolsByFile = new Map<string, WorkspaceCodeMapSymbol[]>();
        const foldersByPath = new Map<string, WorkspaceCodeMapFolder>();

        for (const symbol of symbols) {
            const filePath = typeof symbol.path === 'string' ? symbol.path.trim() : '';
            if (!filePath) {
                continue;
            }

            const symbolEntry: WorkspaceCodeMapSymbol = {
                name: typeof symbol.name === 'string' ? symbol.name : '(anonymous)',
                kind: typeof symbol.kind === 'string' ? symbol.kind : 'unknown',
                line: typeof symbol.line === 'number' ? symbol.line : 1,
                signature: typeof symbol.signature === 'string' ? symbol.signature : '',
            };
            const existingSymbols = symbolsByFile.get(filePath) ?? [];
            existingSymbols.push(symbolEntry);
            symbolsByFile.set(filePath, existingSymbols);
        }

        const files: WorkspaceCodeMapFile[] = Array.from(symbolsByFile.entries())
            .map(([filePath, fileSymbols]) => {
                const relativePath = toRelativeWorkspacePath(rootPath, filePath);
                const folderPath = path.posix.dirname(relativePath);
                const folderEntry = foldersByPath.get(folderPath) ?? {
                    path: folderPath,
                    fileCount: 0,
                    symbolCount: 0,
                };
                folderEntry.fileCount += 1;
                folderEntry.symbolCount += fileSymbols.length;
                foldersByPath.set(folderPath, folderEntry);

                return {
                    path: filePath,
                    relativePath,
                    extension: path.extname(filePath).toLowerCase() || '(none)',
                    symbolCount: fileSymbols.length,
                    topLevelSymbols: [...fileSymbols]
                        .sort((left, right) => left.line - right.line || left.name.localeCompare(right.name))
                        .slice(0, 12),
                };
            })
            .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

        return {
            rootPath,
            totalFiles: files.length,
            totalSymbols: files.reduce((sum, fileEntry) => sum + fileEntry.symbolCount, 0),
            generatedAt: new Date().toISOString(),
            files,
            folders: Array.from(foldersByPath.values()).sort((left, right) => {
                return left.path.localeCompare(right.path);
            }),
        };
    }

    private buildEmptyDependencyGraph(rootPath: string): WorkspaceDependencyGraph {
        return {
            rootPath,
            indexedFileCount: 0,
            generatedAt: new Date().toISOString(),
            nodes: [],
            edges: [],
            externalDependencies: [],
        };
    }

    private buildEmptyCodeMap(rootPath: string): WorkspaceCodeMap {
        return {
            rootPath,
            totalFiles: 0,
            totalSymbols: 0,
            generatedAt: new Date().toISOString(),
            files: [],
            folders: [],
        };
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
                appLogger.debug('code-intelligence.service', `[CodeIntelligence] Indexed ${index + 1}/${total} files...`);
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
