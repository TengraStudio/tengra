/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawn } from 'child_process';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as protocol from 'vscode-languageserver-protocol';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { CacheService } from '@main/services/system/cache.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { UtilityProcessService } from '@main/services/system/utility-process.service';
import { getBundledUtilityWorkerPath } from '@main/services/system/utility-worker-path.util';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { getManagedRuntimeBinDir } from '@main/services/system/runtime-path.service';
import { LspService } from '@main/services/workspace/lsp.service';
import {
    DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS,
    getWorkspaceIgnoreMatcher,
    type WorkspaceIgnoreMatcher
} from '@main/services/workspace/workspace-ignore.util';
import { scanDirForTodos } from '@main/services/workspace/code-intelligence/file-scanner.util';
import { FileSearchResult } from '@shared/types/common';
import { t } from '@main/utils/i18n.util';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { WORKSPACE_COMPAT_FILE_VALUES } from '@shared/constants';
import { WORKSPACE_CHANNELS } from '@shared/constants/ipc-channels';
import {
    WorkspaceEnvKeySchema,
    WorkspaceEnvVarsSchema,
    WorkspaceRootPathSchema
} from '@shared/schemas/service-hardening.schema';
import { JsonObject, RuntimeValue } from '@shared/types/common';
import type {
    CodeAnnotation,
    WorkspaceAnalysis,
    WorkspaceDefinitionLocation,
    WorkspaceDiagnosticsSourceResult,
    WorkspaceDiagnosticsStatus,
    WorkspaceFilesPageMeta,
    WorkspaceIssue,
    WorkspaceLspServerSupport,
    WorkspaceStats
} from '@shared/types/workspace';
import { getErrorMessage, ValidationError } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { BrowserWindow } from 'electron';

export type {
    CodeAnnotation,
    WorkspaceAnalysis,
    WorkspaceFilesPageMeta,
    WorkspaceIssue,
    WorkspaceStats
};

export interface WorkspaceFilesPageResult extends WorkspaceFilesPageMeta {
    files: string[]
}

interface FileScanResult {
    files: string[];
    complete: boolean;
}

interface WorkspaceDirectorySizeEntry {
    path: string;
    size: number;
    fileCount: number;
}

interface StaticIssuesScanResult {
    issues: WorkspaceIssue[];
    diagnosticsStatus: WorkspaceDiagnosticsStatus;
}

interface StaticDiagnosticsCommandResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    commandNotFound: boolean;
}

const LSP_PROJECT_ROOT_MARKERS: Partial<Record<string, readonly string[]>> = {
    typescript: ['tsconfig.json', 'jsconfig.json', 'package.json'],
    javascript: ['tsconfig.json', 'jsconfig.json', 'package.json'],
    python: ['pyproject.toml', 'requirements.txt', 'setup.py'],
    go: ['go.mod'],
    rust: ['Cargo.toml'],
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'],
    php: ['composer.json'],
    yaml: ['pnpm-workspace.yaml', 'docker-compose.yml', 'docker-compose.yaml'],
};

const SPECIAL_FILE_LANGUAGE_MAP: Record<string, string> = {
    'dockerfile': 'Dockerfile',
    'containerfile': 'Containerfile',
    'makefile': 'Makefile',
    'cmakelists.txt': 'CMake',
    'gemfile': 'Ruby',
    'rakefile': 'Ruby',
    'brewfile': 'Ruby',
    'vagrantfile': 'Ruby',
    'procfile': 'Procfile',
    'jenkinsfile': 'Groovy',
    'gradlew': 'Shell',
    'mvnw': 'Shell',
};

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
    js: 'JavaScript',
    mjs: 'JavaScript',
    cjs: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    mts: 'TypeScript',
    cts: 'TypeScript',
    tsx: 'TypeScript',
    py: 'Python',
    pyi: 'Python',
    pyx: 'Python',
    pyd: 'Python',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    kt: 'Kotlin',
    kts: 'Kotlin',
    groovy: 'Groovy',
    gradle: 'Groovy',
    scala: 'Scala',
    sc: 'Scala',
    cs: 'C#',
    csx: 'C#',
    fs: 'F#',
    fsx: 'F#',
    vb: 'Visual Basic .NET',
    c: 'C',
    h: 'C/C++ Header',
    i: 'C',
    ii: 'C++',
    cpp: 'C++',
    cxx: 'C++',
    cc: 'C++',
    'c++': 'C++',
    hpp: 'C/C++ Header',
    hxx: 'C/C++ Header',
    hh: 'C/C++ Header',
    m: 'Objective-C',
    mm: 'Objective-C++',
    swift: 'Swift',
    php: 'PHP',
    phtml: 'PHP',
    php3: 'PHP',
    php4: 'PHP',
    php5: 'PHP',
    phpt: 'PHP',
    rb: 'Ruby',
    erb: 'Ruby',
    rake: 'Ruby',
    lua: 'Lua',
    pl: 'Perl',
    pm: 'Perl',
    t: 'Perl',
    pod: 'Perl POD',
    r: 'R',
    rmd: 'R Markdown',
    jl: 'Julia',
    dart: 'Dart',
    elm: 'Elm',
    ex: 'Elixir',
    exs: 'Elixir',
    erl: 'Erlang',
    hrl: 'Erlang',
    hrl2: 'Erlang',
    clj: 'Clojure',
    cljs: 'Clojure',
    cljc: 'Clojure',
    edn: 'EDN',
    hs: 'Haskell',
    lhs: 'Haskell',
    ml: 'OCaml',
    mli: 'OCaml',
    zig: 'Zig',
    nim: 'Nim',
    nims: 'Nim',
    pas: 'Pascal',
    pp: 'Pascal',
    dpr: 'Pascal',
    f: 'Fortran',
    f90: 'Fortran',
    f95: 'Fortran',
    f03: 'Fortran',
    f08: 'Fortran',
    cob: 'COBOL',
    cbl: 'COBOL',
    asm: 'Assembly',
    s: 'Assembly',
    sx: 'Assembly',
    v: 'Verilog',
    sv: 'SystemVerilog',
    vh: 'Verilog Header',
    vhd: 'VHDL',
    vhdl: 'VHDL',
    sol: 'Solidity',
    move: 'Move',
    cairo: 'Cairo',
    html: 'HTML',
    htm: 'HTML',
    xhtml: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    less: 'Less',
    styl: 'Stylus',
    pcss: 'PostCSS',
    vue: 'Vue',
    svelte: 'Svelte',
    astro: 'Astro',
    md: 'Markdown',
    markdown: 'Markdown',
    mdx: 'MDX',
    txt: 'Text',
    rst: 'reStructuredText',
    adoc: 'AsciiDoc',
    tex: 'TeX',
    bib: 'BibTeX',
    json: 'JSON',
    json5: 'JSON5',
    jsonc: 'JSONC',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    ini: 'INI',
    cfg: 'INI',
    conf: 'Config',
    env: 'Environment',
    xml: 'XML',
    xsd: 'XML Schema',
    xsl: 'XSLT',
    xslt: 'XSLT',
    svg: 'SVG',
    graphql: 'GraphQL',
    gql: 'GraphQL',
    proto: 'Protocol Buffers',
    sql: 'SQL',
    psql: 'SQL',
    ddl: 'SQL',
    sh: 'Shell',
    bash: 'Shell',
    zsh: 'Shell',
    fish: 'Shell',
    ksh: 'Shell',
    ps1: 'PowerShell',
    psm1: 'PowerShell',
    psd1: 'PowerShell',
    bat: 'Batch',
    cmd: 'Batch',
    awk: 'Awk',
    sed: 'Sed',
    dockerignore: 'Docker Ignore',
    gitignore: 'Git Ignore',
    gitattributes: 'Git Attributes',
    gitmodules: 'Git Config',
    npmrc: 'NPM Config',
    editorconfig: 'EditorConfig',
    lock: 'Lockfile',
    pem: 'PEM',
    crt: 'Certificate',
    cer: 'Certificate',
    key: 'Key',
    pub: 'Public Key',
    asc: 'ASCII Armor',
    csr: 'Certificate Request',
    diff: 'Diff',
    patch: 'Patch',
    csv: 'CSV',
    tsv: 'TSV',
    log: 'Log',
    wasm: 'WebAssembly',
};

const LANGUAGE_DISTRIBUTION_EXCLUDED_SEGMENTS = new Set([
    'vendor', 'vendors', 'third_party', 'third-party', 'external', 'extern',
    'deps', 'dependencies', 'vcpkg_installed'
]);

const LANGUAGE_DISTRIBUTION_EXCLUDED_LANGUAGES = new Set([
    'Text', 'Log', 'Markdown', 'MDX', 'reStructuredText', 'AsciiDoc', 'TeX', 'BibTeX',
    'PEM', 'Certificate', 'Key', 'Public Key', 'ASCII Armor', 'Certificate Request',
    'CSV', 'TSV', 'Diff', 'Patch', 'Docker Ignore', 'Git Ignore', 'Git Attributes',
    'Git Config', 'NPM Config', 'EditorConfig', 'Lockfile', 'Environment', 'Config',
    'INI', 'JSON', 'JSON5', 'JSONC', 'YAML', 'TOML', 'XML', 'XML Schema', 'XSLT', 'SVG'
]);

const LOG_CONTEXT = 'WorkspaceService';
type WorkspaceChangeCallback = (event: string, path: string) => void;
const WORKSPACE_SCAN_INCLUDED_PATTERNS = new Set([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
]);

function normalizeWorkspacePath(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export class WorkspaceService extends BaseService {
    private static readonly WORKER_FILE_NAME = 'workspace-scanner.worker.cjs';
    private watchers: Map<string, import('fs').FSWatcher> = new Map();
    private watchCallbacks: Map<string, Set<WorkspaceChangeCallback>> = new Map();
    private analysisCache: Map<string, { data: WorkspaceAnalysis; timestamp: number }> = new Map();
    private analysisSummaryCache: Map<string, { data: WorkspaceAnalysis; timestamp: number }> =
        new Map();
    private analysisInFlight: Map<string, Promise<WorkspaceAnalysis>> = new Map();
    private analysisSummaryInFlight: Map<string, Promise<WorkspaceAnalysis>> = new Map();
    private fileListCache: Map<string, { files: string[]; timestamp: number; complete: boolean }> = new Map();
    private changedPathSets: Map<string, Set<string>> = new Map();
    private backgroundScansInProgress: Set<string> = new Set();
    private activeWorkspaceRootPath: string | null = null;
    private readonly ANALYSIS_CACHE_TTL_MS = 300000;
    private readonly WORKSPACE_FILES_PAGE_SIZE = 1000;
    private readonly INITIAL_STATS_SAMPLE_LIMIT = 400;
    private readonly LSP_PRIME_WAIT_MS = 400;
    private readonly STATIC_DIAGNOSTICS_TIMEOUT_MS = 90_000;
    private readonly MAX_STATIC_ISSUES = 1000;

    private workerProcessId: string | null = null;
    private workerDisabled = false;

    constructor(
        private lspService?: LspService,
        private utilityProcessService?: UtilityProcessService,
        private cacheService?: CacheService,
        private proxyService?: ProxyService,
        private databaseService?: DatabaseService,
        private codeIntelligenceService?: CodeIntelligenceService,
        private jobSchedulerService?: JobSchedulerService,
        private mainWindowProvider?: () => BrowserWindow | null,
        private allowedFileRoots?: Set<string>
    ) {
        super('WorkspaceService');
    }

    /**
     * Starts watching a workspace directory for changes.
     * @param rootPath The absolute path to the workspace root.
     * @param onChange Callback triggered on file change events.
     */
    async watchWorkspace(rootPath: string, onChange: (event: string, path: string) => void): Promise<void> {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        this.logInfo(`Starting watch on ${rootPath}`);

        const callbacks = this.watchCallbacks.get(rootPath) ?? new Set<WorkspaceChangeCallback>();
        callbacks.add(onChange);
        this.watchCallbacks.set(rootPath, callbacks);

        if (!this.shouldRunActiveWorkspaceWork(rootPath)) {
            this.logInfo(`Deferring watcher for inactive workspace ${rootPath}`);
            return;
        }

        if (this.watchers.has(rootPath)) {
            return;
        }
        await this.ensureWorkspaceWatcher(rootPath);
    }

    /** Closes all file watchers and clears caches. */
    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up WorkspaceService watchers...');
        if (this.workerProcessId && this.utilityProcessService) {
            this.utilityProcessService.terminate(this.workerProcessId);
            this.workerProcessId = null;
        }
        if (this.lspService) {
            await this.lspService.dispose();
        }
        for (const [path, watcher] of this.watchers) {
            try {
                watcher.close();
            } catch (err) {
                this.logWarn(`Error closing watcher for ${path}:`, err as Error);
            }
        }
        this.watchers.clear();
        this.analysisCache.clear();
        this.analysisSummaryCache.clear();
        this.analysisInFlight.clear();
        this.analysisSummaryInFlight.clear();
        this.fileListCache.clear();
        this.changedPathSets.clear();
        this.watchCallbacks.clear();
        this.activeWorkspaceRootPath = null;
    }

    /**
     * Stops watching a specific workspace directory.
     * @param rootPath - Absolute path to the workspace root
     */
    async stopWatch(rootPath: string) {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        this.closeWorkspaceWatcher(rootPath);
        if (this.lspService) {
            await this.lspService.stopServersWithinRoot(rootPath);
        }
        this.watchCallbacks.delete(rootPath);
        this.changedPathSets.delete(rootPath);
        this.logInfo(`Stopped watching ${rootPath}`);
    }

    /**
     * Returns audit metadata for a workspace path.
     * @param rootPath - Workspace root path
     * @returns Object with rootPath and workspaceName
     */
    getAuditContext(rootPath: string): { rootPath: string; workspaceName: string } {
        const normalizedRootPath = this.resolveAndValidateRootPath(rootPath);
        return {
            rootPath: normalizedRootPath,
            workspaceName: path.basename(normalizedRootPath) || normalizedRootPath,
        };
    }

    /**
     * Gets all currently open (watched) workspace root paths.
     */
    getOpenWorkspaces(): string[] {
        return Array.from(this.watchCallbacks.keys());
    }

    async setActiveWorkspace(rootPath: string | null): Promise<void> {
        const nextRootPath = rootPath ? this.resolveAndValidateRootPath(rootPath) : null;

        if (nextRootPath === this.activeWorkspaceRootPath && this.activeWorkspaceRootPath !== null) {
            return;
        }

        const previousRootPath = this.activeWorkspaceRootPath;
        this.activeWorkspaceRootPath = nextRootPath;
        if (this.allowedFileRoots) {
            if (nextRootPath) {
                this.allowedFileRoots.add(nextRootPath);

                // Also register all mount roots
                if (this.databaseService) {
                    const workspaces = await this.databaseService.workspaces.getWorkspaces();
                    const activeWorkspace = workspaces.find(w =>
                        w.path === rootPath ||
                        this.resolveAndValidateRootPath(w.path) === nextRootPath
                    );

                    if (activeWorkspace?.mounts) {
                        activeWorkspace.mounts.forEach((mount: { rootPath?: string }) => {
                            if (mount.rootPath) {
                                const resolvedMountPath = path.resolve(mount.rootPath);
                                this.allowedFileRoots?.add(resolvedMountPath);
                            }
                        });
                    }
                }
            }

            if (nextRootPath) {
                // Automatically trigger workspace analysis in the background.
                // This ensures LSP servers are started and diagnostics are gathered as soon as the workspace is opened.
                this.analyzeWorkspace(nextRootPath).catch(err => {
                    appLogger.error(LOG_CONTEXT, 'Background workspace analysis failed', { path: nextRootPath, error: err });
                });
            }
        }

        if (previousRootPath) {
            this.closeWorkspaceWatcher(previousRootPath);
        }

        if (nextRootPath && this.watchCallbacks.has(nextRootPath)) {
            await this.ensureWorkspaceWatcher(nextRootPath);
        }
    }

    async clearActiveWorkspace(rootPath?: string): Promise<void> {
        if (rootPath) {
            const normalizedRootPath = this.resolveAndValidateRootPath(rootPath);
            if (normalizedRootPath !== this.activeWorkspaceRootPath) {
                return;
            }
        }
        await this.setActiveWorkspace(null);
    }

    getActiveWorkspace(): string | null {
        return this.activeWorkspaceRootPath;
    }

    // --- IPC Handlers ---

    @ipc(WORKSPACE_CHANNELS.WATCH)
    async watchWorkspaceIpc(rootPath: string): Promise<RuntimeValue> {
        await this.watchWorkspace(rootPath, () => { });
        return serializeToIpc(void 0);
    }

    @ipc(WORKSPACE_CHANNELS.UNWATCH)
    async unwatchIpc(rootPath: string): Promise<RuntimeValue> {
        await this.stopWatch(rootPath);
        return serializeToIpc(void 0);
    }

    @ipc(WORKSPACE_CHANNELS.SET_ACTIVE)
    async setActiveWorkspaceIpc(rootPath: string | null): Promise<RuntimeValue> {
        await this.setActiveWorkspace(rootPath);
        return serializeToIpc(void 0);
    }

    @ipc(WORKSPACE_CHANNELS.CLEAR_ACTIVE)
    async clearActiveWorkspaceIpc(rootPath?: string): Promise<RuntimeValue> {
        await this.clearActiveWorkspace(rootPath);
        return serializeToIpc(void 0);
    }

    @ipc(WORKSPACE_CHANNELS.ANALYZE)
    async analyzeWorkspaceIpc(rootPath: string): Promise<RuntimeValue> {
        const result = await this.analyzeWorkspace(rootPath);
        return serializeToIpc(result);
    }

    @ipc(WORKSPACE_CHANNELS.ANALYZE_SUMMARY)
    async analyzeWorkspaceSummaryIpc(rootPath: string): Promise<RuntimeValue> {
        const result = await this.analyzeWorkspaceSummary(rootPath);
        return serializeToIpc(result);
    }

    @ipc(WORKSPACE_CHANNELS.GET_FILE_DIAGNOSTICS)
    async getFileDiagnosticsIpc(rootPath: string, filePath: string, content: string): Promise<RuntimeValue> {
        const result = await this.getFileDiagnostics(rootPath, filePath, content);
        return serializeToIpc(result);
    }

    @ipc(WORKSPACE_CHANNELS.ANALYZE_DIRECTORY)
    async analyzeDirectoryIpc(dirPath: string): Promise<RuntimeValue> {
        const result = await this.analyzeDirectory(dirPath);
        return serializeToIpc(result);
    }

    @ipc(WORKSPACE_CHANNELS.GET_FILE_DEFINITION)
    async getFileDefinitionIpc(
        rootPath: string,
        filePath: string,
        content: string,
        position: { line: number; column: number }
    ): Promise<RuntimeValue> {
        const result = await this.getFileDefinition(
            rootPath,
            filePath,
            content,
            position.line,
            position.column
        );
        return serializeToIpc(result);
    }

    @ipc(WORKSPACE_CHANNELS.GET_ENV)
    async getEnvVarsIpc(rootPath: string): Promise<RuntimeValue> {
        const result = await this.getEnvVars(rootPath);
        return serializeToIpc(result);
    }

    @ipc(WORKSPACE_CHANNELS.SAVE_ENV)
    async saveEnvVarsIpc(rootPath: string, vars: Record<string, string>): Promise<RuntimeValue> {
        await this.saveEnvVars(rootPath, vars);
        return serializeToIpc(void 0);
    }

    @ipc(WORKSPACE_CHANNELS.PULL_DIAGNOSTICS)
    async pullDiagnosticsIpc(payload: {
        workspaceId: string;
        filePath: string;
        languageId: string;
    }): Promise<RuntimeValue> {
        if (!this.lspService) return serializeToIpc(null);
        const result = await this.lspService.pullDiagnostics(
            payload.workspaceId,
            payload.filePath,
            payload.languageId as any
        );
        return serializeToIpc(result);
    }

    @ipc(WORKSPACE_CHANNELS.GET_CODE_ACTIONS)
    async getCodeActionsIpc(payload: {
        workspaceId: string;
        filePath: string;
        languageId: string;
        range: protocol.Range;
        diagnostics: protocol.Diagnostic[];
    }): Promise<RuntimeValue> {
        if (!this.lspService) return serializeToIpc(null);
        const result = await this.lspService.getCodeActions(
            payload.workspaceId,
            payload.filePath,
            payload.languageId as any,
            payload.range,
            payload.diagnostics
        );
        return serializeToIpc(result);
    }

    private trackChangedPath(rootPath: string, changedPath: string): void {
        const normalizedRootPath = this.resolveAndValidateRootPath(rootPath);
        const normalizedChangedPath = path.resolve(changedPath);
        const changedPaths = this.changedPathSets.get(normalizedRootPath) ?? new Set<string>();
        changedPaths.add(normalizedChangedPath);
        this.changedPathSets.set(normalizedRootPath, changedPaths);
    }

    private async applyIncrementalInvalidation(rootPath: string): Promise<void> {
        const changedPaths = this.changedPathSets.get(rootPath);
        if (!changedPaths || changedPaths.size === 0) {
            return;
        }
        this.changedPathSets.delete(rootPath);

        const cachedFileList = this.fileListCache.get(rootPath);
        if (!cachedFileList) {
            this.analysisCache.delete(rootPath);
            return;
        }

        const nextFiles = new Set(cachedFileList.files);
        const ignoreMatcher = await this.getScanIgnoreMatcher(rootPath);
        for (const changedPath of changedPaths) {
            try {
                const stat = await fs.stat(changedPath);
                if (
                    stat.isFile() &&
                    !this.shouldIgnore(path.basename(changedPath)) &&
                    !ignoreMatcher.ignoresAbsolute(changedPath)
                ) {
                    nextFiles.add(changedPath);
                } else {
                    nextFiles.delete(changedPath);
                }
            } catch {
                nextFiles.delete(changedPath);
            }
        }
        this.updateFileList(rootPath, nextFiles, cachedFileList.complete);
    }

    private updateFileList(rootPath: string, nextFiles: Set<string>, complete: boolean) {
        if (!nextFiles || !(nextFiles instanceof Set)) {
            appLogger.error(LOG_CONTEXT, 'updateFileList called with invalid nextFiles', { type: typeof nextFiles });
            return;
        }
        const updatedFiles = Array.from(nextFiles).sort();
        const timestamp = Date.now();
        this.fileListCache.set(rootPath, { files: updatedFiles, timestamp, complete: complete });
        const cachedAnalysis = this.analysisCache.get(rootPath);
        if (!cachedAnalysis) {
            const cachedSummary = this.analysisSummaryCache.get(rootPath);
            if (!cachedSummary) {
                return;
            }
            const summaryFilePage = this.paginateFiles(updatedFiles, 0, this.WORKSPACE_FILES_PAGE_SIZE);
            this.analysisSummaryCache.set(rootPath, {
                timestamp,
                data: {
                    ...cachedSummary.data,
                    files: summaryFilePage.files,
                    filesPage: {
                        offset: summaryFilePage.offset,
                        limit: summaryFilePage.limit,
                        total: summaryFilePage.total,
                        hasMore: summaryFilePage.hasMore,
                    },
                    stats: {
                        ...cachedSummary.data.stats,
                        fileCount: updatedFiles.length,
                    },
                },
            });
            return;
        }
        const initialFilePage = this.paginateFiles(updatedFiles, 0, this.WORKSPACE_FILES_PAGE_SIZE);
        this.analysisCache.set(rootPath, {
            timestamp,
            data: {
                ...cachedAnalysis.data,
                files: initialFilePage.files,
                filesPage: {
                    offset: initialFilePage.offset,
                    limit: initialFilePage.limit,
                    total: initialFilePage.total,
                    hasMore: initialFilePage.hasMore,
                },
                stats: {
                    ...cachedAnalysis.data.stats,
                    fileCount: updatedFiles.length,
                },
            },
        });
        const cachedSummary = this.analysisSummaryCache.get(rootPath);
        if (!cachedSummary) {
            return;
        }
        this.analysisSummaryCache.set(rootPath, {
            timestamp,
            data: {
                ...cachedSummary.data,
                files: initialFilePage.files,
                filesPage: {
                    offset: initialFilePage.offset,
                    limit: initialFilePage.limit,
                    total: initialFilePage.total,
                    hasMore: initialFilePage.hasMore,
                },
                stats: {
                    ...cachedSummary.data.stats,
                    fileCount: updatedFiles.length,
                },
            },
        });
    }

    private async buildWorkspaceAnalysis(
        rootPath: string,
        options?: { includeIssues?: boolean }
    ): Promise<{ analysis: WorkspaceAnalysis; scanComplete: boolean; files: string[] }> {
        this.logInfo('Analyzing workspace at (normalized):', { rootPath });
        const runStart = Date.now();
        const includeIssues = options?.includeIssues !== false;

        const scanResult = await this.scanFiles(rootPath);
        const files = scanResult.files;
        const type = await this.detectType(files);
        const { frameworks, dependencies, devDependencies } = await this.analyzeDependencies(
            rootPath,
            type,
            files
        );
        const stats = await this.calculateStats(
            rootPath,
            files,
            scanResult.complete ? files.length : this.INITIAL_STATS_SAMPLE_LIMIT
        );
        const languages = await this.calculateLanguages(files);
        const monorepo = await this.detectMonorepo(rootPath, files);
        const initialFilePage = this.paginateFiles(files, 0, this.WORKSPACE_FILES_PAGE_SIZE);
        const staticIssues = includeIssues ? await this.findStaticIssues(rootPath, files) : undefined;
        const annotations = includeIssues ? await this.findAnnotations(rootPath, files) : undefined;
        const lspDiagnostics = includeIssues ? [] : undefined;
        const lspServers = this.collectLspServerSupport(rootPath, files);

        this.logDebug(`Analysis complete in ${Date.now() - runStart}ms`);

        return {
            analysis: {
                type,
                frameworks,
                dependencies,
                devDependencies,
                stats,
                languages,
                files: initialFilePage.files,
                filesPage: {
                    offset: initialFilePage.offset,
                    limit: initialFilePage.limit,
                    total: initialFilePage.total,
                    hasMore: initialFilePage.hasMore
                },
                monorepo,
                todos: [],
                issues: staticIssues?.issues,
                annotations,
                lspDiagnostics,
                lspServers,
                diagnosticsStatus: staticIssues?.diagnosticsStatus,
            },
            scanComplete: scanResult.complete,
            files,
        };
    }

    /**
     * Analyzes a workspace to determine its type, dependencies, structure, and stats.
     * Results are cached for 5 minutes.
     * @param rootPath The absolute path to the workspace root.
     * @returns Detailed workspace analysis.
     */
    async analyzeWorkspace(rootPath: string): Promise<WorkspaceAnalysis> {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        await this.applyIncrementalInvalidation(rootPath);

        // Cache Check (5 min TTL)
        const cached = this.analysisCache.get(rootPath);
        if (cached !== undefined && (Date.now() - cached.timestamp < this.ANALYSIS_CACHE_TTL_MS)) {
            this.logDebug('Returning cached workspace analysis for:', rootPath);
            const cachedFiles = this.fileListCache.get(rootPath)?.files ?? [];
            const ignoreMatcher = await this.getScanIgnoreMatcher(rootPath);
            if (cachedFiles.length > 0) {
                await this.ensureLspReady(rootPath, cachedFiles, cached.data.type);
            }
            const refreshedDiagnostics = this.collectLspDiagnostics(
                rootPath,
                rootPath,
                undefined,
                ignoreMatcher
            );
            const refreshedAnalysis: WorkspaceAnalysis = {
                ...cached.data,
                lspDiagnostics: refreshedDiagnostics,
                lspServers: this.collectLspServerSupport(rootPath, cachedFiles),
            };
            this.analysisCache.set(rootPath, { data: refreshedAnalysis, timestamp: Date.now() });
            return refreshedAnalysis;
        }

        const existingRequest = this.analysisInFlight.get(rootPath);
        if (existingRequest) {
            this.logDebug('Joining in-flight workspace analysis for:', rootPath);
            return existingRequest;
        }

        const analysisRequest = (async (): Promise<WorkspaceAnalysis> => {
            const { analysis, scanComplete, files } = await this.buildWorkspaceAnalysis(rootPath);
            const ignoreMatcher = await this.getScanIgnoreMatcher(rootPath);
            await this.ensureLspReady(rootPath, files, analysis.type);
            analysis.lspDiagnostics = await this.waitForWorkspaceDiagnostics(
                rootPath,
                rootPath,
                ignoreMatcher
            );
            analysis.lspServers = this.collectLspServerSupport(rootPath, files);

            const timestamp = Date.now();
            this.analysisCache.set(rootPath, { data: analysis, timestamp });
            this.fileListCache.set(rootPath, { files, timestamp, complete: scanComplete });
            this.analysisSummaryCache.set(rootPath, { data: analysis, timestamp });
            if (!scanComplete && this.shouldRunActiveWorkspaceWork(rootPath)) {
                this.startBackgroundWorkspaceScan(rootPath);
            }
            return analysis;
        })();

        this.analysisInFlight.set(rootPath, analysisRequest);
        try {
            return await analysisRequest;
        } finally {
            this.analysisInFlight.delete(rootPath);
        }
    }

    async analyzeWorkspaceSummary(rootPath: string): Promise<WorkspaceAnalysis> {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        await this.applyIncrementalInvalidation(rootPath);

        const cachedSummary = this.analysisSummaryCache.get(rootPath);
        if (
            cachedSummary !== undefined &&
            Date.now() - cachedSummary.timestamp < this.ANALYSIS_CACHE_TTL_MS
        ) {
            this.logDebug('Returning cached workspace analysis summary for:', rootPath);
            return cachedSummary.data;
        }

        const existingRequest = this.analysisSummaryInFlight.get(rootPath);
        if (existingRequest) {
            this.logDebug('Joining in-flight workspace analysis summary for:', rootPath);
            return existingRequest;
        }

        const summaryRequest = (async (): Promise<WorkspaceAnalysis> => {
            const { analysis, scanComplete, files } = await this.buildWorkspaceAnalysis(rootPath, {
                includeIssues: false,
            });
            const timestamp = Date.now();
            this.analysisSummaryCache.set(rootPath, { data: analysis, timestamp });
            this.fileListCache.set(rootPath, { files, timestamp, complete: scanComplete });
            return analysis;
        })();

        this.analysisSummaryInFlight.set(rootPath, summaryRequest);
        try {
            return await summaryRequest;
        } finally {
            this.analysisSummaryInFlight.delete(rootPath);
        }
    }

    async getFileDiagnostics(rootPath: string, filePath: string, content: string): Promise<WorkspaceIssue[]> {
        const normalizedRootPath = this.resolveAndValidateRootPath(rootPath);
        const normalizedFilePath = this.resolveWorkspaceFilePath(normalizedRootPath, filePath);
        const normalizedContent = typeof content === 'string' ? content : '';
        const ignoreMatcher = await this.getScanIgnoreMatcher(normalizedRootPath);
        if (ignoreMatcher.ignoresAbsolute(normalizedFilePath)) {
            return [];
        }

        if (!this.lspService) {
            return [];
        }

        const languageId = this.lspService.getLanguageIdForFile(normalizedFilePath);
        if (!languageId) {
            return [];
        }

        const lspWorkspaceRoot = await this.resolveLspProjectRoot(
            normalizedRootPath,
            normalizedFilePath,
            languageId
        );

        await this.lspService.startServer(lspWorkspaceRoot, lspWorkspaceRoot, languageId);
        await this.lspService.openDocument(
            lspWorkspaceRoot,
            normalizedFilePath,
            languageId,
            normalizedContent
        );

        return this.waitForFileDiagnostics(
            lspWorkspaceRoot,
            normalizedRootPath,
            this.toFileUri(normalizedFilePath),
            ignoreMatcher
        );
    }

    async getFileDefinition(
        rootPath: string,
        filePath: string,
        content: string,
        line: number,
        column: number
    ): Promise<WorkspaceDefinitionLocation[]> {
        const normalizedRootPath = this.resolveAndValidateRootPath(rootPath);
        const normalizedFilePath = this.resolveWorkspaceFilePath(normalizedRootPath, filePath);
        const normalizedContent = typeof content === 'string' ? content : '';

        if (!this.lspService) {
            return [];
        }

        const languageId = this.lspService.getLanguageIdForFile(normalizedFilePath);
        if (!languageId) {
            return [];
        }

        const lspWorkspaceRoot = await this.resolveLspProjectRoot(
            normalizedRootPath,
            normalizedFilePath,
            languageId
        );

        await this.lspService.startServer(lspWorkspaceRoot, lspWorkspaceRoot, languageId);
        await this.lspService.openDocument(
            lspWorkspaceRoot,
            normalizedFilePath,
            languageId,
            normalizedContent
        );

        const definitions = await this.lspService.getDefinition(
            lspWorkspaceRoot,
            normalizedFilePath,
            languageId,
            line,
            column
        );

        return definitions
            .map(definition => this.resolveLspDefinitionLocation(definition.uri, definition.line, definition.column))
            .filter((definition): definition is WorkspaceDefinitionLocation => definition !== null);
    }

    /**
     * Returns a lazily paginated file list for previously scanned workspace analysis results.
     * @param rootPath The absolute path to the workspace root.
     * @param offset Starting offset for pagination.
     * @param limit Number of files to return.
     */
    async getWorkspaceFilePage(rootPath: string, offset = 0, limit = this.WORKSPACE_FILES_PAGE_SIZE): Promise<WorkspaceFilesPageResult> {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        await this.applyIncrementalInvalidation(rootPath);

        const cachedFiles = this.fileListCache.get(rootPath);
        const isCacheValid = cachedFiles !== undefined &&
            (Date.now() - cachedFiles.timestamp < this.ANALYSIS_CACHE_TTL_MS);
        let files = cachedFiles?.files;

        if (!files || !isCacheValid) {
            const scanResult = await this.scanFiles(rootPath);
            files = scanResult.files;
            this.fileListCache.set(rootPath, { files, timestamp: Date.now(), complete: scanResult.complete });
        } else if (!cachedFiles.complete && this.shouldRunActiveWorkspaceWork(rootPath)) {
            this.startBackgroundWorkspaceScan(rootPath);
        }

        return this.paginateFiles(files, offset, limit);
    }

    private startBackgroundWorkspaceScan(rootPath: string): void {
        if (!this.shouldRunActiveWorkspaceWork(rootPath)) {
            return;
        }
        if (this.backgroundScansInProgress.has(rootPath)) {
            return;
        }

        this.backgroundScansInProgress.add(rootPath);
        void (async () => {
            try {
                const fullScan = await this.scanFiles(rootPath);
                const timestamp = Date.now();
                const type = await this.detectType(fullScan.files);
                const { frameworks, dependencies, devDependencies } = await this.analyzeDependencies(
                    rootPath,
                    type,
                    fullScan.files
                );
                const stats = await this.calculateStats(rootPath, fullScan.files);
                const languages = await this.calculateLanguages(fullScan.files);
                const monorepo = await this.detectMonorepo(rootPath, fullScan.files);
                const staticIssues = await this.findStaticIssues(rootPath, fullScan.files);
                const annotations = await this.findAnnotations(rootPath, fullScan.files);
                this.fileListCache.set(rootPath, {
                    files: fullScan.files,
                    timestamp,
                    complete: fullScan.complete,
                });

                const cachedAnalysis = this.analysisCache.get(rootPath);
                if (cachedAnalysis) {
                    const initialFilePage = this.paginateFiles(
                        fullScan.files,
                        0,
                        this.WORKSPACE_FILES_PAGE_SIZE
                    );
                    this.analysisCache.set(rootPath, {
                        timestamp,
                        data: {
                            ...cachedAnalysis.data,
                            type,
                            frameworks,
                            dependencies,
                            devDependencies,
                            stats,
                            languages,
                            files: initialFilePage.files,
                            filesPage: {
                                offset: initialFilePage.offset,
                                limit: initialFilePage.limit,
                                total: initialFilePage.total,
                                hasMore: initialFilePage.hasMore,
                            },
                            monorepo,
                            issues: staticIssues.issues,
                            annotations,
                            diagnosticsStatus: staticIssues.diagnosticsStatus,
                        },
                    });
                }
                const cachedSummary = this.analysisSummaryCache.get(rootPath);
                if (cachedSummary) {
                    const initialFilePage = this.paginateFiles(
                        fullScan.files,
                        0,
                        this.WORKSPACE_FILES_PAGE_SIZE
                    );
                    this.analysisSummaryCache.set(rootPath, {
                        timestamp,
                        data: {
                            ...cachedSummary.data,
                            type,
                            frameworks,
                            dependencies,
                            devDependencies,
                            stats,
                            languages,
                            files: initialFilePage.files,
                            filesPage: {
                                offset: initialFilePage.offset,
                                limit: initialFilePage.limit,
                                total: initialFilePage.total,
                                hasMore: initialFilePage.hasMore,
                            },
                            monorepo,
                        },
                    });
                }
            } catch (error) {
                this.logWarn('Background workspace scan failed:', getErrorMessage(error as Error));
            } finally {
                this.backgroundScansInProgress.delete(rootPath);
            }
        })();
    }

    private async ensureWorkspaceWatcher(rootPath: string): Promise<void> {
        this.closeWorkspaceWatcher(rootPath);

        try {
            const { watch } = await import('fs');
            const eventThrottleMap = new Map<string, number>();
            const EVENT_THROTTLE_MS = 150;

            const watcher = watch(rootPath, { recursive: true }, (event, filename) => {
                if (!filename || filename.includes('node_modules') || filename.includes('.git')) {
                    return;
                }
                const fileName = filename.toString();
                const absolutePath = path.join(rootPath, fileName);
                if (!this.shouldEmitWorkspaceEvent(eventThrottleMap, event, absolutePath, EVENT_THROTTLE_MS)) {
                    return;
                }
                this.trackChangedPath(rootPath, absolutePath);
                this.emitWorkspaceChange(rootPath, event, absolutePath);
            });

            watcher.on('error', (err) => this.logError(`Error on ${rootPath}:`, err));
            this.watchers.set(rootPath, watcher);
        } catch (error) {
            this.logWarn(`Failed to watch ${rootPath}:`, getErrorMessage(error as Error));
        }
    }

    private shouldEmitWorkspaceEvent(
        eventThrottleMap: Map<string, number>,
        event: string,
        absolutePath: string,
        throttleMs: number
    ): boolean {
        const throttleKey = `${event}:${absolutePath}`;
        const now = Date.now();
        const lastEmittedAt = eventThrottleMap.get(throttleKey) ?? 0;
        if (now - lastEmittedAt < throttleMs) {
            return false;
        }
        eventThrottleMap.set(throttleKey, now);
        return true;
    }

    private emitWorkspaceChange(rootPath: string, event: string, absolutePath: string): void {
        const callbacks = this.watchCallbacks.get(rootPath);
        if (callbacks && callbacks.size > 0) {
            for (const callback of callbacks) {
                try {
                    callback(event, absolutePath);
                } catch (err) {
                    this.logWarn(`Error in watch callback for ${rootPath}:`, err as Error);
                }
            }
        }

        const mainWindow = this.mainWindowProvider?.();
        if (mainWindow) {
            mainWindow.webContents.send(WORKSPACE_CHANNELS.FILE_CHANGE_EVENT, {
                event,
                path: absolutePath,
                rootPath
            });
        }
    }

    private closeWorkspaceWatcher(rootPath: string): void {
        const watcher = this.watchers.get(rootPath);
        if (!watcher) {
            return;
        }
        watcher.close();
        this.watchers.delete(rootPath);
    }

    private shouldRunActiveWorkspaceWork(rootPath: string): boolean {
        return this.activeWorkspaceRootPath === null || this.activeWorkspaceRootPath === rootPath;
    }

    private paginateFiles(files: string[], offset: number, limit: number): WorkspaceFilesPageResult {
        if (!Array.isArray(files)) {
            return { files: [], offset: 0, limit, total: 0, hasMore: false };
        }
        const safeOffset = Math.max(0, Math.floor(offset));
        const safeLimit = Math.max(1, Math.floor(limit));
        const pagedFiles = files.slice(safeOffset, safeOffset + safeLimit);
        return {
            files: pagedFiles,
            offset: safeOffset,
            limit: safeLimit,
            total: files.length,
            hasMore: safeOffset + safeLimit < files.length
        };
    }

    private async detectMonorepo(rootPath: string, files: string[]): Promise<WorkspaceAnalysis['monorepo'] | undefined> {
        try {
            const fileNames = files.map(f => path.basename(f).toLowerCase());

            if (fileNames.includes('pnpm-workspace.yaml')) {
                return { type: 'pnpm', packages: await this.findPackages(rootPath, 'pnpm-workspace.yaml') };
            }
            if (fileNames.includes('lerna.json')) {
                return { type: 'lerna', packages: await this.findPackages(rootPath, 'lerna.json') };
            }
            if (fileNames.includes('package.json')) {
                const npmWorkspace = await this.checkNpmWorkspace(rootPath);
                if (npmWorkspace) { return npmWorkspace; }
            }

            const gradleWorkspace = await this.checkGradleWorkspace(rootPath, fileNames);
            if (gradleWorkspace) { return gradleWorkspace; }

            if (fileNames.includes('turbo.json')) {
                return { type: 'turbo', packages: [] };
            }

        } catch (e) {
            this.logWarn('Monorepo detection failed:', getErrorMessage(e as Error));
        }
        return undefined;
    }

    private async checkNpmWorkspace(rootPath: string): Promise<WorkspaceAnalysis['monorepo'] | undefined> {
        const pkgPath = path.join(rootPath, 'package.json');
        const content = await fs.readFile(pkgPath, 'utf-8');
        const pkg = safeJsonParse<{ workspaces?: string[] }>(content, {});
        if (pkg.workspaces) {
            return { type: 'npm', packages: pkg.workspaces };
        }
        return undefined;
    }

    private async checkGradleWorkspace(rootPath: string, fileNames: string[]): Promise<WorkspaceAnalysis['monorepo'] | undefined> {
        const gradleSettings = fileNames.find(f => f === 'settings.gradle' || f === 'settings.gradle.kts');
        if (gradleSettings) {
            const settingsPath = path.join(rootPath, gradleSettings);
            const content = await fs.readFile(settingsPath, 'utf-8');
            const moduleMatches = content.matchAll(/include\s*\(?([\s\S]*?)\)?(?:\n|$)/g);
            const packages: string[] = [];
            for (const m of moduleMatches) {
                const block = m[1];
                const names = block.matchAll(/['"]:?([^'"]+)['"]/g);
                for (const n of names) {
                    if (n[1]) { packages.push(n[1]); }
                }
            }
            if (packages.length > 0) {
                return { type: 'unknown', packages };
            }
        }
        return undefined;
    }

    private async findAnnotations(rootPath: string, files: string[]): Promise<CodeAnnotation[]> {
        const results: FileSearchResult[] = [];
        const ignoreMatcher = await this.getScanIgnoreMatcher(rootPath);
        await scanDirForTodos(rootPath, results, ignoreMatcher);

        return results.map(res => ({
            file: res.file,
            line: res.line,
            message: res.text,
            type: (res.type?.toLowerCase() as any) || 'todo'
        }));
    }

    private async findStaticIssues(rootPath: string, files: string[]): Promise<{ issues: WorkspaceIssue[]; diagnosticsStatus: WorkspaceDiagnosticsStatus }> {
        const issueBuckets: WorkspaceIssue[] = [];
        const sources: WorkspaceDiagnosticsSourceResult[] = [];
        const ignoreMatcher = await this.getScanIgnoreMatcher(rootPath);
        const t = (key: string) => key; // Fallback for i18n
        const hasJsOrTsSources = files.some(file => /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/i.test(file));

        // 1. Biome (Native-First)
        if (hasJsOrTsSources) {
            const biomeResult = await this.runStaticDiagnosticsCommand(
                rootPath,
                ['--no-install', 'biome', 'check', '--format=json', '--no-errors-on-unmatched'],
                this.STATIC_DIAGNOSTICS_TIMEOUT_MS
            );

            if (!biomeResult.commandNotFound && !biomeResult.timedOut) {
                const parsed = this.parseBiomeIssues(rootPath, biomeResult.stdout);
                const filtered = parsed.filter(issue => !ignoreMatcher.ignoresAbsolute(path.resolve(rootPath, issue.file)));
                issueBuckets.push(...filtered);
                sources.push({
                    source: 'biome',
                    status: biomeResult.exitCode === 0 || biomeResult.exitCode === 1 ? 'ok' : 'failed',
                    issueCount: parsed.length,
                    message: biomeResult.exitCode === 0 || biomeResult.exitCode === 1
                        ? undefined
                        : `Exited with code ${biomeResult.exitCode ?? 'unknown'}.`,
                });
            } else if (biomeResult.commandNotFound) {
                sources.push({
                    source: 'biome',
                    status: 'skipped',
                    message: 'Biome binary not found.',
                });
            }
        }

        // 2. Ruff (Native Python Analysis)
        const hasPythonSources = files.some(file => /\.pyi?$/i.test(file));
        if (hasPythonSources) {
            const ruffResult = await this.runStaticDiagnosticsCommand(
                rootPath,
                ['--no-install', 'ruff', 'check', '--format', 'json'],
                this.STATIC_DIAGNOSTICS_TIMEOUT_MS
            );

            if (!ruffResult.commandNotFound && !ruffResult.timedOut) {
                const parsed = this.parseRuffIssues(rootPath, ruffResult.stdout);
                const filtered = parsed.filter(issue => !ignoreMatcher.ignoresAbsolute(path.resolve(rootPath, issue.file)));
                issueBuckets.push(...filtered);
                sources.push({
                    source: 'ruff',
                    status: ruffResult.exitCode === 0 || ruffResult.exitCode === 1 ? 'ok' : 'failed',
                    issueCount: parsed.length,
                    message: ruffResult.exitCode === 0 || ruffResult.exitCode === 1
                        ? undefined
                        : `Exited with code ${ruffResult.exitCode ?? 'unknown'}.`,
                });
            } else if (ruffResult.commandNotFound) {
                sources.push({
                    source: 'ruff',
                    status: 'skipped',
                    message: 'Ruff binary not found.',
                });
            }
        }

        // 3. golangci-lint (Native Go Analysis)
        const hasGoSources = files.some(file => /\.go$/i.test(file));
        if (hasGoSources) {
            const goResult = await this.runStaticDiagnosticsCommand(
                rootPath,
                ['--no-install', 'golangci-lint', 'run', '--out-format', 'json', '--timeout', '5m'],
                Math.max(this.STATIC_DIAGNOSTICS_TIMEOUT_MS, 300000) // Go linting can be slow on first run
            );

            if (!goResult.commandNotFound && !goResult.timedOut) {
                const parsed = this.parseGoIssues(rootPath, goResult.stdout);
                const filtered = parsed.filter(issue => !ignoreMatcher.ignoresAbsolute(path.resolve(rootPath, issue.file)));
                issueBuckets.push(...filtered);
                sources.push({
                    source: 'golangci-lint',
                    status: goResult.exitCode === 0 || goResult.exitCode === 1 ? 'ok' : 'failed',
                    issueCount: parsed.length,
                    message: goResult.exitCode === 0 || goResult.exitCode === 1
                        ? undefined
                        : `Exited with code ${goResult.exitCode ?? 'unknown'}.`,
                });
            } else if (goResult.commandNotFound) {
                sources.push({
                    source: 'golangci-lint',
                    status: 'skipped',
                    message: 'golangci-lint binary not found.',
                });
            }
        }

        const hasTypeScriptConfig = await this.workspaceHasAnyFile(rootPath, ['tsconfig.json', 'jsconfig.json']);
        if (hasJsOrTsSources && hasTypeScriptConfig) {
            const tscResult = await this.runStaticDiagnosticsCommand(
                rootPath,
                ['--no-install', 'tsc', '--noEmit', '--pretty', 'false'],
                this.STATIC_DIAGNOSTICS_TIMEOUT_MS
            );
            if (tscResult.commandNotFound) {
                sources.push({
                    source: 'tsc',
                    status: 'failed',
                    message: 'npx or tsc not found on PATH.',
                });
            } else if (tscResult.timedOut) {
                sources.push({
                    source: 'tsc',
                    status: 'failed',
                    message: `Timed out after ${this.STATIC_DIAGNOSTICS_TIMEOUT_MS}ms.`,
                });
            } else {
                const parsed = this.parseTypeScriptIssues(rootPath, tscResult.stdout, tscResult.stderr);
                const filtered = parsed.filter(issue => !ignoreMatcher.ignoresAbsolute(path.resolve(rootPath, issue.file)));
                issueBuckets.push(...filtered);
                sources.push({
                    source: 'tsc',
                    status: tscResult.exitCode === 0 || tscResult.exitCode === 1 || tscResult.exitCode === 2 ? 'ok' : 'failed',
                    issueCount: parsed.length,
                    message: tscResult.exitCode === 0 || tscResult.exitCode === 1 || tscResult.exitCode === 2
                        ? undefined
                        : `Exited with code ${tscResult.exitCode ?? 'unknown'}.`,
                });
            }
        } else {
            sources.push({
                source: 'tsc',
                status: 'skipped',
                message: t('backend.noTypescriptjavascriptProjectConfigDetec'),
            });
        }

        const hasEslintConfig = await this.hasEslintConfig(rootPath);
        if (hasJsOrTsSources && hasEslintConfig) {
            const eslintResult = await this.runStaticDiagnosticsCommand(
                rootPath,
                ['--no-install', 'eslint', '.', '--format', 'json', '--no-error-on-unmatched-pattern'],
                this.STATIC_DIAGNOSTICS_TIMEOUT_MS
            );
            if (eslintResult.commandNotFound) {
                sources.push({
                    source: 'eslint',
                    status: 'failed',
                    message: 'npx or eslint not found on PATH.',
                });
            } else if (eslintResult.timedOut) {
                sources.push({
                    source: 'eslint',
                    status: 'failed',
                    message: `Timed out after ${this.STATIC_DIAGNOSTICS_TIMEOUT_MS}ms.`,
                });
            } else {
                const parsed = this.parseEslintIssues(rootPath, eslintResult.stdout, eslintResult.stderr);
                const filtered = parsed.filter(issue => !ignoreMatcher.ignoresAbsolute(path.resolve(rootPath, issue.file)));
                issueBuckets.push(...filtered);
                sources.push({
                    source: 'eslint',
                    status: eslintResult.exitCode === 0 || eslintResult.exitCode === 1 ? 'ok' : 'failed',
                    issueCount: parsed.length,
                    message: eslintResult.exitCode === 0 || eslintResult.exitCode === 1
                        ? undefined
                        : `Exited with code ${eslintResult.exitCode ?? 'unknown'}.`,
                });
            }
        } else {
            sources.push({
                source: 'eslint',
                status: 'skipped',
                message: hasJsOrTsSources
                    ? 'No ESLint config found.'
                    : 'No JavaScript/TypeScript source files detected.',
            });
        }

        const filteredIssues = issueBuckets
            .filter(issue => !ignoreMatcher.ignoresAbsolute(path.resolve(rootPath, issue.file)))
            .slice(0, this.MAX_STATIC_ISSUES);

        return {
            issues: filteredIssues,
            diagnosticsStatus: {
                partial: sources.some(source => source.status === 'failed'),
                generatedAt: Date.now(),
                sources,
            },
        };
    }

    private async runStaticDiagnosticsCommand(
        rootPath: string,
        args: string[],
        timeoutMs: number
    ): Promise<StaticDiagnosticsCommandResult> {
        const toolName = args[1];
        const toolArgs = args.slice(2);

        const localToolBinaryPath = await this.resolveLocalDiagnosticBinary(rootPath, toolName);
        if (localToolBinaryPath) {
            const localResult = await this.executeStaticDiagnosticsCommand(
                rootPath,
                localToolBinaryPath,
                toolArgs,
                timeoutMs
            );
            if (!localResult.commandNotFound && !/EINVAL/i.test(localResult.stderr)) {
                return localResult;
            }
        }

        const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const npxResult = await this.executeStaticDiagnosticsCommand(
            rootPath,
            npxCommand,
            args,
            timeoutMs
        );
        if (npxResult.commandNotFound || /EINVAL/i.test(npxResult.stderr)) {
            return await this.executeStaticDiagnosticsCommand(
                rootPath,
                'npx',
                args,
                timeoutMs,
                true
            );
        }
        return npxResult;
    }

    private async executeStaticDiagnosticsCommand(
        rootPath: string,
        command: string,
        args: string[],
        timeoutMs: number,
        shell = false
    ): Promise<StaticDiagnosticsCommandResult> {
        const proxyResult = await this.executeStaticDiagnosticsViaProxy(rootPath, command, args, timeoutMs);
        if (proxyResult) {
            return proxyResult;
        }

        return await new Promise(resolve => {
            let child: import('child_process').ChildProcess;
            try {
                let spawnCommand = command;
                let spawnArgs = args;
                let useShell = shell;

                if (process.platform === 'win32' && (command.toLowerCase().endsWith('.cmd') || command.toLowerCase().endsWith('.bat'))) {
                    spawnCommand = process.env.ComSpec || 'cmd.exe';
                    spawnArgs = ['/d', '/s', '/c', command, ...args];
                    useShell = false;
                }

                child = spawn(spawnCommand, spawnArgs, {
                    cwd: rootPath,
                    shell: useShell,
                    windowsHide: true,
                });
            } catch (error) {
                const message = getErrorMessage(error as Error);
                resolve({
                    exitCode: null,
                    stdout: '',
                    stderr: message,
                    timedOut: false,
                    commandNotFound: /ENOENT/i.test(message),
                });
                return;
            }

            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let commandNotFound = false;
            const timeoutHandle = setTimeout(() => {
                timedOut = true;
                child.kill();
            }, timeoutMs);

            child.stdout?.on('data', chunk => {
                stdout += String(chunk);
            });
            child.stderr?.on('data', chunk => {
                stderr += String(chunk);
            });
            child.on('error', error => {
                const message = getErrorMessage(error);
                commandNotFound = /ENOENT/i.test(message);
                stderr += message;
            });
            child.on('close', code => {
                this.logInfo(`Diagnostic command "${command}" finished with exit code ${code}. Stdout length: ${stdout.length}, Stderr length: ${stderr.length}`);
                if (stderr.length > 0 && stdout.length === 0) {
                    this.logWarn(`Diagnostic command "${command}" stderr: ${stderr.split('\n')[0]}`);
                }
                clearTimeout(timeoutHandle);
                resolve({
                    exitCode: code,
                    stdout,
                    stderr,
                    timedOut,
                    commandNotFound,
                });
            });
        });
    }

    private async executeStaticDiagnosticsViaProxy(
        _rootPath: string,
        _command: string,
        _args: string[],
        _timeoutMs: number
    ): Promise<StaticDiagnosticsCommandResult | null> {
        // Disable proxy execution for diagnostics as it may trigger visible terminal windows.
        // Local execution is preferred and guaranteed to be hidden.
        return null;
    }

    private async resolveLocalDiagnosticBinary(
        rootPath: string,
        toolName: string | undefined
    ): Promise<string | null> {
        if (!toolName) {
            return null;
        }

        // 1. Check managed runtime bin directory (Native-First priority)
        const managedBinDir = getManagedRuntimeBinDir();
        const managedName = process.platform === 'win32' ? `${toolName}.exe` : toolName;
        const managedPath = path.join(managedBinDir, managedName);
        if (existsSync(managedPath)) {
            return managedPath;
        }

        // 2. Check local node_modules by walking up directory tree
        const binaryName = process.platform === 'win32' ? `${toolName}.cmd` : toolName;
        let currentDir = rootPath;
        while (true) {
            const binaryPath = path.join(currentDir, 'node_modules', '.bin', binaryName);
            try {
                await fs.access(binaryPath);
                return binaryPath;
            } catch {
                // Not found in this directory
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break; // Reached root
            }
            currentDir = parentDir;
        }
        
        return null;
    }

    private parseTypeScriptIssues(rootPath: string, stdout: string, stderr: string): WorkspaceIssue[] {
        const combinedOutput = `${stdout}\n${stderr}`;
        const lines = combinedOutput.split(/\r?\n/);
        const diagnostics: WorkspaceIssue[] = [];
        for (const line of lines) {
            const compactLine = line.trim();
            if (!compactLine) {
                continue;
            }
            let match = compactLine.match(/^(.*)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/i);
            if (!match) {
                match = compactLine.match(/^(.*):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)$/i);
            }
            if (!match) {
                continue;
            }
            const file = this.normalizeToolIssueFilePath(rootPath, match[1]);
            if (!file) {
                continue;
            }
            diagnostics.push({
                file,
                line: Number(match[2]),
                column: Number(match[3]),
                severity: (match[4] || '').toLowerCase().includes('warn') ? 'warning' : 'error',
                source: 'tsc',
                code: match[5],
                message: match[6],
            });
        }
        return diagnostics;
    }

    private parseBiomeIssues(rootPath: string, stdout: string): WorkspaceIssue[] {
        const issues: WorkspaceIssue[] = [];
        if (!stdout || stdout.trim() === '') return issues;
        try {
            const data = JSON.parse(stdout) as {
                diagnostics?: Array<{
                    location?: { path?: { file?: string }; span?: [number, number] };
                    severity?: string;
                    message?: string;
                    category?: string;
                }>
            };

            if (!data.diagnostics) {
                return issues;
            }

            for (const diag of data.diagnostics) {
                if (!diag.location?.path?.file || !diag.message) {
                    continue;
                }

                const filePath = diag.location.path.file;

                issues.push({
                    file: filePath,
                    line: 1,
                    column: 1,
                    severity: diag.severity === 'error' ? 'error' : 'warning',
                    message: diag.message,
                    code: diag.category,
                    source: 'biome',
                });
            }
        } catch (e) {
            this.logWarn(`Failed to parse Biome issues: ${getErrorMessage(e as Error)}`);
        }
        return issues;
    }

    private parseRuffIssues(rootPath: string, stdout: string): WorkspaceIssue[] {
        const issues: WorkspaceIssue[] = [];
        if (!stdout || stdout.trim() === '') return issues;
        try {
            const data = JSON.parse(stdout) as Array<{
                code?: string;
                message?: string;
                location?: { row?: number; column?: number };
                filename?: string;
            }>;

            for (const item of data) {
                if (!item.filename || !item.message) {
                    continue;
                }

                issues.push({
                    file: item.filename,
                    line: item.location?.row ?? 1,
                    column: item.location?.column ?? 1,
                    severity: 'warning', // Ruff doesn't always specify severity in basic json, default to warning
                    message: item.message,
                    code: item.code,
                    source: 'ruff',
                });
            }
        } catch (e) {
            this.logWarn(`Failed to parse Ruff issues: ${getErrorMessage(e as Error)}`);
        }
        return issues;
    }

    private parseGoIssues(rootPath: string, stdout: string): WorkspaceIssue[] {
        const issues: WorkspaceIssue[] = [];
        if (!stdout || stdout.trim() === '') return issues;
        try {
            const data = JSON.parse(stdout) as {
                Issues?: Array<{
                    FromLinter?: string;
                    Text?: string;
                    Pos?: { Filename?: string; Line?: number; Column?: number };
                }>
            };

            if (!data.Issues) {
                return issues;
            }

            for (const item of data.Issues) {
                if (!item.Pos?.Filename || !item.Text) {
                    continue;
                }

                issues.push({
                    file: item.Pos.Filename,
                    line: item.Pos.Line ?? 1,
                    column: item.Pos.Column ?? 1,
                    severity: 'warning',
                    message: item.Text,
                    code: item.FromLinter,
                    source: 'golangci-lint',
                });
            }
        } catch (e) {
            this.logWarn(`Failed to parse Go issues: ${getErrorMessage(e as Error)}`);
        }
        return issues;
    }

    private parseEslintIssues(rootPath: string, stdout: string, stderr: string): WorkspaceIssue[] {
        const output = stdout.trim();
        const jsonStartIndex = output.indexOf('[');
        if (jsonStartIndex === -1) {
            if (stderr.trim().length > 0) {
                this.logWarn(`ESLint output parse skipped (no JSON array found): ${stderr.split(/\r?\n/)[0]}`);
            }
            return [];
        }
        const jsonContent = output.substring(jsonStartIndex);
        const report = safeJsonParse<Array<{
            filePath?: string;
            messages?: Array<{
                line?: number;
                column?: number;
                severity?: number;
                message?: string;
                ruleId?: string | null;
            }>;
        }>>(output, []);
        const diagnostics: WorkspaceIssue[] = [];
        for (const entry of report) {
            const file = this.normalizeToolIssueFilePath(rootPath, entry.filePath ?? '');
            if (!file || !entry.messages) {
                continue;
            }
            for (const message of entry.messages) {
                if (!message.message || !message.line) {
                    continue;
                }
                diagnostics.push({
                    file,
                    line: message.line,
                    column: message.column,
                    severity: message.severity === 2 ? 'error' : 'warning',
                    source: 'eslint',
                    code: message.ruleId ?? undefined,
                    message: message.message,
                });
            }
        }
        return diagnostics;
    }

    private normalizeToolIssueFilePath(rootPath: string, rawFilePath: string): string | null {
        if (!rawFilePath || rawFilePath.trim().length === 0) {
            return null;
        }
        const normalizedRoot = path.resolve(rootPath);
        const absolutePath = path.isAbsolute(rawFilePath)
            ? path.resolve(rawFilePath)
            : path.resolve(normalizedRoot, rawFilePath);
        const relativePath = path.relative(normalizedRoot, absolutePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return null;
        }
        return relativePath.replace(/\\/g, '/');
    }

    private async hasEslintConfig(rootPath: string): Promise<boolean> {
        const configFiles = [
            'eslint.config.js',
            'eslint.config.cjs',
            'eslint.config.mjs',
            'eslint.config.ts',
            'eslint.config.cts',
            'eslint.config.mts',
            '.eslintrc',
            '.eslintrc.js',
            '.eslintrc.cjs',
            '.eslintrc.mjs',
            '.eslintrc.json',
            '.eslintrc.yaml',
            '.eslintrc.yml',
        ];
        if (await this.workspaceHasAnyFile(rootPath, configFiles)) {
            return true;
        }
        try {
            const packageJsonPath = path.join(rootPath, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
            const parsed = safeJsonParse<{ eslintConfig?: RuntimeValue }>(packageJsonContent, {});
            return parsed.eslintConfig !== undefined;
        } catch {
            return false;
        }
    }

    private async workspaceHasAnyFile(rootPath: string, relativePaths: string[]): Promise<boolean> {
        for (const relativePath of relativePaths) {
            try {
                await fs.access(path.join(rootPath, relativePath));
                return true;
            } catch {
                continue;
            }
        }
        return false;
    }

    private async waitForFileDiagnostics(
        lspWorkspaceRoot: string,
        workspaceRootPath: string,
        fileUri: string,
        ignoreMatcher?: WorkspaceIgnoreMatcher
    ): Promise<WorkspaceIssue[]> {
        const maxAttempts = 12;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const diagnostics = this.collectLspDiagnostics(
                lspWorkspaceRoot,
                workspaceRootPath,
                fileUri,
                ignoreMatcher
            );
            if (diagnostics.length > 0 || attempt === maxAttempts - 1) {
                return diagnostics;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return [];
    }

    private async waitForWorkspaceDiagnostics(
        lspWorkspaceRoot: string,
        workspaceRootPath: string,
        ignoreMatcher?: WorkspaceIgnoreMatcher
    ): Promise<WorkspaceIssue[]> {
        const maxAttempts = 12;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const diagnostics = this.collectLspDiagnostics(
                lspWorkspaceRoot,
                workspaceRootPath,
                undefined,
                ignoreMatcher
            );
            if (diagnostics.length > 0 || attempt === maxAttempts - 1) {
                return diagnostics;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return [];
    }

    private async ensureLspReady(
        rootPath: string,
        files: string[],
        _type: WorkspaceAnalysis['type'] | string
    ): Promise<void> {
        if (!this.lspService) {
            return;
        }

        await this.lspService.startWorkspaceServers(rootPath, rootPath, files);
        await this.lspService.primeWorkspaceDocuments(rootPath, rootPath, files);
        await new Promise(resolve => setTimeout(resolve, this.LSP_PRIME_WAIT_MS));
    }

    private collectLspDiagnostics(
        lspWorkspaceRoot: string,
        workspaceRootPath = lspWorkspaceRoot,
        targetUri?: string,
        ignoreMatcher?: WorkspaceIgnoreMatcher
    ): WorkspaceIssue[] {
        if (!this.lspService) {
            return [];
        }

        const rawDiagnostics = this.lspService.getDiagnostics(lspWorkspaceRoot);
        const diagnostics: WorkspaceIssue[] = [];
        for (const item of rawDiagnostics) {
            if (targetUri && item.uri !== targetUri) {
                continue;
            }
            const fileName = this.resolveLspUriToWorkspaceRelativePath(workspaceRootPath, item.uri);
            if (!fileName) {
                continue;
            }
            if (!this.shouldIncludeLspDiagnostic(workspaceRootPath, fileName, ignoreMatcher)) {
                continue;
            }
            for (const diagnostic of item.diagnostics) {
                diagnostics.push({
                    severity: this.mapLspSeverity(diagnostic.severity),
                    message: diagnostic.message,
                    file: fileName,
                    line: diagnostic.range.start.line + 1,
                    column: diagnostic.range.start.character + 1,
                    source: diagnostic.source || 'lsp',
                    code: typeof diagnostic.code === 'string' || typeof diagnostic.code === 'number'
                        ? diagnostic.code
                        : undefined
                });
            }
        }

        return diagnostics;
    }

    private shouldIncludeLspDiagnostic(
        workspaceRootPath: string,
        fileName: string,
        ignoreMatcher?: WorkspaceIgnoreMatcher
    ): boolean {
        if (!ignoreMatcher) {
            return true;
        }
        const absoluteFilePath = path.resolve(workspaceRootPath, fileName);
        return !ignoreMatcher.ignoresAbsolute(absoluteFilePath);
    }

    private collectLspServerSupport(rootPath: string, files: string[]): WorkspaceLspServerSupport[] | undefined {
        if (!this.lspService) {
            return undefined;
        }

        return this.lspService.getWorkspaceServerSupport(rootPath, files);
    }

    private mapLspSeverity(severity?: number): WorkspaceIssue['severity'] {
        switch (severity) {
            case 1:
                return 'error';
            case 2:
                return 'warning';
            case 3:
                return 'info';
            case 4:
                return 'hint';
            default:
                return 'warning';
        }
    }

    private resolveLspUriToWorkspaceRelativePath(rootPath: string, uri: string): string | null {
        try {
            const filePath = fileURLToPath(uri);
            const normalizedRoot = path.resolve(rootPath);
            const normalizedFilePath = path.resolve(filePath);
            if (!normalizedFilePath.startsWith(normalizedRoot)) {
                return null;
            }
            return path.relative(normalizedRoot, normalizedFilePath);
        } catch (error) {
            this.logWarn(`Failed to resolve LSP URI ${uri}: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private resolveLspDefinitionLocation(
        uri: string,
        line: number,
        column: number
    ): WorkspaceDefinitionLocation | null {
        try {
            return {
                file: path.resolve(fileURLToPath(uri)),
                line,
                column,
            };
        } catch (error) {
            this.logWarn(`Failed to resolve LSP definition URI ${uri}: ${getErrorMessage(error as Error)}`);
            return null;
        }
    }

    private resolveWorkspaceFilePath(rootPath: string, filePath: string): string {
        const normalizedFilePath = path.resolve(filePath);
        const normalizedRootPath = path.resolve(rootPath);

        // On Windows, handle case insensitivity and drive letter formatting differences
        const isWin = process.platform === 'win32';
        const comparisonFilePath = isWin ? normalizedFilePath.toLowerCase() : normalizedFilePath;
        const comparisonRootPath = isWin ? normalizedRootPath.toLowerCase() : normalizedRootPath;

        const relativePath = path.relative(comparisonRootPath, comparisonFilePath);

        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new ValidationError('Workspace file path must be inside the workspace root');
        }

        return normalizedFilePath;
    }

    private async resolveLspProjectRoot(
        workspaceRootPath: string,
        filePath: string,
        languageId: string
    ): Promise<string> {
        const markers = LSP_PROJECT_ROOT_MARKERS[languageId] ?? [];
        if (markers.length === 0) {
            return workspaceRootPath;
        }

        let currentDirectory = path.dirname(filePath);
        const normalizedWorkspaceRoot = path.resolve(workspaceRootPath);
        for (let attempt = 0; attempt < 32; attempt += 1) {
            if (await this.directoryContainsAnyMarker(currentDirectory, markers)) {
                return currentDirectory;
            }
            if (currentDirectory === normalizedWorkspaceRoot) {
                break;
            }
            const parentDirectory = path.dirname(currentDirectory);
            if (parentDirectory === currentDirectory) {
                break;
            }
            currentDirectory = parentDirectory;
        }

        return normalizedWorkspaceRoot;
    }

    private async directoryContainsAnyMarker(
        directoryPath: string,
        markers: readonly string[]
    ): Promise<boolean> {
        for (const marker of markers) {
            try {
                await fs.access(path.join(directoryPath, marker));
                return true;
            } catch {
                continue;
            }
        }
        return false;
    }

    private toFileUri(filePath: string): string {
        return pathToFileURL(filePath).toString();
    }

    private async findPackages(_rootPath: string, _configType: string): Promise<string[]> {
        // Placeholder for real glob parsing logic
        // For Phase 1, we just return basic assumption
        return ['packages/*'];
    }

    /**
     * Analyzes a specific directory for package info and stats.
     * @param dirPath The absolute path to the directory.
     */
    async analyzeDirectory(dirPath: string): Promise<{
        hasPackageJson: boolean
        pkg: JsonObject
        stats: WorkspaceStats
    }> {
        dirPath = this.resolveAndValidateRootPath(dirPath);
        // 1. Check for package.json
        let hasPackageJson = false;
        let pkg: JsonObject = {};
        try {
            const pkgPath = path.join(dirPath, 'package.json');
            const content = await fs.readFile(pkgPath, 'utf-8');
            pkg = safeJsonParse<JsonObject>(content, {});
            hasPackageJson = true;
        } catch (error) {
            /* package.json not found or parse error */
            this.logDebug(`[WorkspaceService] package.json not found in ${dirPath}:`, getErrorMessage(error as Error));
        }

        // 3. Stats for this folder
        let files: string[] = [];
        try {
            const entries = await fs.readdir(dirPath);
            files = entries.map(e => path.join(dirPath, e));
        } catch (error) {
            /* Failed to read directory */
            this.logWarn(`Failed to read directory ${dirPath}:`, getErrorMessage(error as Error));
        }

        const stats = await this.calculateStats(dirPath, files);

        return { hasPackageJson, pkg, stats };
    }

    private resolveLanguageName(filePath: string): string | null {
        const fileName = path.basename(filePath).toLowerCase();
        const specialLanguage = SPECIAL_FILE_LANGUAGE_MAP[fileName];
        if (specialLanguage) {
            return specialLanguage;
        }

        const ext = path.extname(filePath).slice(1).toLowerCase();
        if (!ext) {
            return null;
        }

        return EXTENSION_LANGUAGE_MAP[ext] ?? null;
    }

    private shouldIncludeLanguageInDistribution(filePath: string, languageName: string): boolean {
        if (LANGUAGE_DISTRIBUTION_EXCLUDED_LANGUAGES.has(languageName)) {
            return false;
        }

        const normalizedPath = filePath.toLowerCase();
        if (normalizedPath.includes('.min.')) {
            return false;
        }

        const pathSegments = normalizedPath.split(/[\\/]+/);
        for (const segment of pathSegments) {
            if (LANGUAGE_DISTRIBUTION_EXCLUDED_SEGMENTS.has(segment)) {
                return false;
            }
        }

        return true;
    }

    private async readLanguageWeight(filePath: string): Promise<number> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return Math.max(1, content.split(/\r?\n/).length);
        } catch (error) {
            appLogger.error(LOG_CONTEXT, `Failed to read language file ${filePath}:`, getErrorMessage(error as Error));
            return 1;
        }
    }

    private async calculateLanguages(files: string[]): Promise<Record<string, number>> {
        const langMap: Record<string, number> = {};

        for (const file of files) {
            const languageName = this.resolveLanguageName(file);
            if (!languageName) {
                continue;
            }
            if (!this.shouldIncludeLanguageInDistribution(file, languageName)) {
                continue;
            }

            const weight = await this.readLanguageWeight(file);
            langMap[languageName] = (langMap[languageName] ?? 0) + weight;
        }

        return langMap;
    }

    private async scanFiles(
        rootPath: string,
        options?: { budgetMs?: number; maxFiles?: number; useCache?: boolean }
    ): Promise<FileScanResult> {
        const useCache = options?.useCache !== false;

        // 1. Check persistent cache if allowed
        const cached = useCache ? await this.tryGetScanCache(rootPath) : null;
        if (cached) {
            return cached;
        }

        // 2. Try Worker-based scanning
        if (this.shouldUseWorker()) {
            const workerResult = await this.tryWorkerScan(rootPath, options?.maxFiles);
            if (workerResult) {
                await this.trySetScanCache(rootPath, workerResult);
                return workerResult;
            }
        }

        // 3. Fallback to Main Process Scan
        const result = await this.performMainProcessScan(rootPath, options);
        await this.trySetScanCache(rootPath, result);

        return result;
    }

    private async tryGetScanCache(rootPath: string): Promise<FileScanResult | null> {
        if (!this.cacheService?.isReady()) {
            return null;
        }

        try {
            const cached = await this.cacheService.get<FileScanResult>('workspace-scan', rootPath);
            if (cached) {
                this.logDebug(`Returning persistent cache result for ${rootPath} (${cached.files.length} files)`);
                return cached;
            }
        } catch (error) {
            this.logWarn(`Failed to read persistent cache for ${rootPath}:`, getErrorMessage(error as Error));
        }
        return null;
    }

    private async trySetScanCache(rootPath: string, result: FileScanResult): Promise<void> {
        if (!result.complete || !this.cacheService?.isReady()) {
            return;
        }

        try {
            await this.cacheService.set('workspace-scan', rootPath, result, 3600); // 1 hour TTL
        } catch (error) {
            this.logWarn(`Failed to update persistent cache for ${rootPath}:`, getErrorMessage(error as Error));
        }
    }

    private async tryWorkerScan(rootPath: string, maxFiles?: number): Promise<FileScanResult | null> {
        if (!this.utilityProcessService) {
            return null;
        }

        try {
            await this.ensureWorkerStarted();
            if (!this.workerProcessId) {
                return null;
            }

            const ignoreMatcher = await this.getScanIgnoreMatcher(rootPath);
            const response = await this.utilityProcessService.request(
                this.workerProcessId,
                'workspace.scan',
                {
                    root: rootPath,
                    patterns: ignoreMatcher.patterns,
                    maxFiles
                },
                60000 // Large timeout for huge workspaces
            );

            if (this.isScanResult(response)) {
                return response;
            }
        } catch (error) {
            this.logWarn(`Worker scan failed: ${getErrorMessage(error as Error)}`);
        }
        return null;
    }

    private async performMainProcessScan(
        rootPath: string,
        options?: { budgetMs?: number; maxFiles?: number }
    ): Promise<FileScanResult> {
        const files: string[] = [];
        const dirsToVisit: string[] = [rootPath];
        const ignoreMatcher = await this.getScanIgnoreMatcher(rootPath);
        const budgetMs = options?.budgetMs;
        const maxFiles = options?.maxFiles;
        const startedAt = Date.now();
        let complete = true;

        while (dirsToVisit.length > 0) {
            if (budgetMs !== undefined && Date.now() - startedAt >= budgetMs) {
                complete = false;
                break;
            }
            if (maxFiles !== undefined && files.length >= maxFiles) {
                complete = false;
                break;
            }

            const currentDir = dirsToVisit.pop();
            if (!currentDir) {
                break;
            }

            try {
                const entries = await fs.readdir(currentDir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    if (this.shouldIgnore(entry.name) || ignoreMatcher.ignoresAbsolute(fullPath)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        dirsToVisit.push(fullPath);
                        continue;
                    }

                    files.push(fullPath);
                    if (maxFiles !== undefined && files.length >= maxFiles) {
                        complete = false;
                        break;
                    }
                }
            } catch (error) {
                this.logWarn(`Failed to scan directory ${currentDir}:`, getErrorMessage(error as Error));
            }
        }

        return { files: files.sort(), complete };
    }

    private async ensureWorkerStarted(): Promise<void> {
        if (!this.utilityProcessService || this.workerProcessId || this.workerDisabled) {
            return;
        }

        try {
            this.workerProcessId = this.utilityProcessService.spawn({
                name: 'workspace-scanner',
                entryPoint: getBundledUtilityWorkerPath(WorkspaceService.WORKER_FILE_NAME),
            });
            this.logInfo('Workspace scanner worker spawned.');
        } catch (error) {
            this.workerProcessId = null;
            this.workerDisabled = true;
            this.logWarn('Failed to spawn workspace scanner worker:', getErrorMessage(error as Error));
        }
    }

    private shouldUseWorker(): boolean {
        return Boolean(this.utilityProcessService && !this.workerDisabled);
    }

    private isScanResult(value: RuntimeValue): value is FileScanResult {
        if (value === null || typeof value !== 'object') {
            return false;
        }

        const candidate = value as Record<string, RuntimeValue>;
        return (
            Array.isArray(candidate.files) &&
            typeof candidate.complete === 'boolean'
        );
    }

    private async getScanIgnoreMatcher(rootPath: string): Promise<WorkspaceIgnoreMatcher> {
        const defaultPatterns = DEFAULT_WORKSPACE_SCAN_IGNORE_PATTERNS.filter(
            pattern => !WORKSPACE_SCAN_INCLUDED_PATTERNS.has(pattern)
        );
        return getWorkspaceIgnoreMatcher(rootPath, {
            defaultPatterns,
        });
    }

    private shouldIgnore(name: string): boolean {
        const lowerName = name.toLowerCase();
        const ignoredNames = [
            'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.tengra',
            '.vscode', '.idea', 'coverage', '.nyc_output', 'target', 'bin', 'obj',
            '.next', '.nuxt', '.cache', '__pycache__', '.pytest_cache', '.output',
            '.yarn', 'composer.lock', 'cargo.lock', 'go.sum', '.ds_store', 'thumbs.db',
            '.parcel-cache', '.turbo', 'venv', '.venv', 'env', '.env', 'eggs', '.tox',
            'vendor', '.gradle', 'deriveddata', 'pods', '.symlinks', 'testresults',
            '.vs', 'cmakecache.txt', 'cmakefiles', '.vue', '.svelte-kit', '.astro',
            '.mypy_cache', '.hypothesis', 'htmlcov', 'tmp', 'var', 'ipch', 'debug',
            'release', 'x64', 'x86', 'library', 'temp', 'logs', 'captures', '_build',
            'deps', '.dart_tool', '.pub-cache', 'packages', '.expo', '.metadata',
            '.bundle', '.ruby-lsp', 'binaries', 'intermediate', 'saved',
            '.externalnativebuild', '.cxx', '.terraform', '.vagrant', '.kitchen',
            '.serverless', '.aws-sam', '.direnv', '.elixir_ls', 'desktop.ini',
            'artifacts', '.system_generated', 'logs', 'bower_components',
            'jspm_packages', '.npm', '.eslintcache', '.stylelintcache',
            '.awscache', '.cache-loader', 'build-artifacts', 'cache-loader',
            'minified', 'compiled', 'output', 'reports', 'test-results',
            '.tox', '.nox', '.pants.d', '.scons_cache', '.bundle', '.pnpm-store',
            '.vercel', '.netlify', '.docker', '.firebase', '.gitlab'
        ];
        if (ignoredNames.includes(lowerName)) { return true; }

        // Also ignore common binary or large asset extensions
        const ignoredExtensions = [
            '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
            '.pyc', '.pyo', '.pyd', '.class', '.jar', '.war', '.ear',
            '.zip', '.tar', '.gz', '.7z', '.rar',
            '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
            '.mp3', '.mp4', '.wav', '.mov', '.pdf', '.doc', '.docx',
            '.pdb', '.ilk', '.tlog', '.idb', '.ipdb', '.iobj', '.pch', '.sdf',
            '.opensdf', '.cache', '.bmp', '.depend'
        ];
        return ignoredExtensions.some(ext => lowerName.endsWith(ext));
    }

    private async detectType(files: string[]): Promise<WorkspaceAnalysis['type'] | string> {
        const fileNames = files.map(f => path.basename(f).toLowerCase());
        if (fileNames.includes('package.json')) { return 'node'; }
        if (this.isPythonWorkspace(fileNames)) { return 'python'; }
        if (fileNames.includes('cargo.toml')) { return 'rust'; }
        if (fileNames.includes('go.mod')) { return 'go'; }
        if (this.isJavaWorkspace(fileNames)) { return 'java'; }
        if (this.isCppWorkspace(fileNames)) { return 'cpp'; }
        if (fileNames.some(f => f.endsWith('.php'))) { return 'php'; }
        if (this.isCsharpWorkspace(fileNames)) { return 'csharp'; }
        return 'unknown';
    }

    private isPythonWorkspace(fileNames: string[]): boolean {
        return fileNames.includes(WORKSPACE_COMPAT_FILE_VALUES.REQUIREMENTS_TXT)
            || fileNames.includes(WORKSPACE_COMPAT_FILE_VALUES.PY_SINGULAR_TOML)
            || fileNames.some(f => f.endsWith('.py'));
    }

    private isJavaWorkspace(fileNames: string[]): boolean {
        return fileNames.includes('pom.xml') || fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts') || fileNames.some(f => f.endsWith('.kt') || f.endsWith('.kts'));
    }

    private isCppWorkspace(fileNames: string[]): boolean {
        return fileNames.includes('cmakelists.txt') || fileNames.some(f => f.endsWith('.cpp') || f.endsWith('.cc') || f.endsWith('.h') || f.endsWith('.hpp'));
    }

    private isCsharpWorkspace(fileNames: string[]): boolean {
        return fileNames.some(f => f.endsWith('.cs') || f.endsWith('.csproj'));
    }

    private async analyzeDependencies(rootPath: string, type: string, allFiles: string[]): Promise<{ frameworks: string[], dependencies: Record<string, string>, devDependencies: Record<string, string> }> {
        switch (type) {
            case 'node': return this.analyzeNodeDependencies(rootPath, allFiles);
            case 'python': return this.analyzePythonDependencies(rootPath);
            case 'go': return this.analyzeGoDependencies(rootPath);
            case 'rust': return this.analyzeRustDependencies(rootPath);
            case 'java': return this.analyzeJavaDependencies(rootPath, allFiles);
            default: return { frameworks: [], dependencies: {}, devDependencies: {} };
        }
    }

    private async analyzeNodeDependencies(rootPath: string, allFiles: string[]) {
        const result = { frameworks: [] as string[], dependencies: {} as Record<string, string>, devDependencies: {} };
        try {
            const pkgPath = path.join(rootPath, 'package.json');
            const content = await fs.readFile(pkgPath, 'utf-8');
            const pkg = safeJsonParse<JsonObject>(content, {});

            result.dependencies = pkg.dependencies ? (pkg.dependencies as Record<string, string>) : {};
            result.devDependencies = pkg.devDependencies ? (pkg.devDependencies as Record<string, string>) : {};

            this.detectNodeFrameworks(pkg, result.frameworks);
            this.detectNodeWorkspaceFrameworks(allFiles, result.frameworks);
        } catch (error) {
            this.logWarn('Failed to parse package.json:', getErrorMessage(error as Error));
        }
        return result;
    }

    private detectNodeFrameworks(pkg: JsonObject, frameworks: string[]) {
        const deps = {
            ...(typeof pkg.dependencies === 'object' && pkg.dependencies ? pkg.dependencies as JsonObject : {}),
            ...(typeof pkg.devDependencies === 'object' && pkg.devDependencies ? pkg.devDependencies as JsonObject : {})
        };
        const depKeys = Object.keys(deps);

        const FRAMEWORK_MAP: Record<string, string> = {
            'react': 'React',
            'vue': 'Vue',
            'angular': 'Angular',
            '@angular/core': 'Angular',
            'svelte': 'Svelte',
            'next': 'Next.js',
            'nuxt': 'Nuxt',
            'express': 'Express',
            'nest': 'NestJS',
            '@nestjs/core': 'NestJS',
            'electron': 'Electron',
            'tailwindcss': 'Tailwind CSS',
            'typescript': 'TypeScript'
        };

        for (const [key, name] of Object.entries(FRAMEWORK_MAP)) {
            if (depKeys.includes(key) && !frameworks.includes(name)) {
                frameworks.push(name);
            }
        }
    }

    private detectNodeWorkspaceFrameworks(files: string[], frameworks: string[]): void {
        const fileNames = files.map(file => path.basename(file).toLowerCase());

        if (fileNames.some(fileName => fileName.startsWith('playwright.config.'))) {
            frameworks.push('Playwright');
        }
        if (fileNames.some(fileName => fileName.startsWith('tailwind.config.'))) {
            frameworks.push('Tailwind CSS');
        }
        if (fileNames.includes('pnpm-lock.yaml')) {
            frameworks.push('pnpm');
        }
        if (files.some(file => normalizeWorkspacePath(file).includes('/.github/workflows/'))) {
            frameworks.push('GitHub Actions');
        }

        const uniqueFrameworks = Array.from(new Set(frameworks));
        frameworks.length = 0;
        frameworks.push(...uniqueFrameworks);
    }

    private async analyzePythonDependencies(rootPath: string) {
        const result = { frameworks: [] as string[], dependencies: {} as Record<string, string>, devDependencies: {} };

        await this.analyzeRequirementsTxt(rootPath, result.dependencies);
        await this.analyzePyWorkspace(rootPath, result.dependencies);

        const allDeps = Object.keys(result.dependencies);
        this.detectPythonFrameworks(allDeps, result.frameworks);

        return result;
    }

    private async analyzeRequirementsTxt(rootPath: string, dependencies: Record<string, string>) {
        try {
            const reqPath = path.join(rootPath, 'requirements.txt');
            const content = await fs.readFile(reqPath, 'utf-8');
            const lines = content.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) { continue; }
                const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[=<>!~]+(.+))?/);
                if (match?.[1]) {
                    dependencies[match[1]] = match[2] || '*';
                }
            }
        } catch (error) {
            this.logDebug('requirements.txt not found:', getErrorMessage(error as Error));
        }
    }

    private async analyzePyWorkspace(rootPath: string, dependencies: Record<string, string>) {
        try {
            const pythonManifestPath = path.join(rootPath, WORKSPACE_COMPAT_FILE_VALUES.PY_SINGULAR_TOML);
            const content = await fs.readFile(pythonManifestPath, 'utf-8');

            this.parsePyWorkspaceDependencies(content, dependencies);
            this.parsePoetryDependencies(content, dependencies);
        } catch (error) {
            this.logDebug(`${WORKSPACE_COMPAT_FILE_VALUES.PY_SINGULAR_TOML} not found:`, getErrorMessage(error as Error));
        }
    }

    private parsePyWorkspaceDependencies(content: string, dependencies: Record<string, string>) {
        const depMatch = content.match(/\[workspace\.dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/);
        if (depMatch) {
            const depLines = depMatch[1].split('\n');
            for (const line of depLines) {
                const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
                if (match?.[1]) { dependencies[match[1]] = '*'; }
            }
        }
    }

    private parsePoetryDependencies(content: string, dependencies: Record<string, string>) {
        const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/);
        if (poetryMatch) {
            const depLines = poetryMatch[1].split('\n');
            for (const line of depLines) {
                const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"?([^"]+)"?/);
                if (match?.[1] && match[1] !== 'python') {
                    dependencies[match[1]] = match[2] || '*';
                }
            }
        }
    }

    private detectPythonFrameworks(allDeps: string[], frameworks: string[]) {
        if (allDeps.includes('django')) { frameworks.push('Django'); }
        if (allDeps.includes('flask')) { frameworks.push('Flask'); }
        if (allDeps.includes('fastapi')) { frameworks.push('FastAPI'); }
        if (allDeps.includes('pytorch') || allDeps.includes('torch')) { frameworks.push('PyTorch'); }
        if (allDeps.includes('tensorflow')) { frameworks.push('TensorFlow'); }
        if (allDeps.includes('numpy')) { frameworks.push('NumPy'); }
        if (allDeps.includes('pandas')) { frameworks.push('Pandas'); }
        if (allDeps.includes('pytest')) { frameworks.push('Pytest'); }
    }

    private async analyzeGoDependencies(rootPath: string) {
        const result = { frameworks: [] as string[], dependencies: {} as Record<string, string>, devDependencies: {} };
        try {
            const goModPath = path.join(rootPath, 'go.mod');
            const content = await fs.readFile(goModPath, 'utf-8');
            this.parseGoMod(content, result.dependencies);
        } catch (error) {
            this.logDebug('go.mod not found:', getErrorMessage(error as Error));
        }

        const allDeps = Object.keys(result.dependencies);
        if (allDeps.some(d => d.includes('gin-gonic'))) { result.frameworks.push('Gin'); }
        if (allDeps.some(d => d.includes('echo'))) { result.frameworks.push('Echo'); }
        if (allDeps.some(d => d.includes('fiber'))) { result.frameworks.push('Fiber'); }
        if (allDeps.some(d => d.includes('gorilla/mux'))) { result.frameworks.push('Gorilla Mux'); }
        if (allDeps.some(d => d.includes('gorm'))) { result.frameworks.push('GORM'); }

        return result;
    }

    private parseGoMod(content: string, dependencies: Record<string, string>) {
        const requireMatch = content.match(/require\s*\(([\s\S]*?)\)/);
        if (requireMatch) {
            const lines = requireMatch[1].split('\n');
            for (const line of lines) {
                const match = line.trim().match(/^([^\s]+)\s+v?(.+)/);
                if (match?.[1] && match[2]) { dependencies[match[1]] = match[2]; }
            }
        }

        const singleReqs = content.matchAll(/require\s+([^\s]+)\s+v?([^\s\n]+)/g);
        for (const match of singleReqs) {
            if (match[1] && match[2]) { dependencies[match[1]] = match[2]; }
        }
    }

    private async analyzeRustDependencies(rootPath: string) {
        const result = { frameworks: [] as string[], dependencies: {} as Record<string, string>, devDependencies: {} as Record<string, string> };
        try {
            const cargoPath = path.join(rootPath, 'Cargo.toml');
            const content = await fs.readFile(cargoPath, 'utf-8');
            this.parseCargoToml(content, result);
        } catch (error) {
            this.logDebug('Cargo.toml not found:', getErrorMessage(error as Error));
        }

        const allDeps = Object.keys(result.dependencies);
        this.detectRustFrameworks(allDeps, result.frameworks);

        return result;
    }

    private parseCargoToml(content: string, result: { dependencies: Record<string, string>, devDependencies: Record<string, string> }) {
        const depMatch = content.match(/\[dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/);
        if (depMatch) {
            this.parseCargoBlock(depMatch[1], result.dependencies);
        }

        const devDepMatch = content.match(/\[dev-dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/);
        if (devDepMatch) {
            this.parseCargoBlock(devDepMatch[1], result.devDependencies);
        }
    }

    private parseCargoBlock(block: string, target: Record<string, string>) {
        const lines = block.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) { continue; }

            if (this.parseSimpleCargoDep(trimmed, target)) { continue; }
            this.parseComplexCargoDep(trimmed, target);
        }
    }

    private parseSimpleCargoDep(line: string, target: Record<string, string>): boolean {
        const simpleMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
        if (simpleMatch?.[1] && simpleMatch[2]) {
            target[simpleMatch[1]] = simpleMatch[2];
            return true;
        }
        return false;
    }

    private parseComplexCargoDep(line: string, target: Record<string, string>) {
        const complexMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{/);
        if (complexMatch?.[1]) {
            const versionMatch = line.match(/version\s*=\s*"([^"]+)"/);
            target[complexMatch[1]] = versionMatch?.[1] ?? '*';
        }
    }

    private detectRustFrameworks(allDeps: string[], frameworks: string[]) {
        if (allDeps.includes('actix-web')) { frameworks.push('Actix Web'); }
        if (allDeps.includes('axum')) { frameworks.push('Axum'); }
        if (allDeps.includes('rocket')) { frameworks.push('Rocket'); }
        if (allDeps.includes('tokio')) { frameworks.push('Tokio'); }
        if (allDeps.includes('serde')) { frameworks.push('Serde'); }
        if (allDeps.includes('diesel')) { frameworks.push('Diesel'); }
        if (allDeps.includes('sqlx')) { frameworks.push('SQLx'); }
    }

    private async analyzeJavaDependencies(_rootPath: string, allFiles: string[]) {
        const result = { frameworks: [] as string[], dependencies: {} as Record<string, string>, devDependencies: {} };

        await this.analyzeGradleDependencies(allFiles, result);
        await this.analyzeMavenDependencies(allFiles, result);

        this.detectJavaFrameworks(Object.keys(result.dependencies), result.frameworks);
        result.frameworks = [...new Set(result.frameworks)];
        return result;
    }

    private async analyzeGradleDependencies(allFiles: string[], result: { dependencies: Record<string, string>, frameworks: string[] }) {
        const gradleFiles = allFiles.filter(f => f.endsWith('build.gradle') || f.endsWith('build.gradle.kts'));
        for (const file of gradleFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                this.parseGradleDeps(content, result.dependencies);
                this.detectGradleFrameworks(content, result.frameworks);
            } catch (error) {
                appLogger.error(LOG_CONTEXT, `Failed to read gradle file ${file}:`, getErrorMessage(error as Error));
            }
        }
    }

    private parseGradleDeps(content: string, dependencies: Record<string, string>) {
        const depRegex = /(?:implementation|api|compile|runtimeOnly|compileOnly|testImplementation|classpath)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g;
        let match;
        while ((match = depRegex.exec(content)) !== null) {
            const dep = match[1] || '';
            const parts = dep.split(':');
            const name = parts.length > 1 ? (parts[1] || dep) : dep;
            dependencies[name] = parts.length > 2 ? (parts[2] || '*') : '*';
        }
    }

    private detectGradleFrameworks(content: string, frameworks: string[]) {
        if (content.includes('org.springframework.boot')) { frameworks.push('Spring Boot'); }
        if (content.includes('com.android.application') || content.includes('com.android.library')) { frameworks.push('Android'); }
        if (content.includes('androidx.compose')) { frameworks.push('Jetpack Compose'); }
        if (content.includes('io.quarkus')) { frameworks.push('Quarkus'); }
        if (content.includes('io.micronaut')) { frameworks.push('Micronaut'); }
        this.detectKotlinFrameworks(content, frameworks);
    }

    private detectKotlinFrameworks(content: string, frameworks: string[]) {
        if (content.includes('kotlin("jvm")') || content.includes('id "org.jetbrains.kotlin.jvm"')) { frameworks.push('Kotlin JVM'); }
        if (content.includes('kotlin("android")') || content.includes('id "org.jetbrains.kotlin.android"')) { frameworks.push('Kotlin Android'); }
    }

    private async analyzeMavenDependencies(allFiles: string[], result: { dependencies: Record<string, string>, frameworks: string[] }) {
        const pomFiles = allFiles.filter(f => f.endsWith('pom.xml'));
        for (const file of pomFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const depRegex = /<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?(?:<version>([^<]+)<\/version>)?[\s\S]*?<\/dependency>/g;
                let match;
                while ((match = depRegex.exec(content)) !== null) {
                    if (match[1]) { result.dependencies[match[1]] = match[2] || '*'; }
                }
                if (content.includes('spring-boot')) { result.frameworks.push('Spring Boot'); }
            } catch (error) {
                appLogger.error(LOG_CONTEXT, `Failed to read pom file ${file}:`, getErrorMessage(error as Error));
            }
        }
    }

    private detectJavaFrameworks(depKeys: string[], frameworks: string[]) {
        if (depKeys.some(d => d.includes('junit'))) { frameworks.push('JUnit'); }
        if (depKeys.some(d => d.includes('hibernate'))) { frameworks.push('Hibernate'); }
        if (depKeys.some(d => d.includes('dagger')) || depKeys.some(d => d.includes('hilt'))) { frameworks.push('Dagger/Hilt'); }
        if (depKeys.some(d => d.includes('retrofit'))) { frameworks.push('Retrofit'); }
    }

    private async calculateStats(
        rootPath: string,
        files: string[],
        maxSampleCount = 100
    ): Promise<WorkspaceStats> {
        if (!Array.isArray(files)) {
            appLogger.error(LOG_CONTEXT, 'calculateStats called with non-array files', { type: typeof files });
            return { fileCount: 0, totalSize: 0, loc: 0, lastModified: 0 };
        }
        let totalSize = 0;
        let lastModified = 0;
        const fileCount = files.length;
        const sampledFiles = this.buildStatsSample(files, maxSampleCount);
        const directorySizes = new Map<string, WorkspaceDirectorySizeEntry>();

        // Simple LOC estimation based on file size (very rough)
        // 100 bytes approx 1 line of code including whitespace
        let totalBytes = 0;
        const topFilesBySize: Array<{ path: string; size: number }> = [];

        for (const file of files) {
            try {
                const stat = await fs.stat(file);
                totalSize += stat.size;
                const modifiedAt = Math.max(0, Math.trunc(stat.mtimeMs));
                if (modifiedAt > lastModified) {
                    lastModified = modifiedAt;
                }
                this.trackDirectorySize(directorySizes, rootPath, file, stat.size);

                // Track top 20 files by size to find top LOC candidates
                if (stat.isFile()) {
                    topFilesBySize.push({ path: file, size: stat.size });
                    if (topFilesBySize.length > 50) {
                        topFilesBySize.sort((a, b) => b.size - a.size);
                        topFilesBySize.length = 30;
                    }
                }
            } catch (error) {
                // Ignore missing file errors during scan
                appLogger.error(LOG_CONTEXT, `Failed to stat file ${file}:`, getErrorMessage(error as Error));
            }
        }

        // Calculate exact LOC for top files
        const topFilesByLoc: Array<{ path: string; loc: number }> = [];
        topFilesBySize.sort((a, b) => b.size - a.size);
        for (const file of topFilesBySize.slice(0, 10)) {
            if (this.isBinaryFile(file.path)) {
                continue;
            }
            try {
                const content = await fs.readFile(file.path, 'utf-8');
                const lines = content.split('\n').length;
                topFilesByLoc.push({
                    path: path.relative(rootPath, file.path),
                    loc: lines
                });
            } catch {
                // Ignore read errors
            }
        }

        for (const file of sampledFiles) {
            if (this.isBinaryFile(file)) {
                continue;
            }
            try {
                const stat = await fs.stat(file);
                totalBytes += stat.size;
            } catch (error) {
                appLogger.error(LOG_CONTEXT, `Failed to stat sampled file ${file}:`, getErrorMessage(error as Error));
            }
        }

        const sampleCount = sampledFiles.length;
        const scaleFactor = sampleCount > 0 && sampleCount < fileCount
            ? fileCount / sampleCount
            : 1;

        return {
            fileCount,
            totalSize,
            loc: Math.round((totalBytes * scaleFactor) / 50), // Rough estimate: 50 bytes per line avg
            lastModified,
            largestDirectories: Array.from(directorySizes.values())
                .sort((left, right) => right.size - left.size)
                .slice(0, 8),
            topFilesByLoc: topFilesByLoc.sort((a, b) => b.loc - a.loc).slice(0, 8),
        };
    }

    private trackDirectorySize(
        directorySizes: Map<string, WorkspaceDirectorySizeEntry>,
        rootPath: string,
        filePath: string,
        size: number
    ): void {
        const normalizedRootPath = path.resolve(rootPath);
        const normalizedFilePath = path.resolve(filePath);
        const relativeFilePath = path.relative(normalizedRootPath, normalizedFilePath);
        if (!relativeFilePath || relativeFilePath.startsWith('..') || path.isAbsolute(relativeFilePath)) {
            return;
        }

        const relativeDirectoryPath = path.dirname(relativeFilePath);
        if (relativeDirectoryPath === '.' || !relativeDirectoryPath) {
            return;
        }

        const segments = relativeDirectoryPath
            .split(path.sep)
            .map(segment => segment.trim())
            .filter(Boolean);
        if (segments.length === 0) {
            return;
        }

        let currentPath = '';
        const seenPaths = new Set<string>();

        for (const segment of segments) {
            currentPath = currentPath
                ? `${currentPath}/${segment}`
                : segment;
            if (seenPaths.has(currentPath)) {
                continue;
            }
            seenPaths.add(currentPath);

            const existingEntry = directorySizes.get(currentPath);
            if (existingEntry) {
                existingEntry.size += size;
                existingEntry.fileCount += 1;
                continue;
            }

            directorySizes.set(currentPath, {
                path: currentPath,
                size,
                fileCount: 1,
            });
        }
    }

    private buildStatsSample(files: string[], maxSampleCount: number): string[] {
        if (maxSampleCount <= 0 || files.length <= maxSampleCount) {
            return files;
        }

        const sampledFiles: string[] = [];
        const step = Math.max(1, Math.floor(files.length / maxSampleCount));
        for (let index = 0; index < files.length && sampledFiles.length < maxSampleCount; index += step) {
            const file = files[index];
            if (file) {
                sampledFiles.push(file);
            }
        }
        return sampledFiles;
    }

    /**
     * Reads and parses .env file from workspace root.
     * @param rootPath - Workspace root path
     * @returns Key-value map of environment variables
     */
    async getEnvVars(rootPath: string): Promise<Record<string, string>> {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        const envPath = path.join(rootPath, '.env');
        try {
            const content = await fs.readFile(envPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            const result: Record<string, string> = {};
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) { continue; }
                const firstEquals = trimmed.indexOf('=');
                if (firstEquals === -1) { continue; }
                const key = trimmed.slice(0, firstEquals).trim();
                const validatedKey = WorkspaceEnvKeySchema.safeParse(key);
                if (!validatedKey.success) {
                    this.logWarn(`Skipping invalid env key ${key} at ${envPath}`);
                    continue;
                }
                let value = trimmed.slice(firstEquals + 1).trim();
                // Remove quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                result[validatedKey.data] = value;
            }
            return result;
        } catch (error) {
            appLogger.error(LOG_CONTEXT, `Failed to read .env file at ${envPath}: ${getErrorMessage(error as Error)}`);
            return {};
        }
    }

    /**
     * Writes environment variables to .env file.
     * @param rootPath - Workspace root path
     * @param vars - Key-value map to write
     * @throws ValidationError if vars are invalid
     */
    async saveEnvVars(rootPath: string, vars: Record<string, string>): Promise<void> {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        const parsedVars = WorkspaceEnvVarsSchema.safeParse(vars);
        if (!parsedVars.success) {
            throw new ValidationError(`Invalid environment variable payload: ${parsedVars.error.issues[0]?.message ?? 'unknown validation issue'}`);
        }
        const envPath = path.join(rootPath, '.env');
        try {
            const content = Object.entries(parsedVars.data)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            await fs.writeFile(envPath, content, 'utf-8');
            appLogger.info(LOG_CONTEXT, `Successfully saved .env vars to ${envPath}`);
        } catch (error) {
            appLogger.error(LOG_CONTEXT, `Failed to save .env file at ${envPath}:`, error as Error);
            throw error;
        }
    }

    private resolveAndValidateRootPath(inputPath: string): string {
        if (typeof inputPath !== 'string' || !inputPath) { 
            throw new ValidationError('Workspace root path must be a non-empty string');
        }
        const sanitizedInput = process.platform === 'win32' && inputPath.startsWith('/') && inputPath.charAt(2) === ':'
            ? inputPath.slice(1)
            : inputPath;

        const parsedPath = WorkspaceRootPathSchema.safeParse(sanitizedInput);
        if (!parsedPath.success) {
            throw new ValidationError(`Invalid workspace root path: ${parsedPath.error.issues[0]?.message ?? 'unknown validation issue'}`);
        }
        return path.resolve(parsedPath.data);
    }

    private isBinaryFile(filePath: string): boolean {
        const lowerName = path.basename(filePath).toLowerCase();
        const binaryExtensions = [
            '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
            '.pyc', '.pyo', '.pyd', '.class', '.jar', '.war', '.ear',
            '.zip', '.tar', '.gz', '.7z', '.rar',
            '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
            '.mp3', '.mp4', '.wav', '.mov', '.pdf', '.doc', '.docx',
            '.pdb', '.ilk', '.tlog', '.idb', '.ipdb', '.iobj', '.pch', '.sdf',
            '.opensdf', '.cache', '.bmp', '.depend'
        ];
        return binaryExtensions.some(ext => lowerName.endsWith(ext));
    }
}

