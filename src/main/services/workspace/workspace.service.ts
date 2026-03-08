import { promises as fs } from 'fs';
import path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { WORKSPACE_COMPAT_FILE_VALUES } from '@shared/constants';
import {
    WorkspaceEnvKeySchema,
    WorkspaceEnvVarsSchema,
    WorkspaceRootPathSchema
} from '@shared/schemas/service-hardening.schema';
import { JsonObject } from '@shared/types/common';
import { getErrorMessage, ValidationError } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface WorkspaceStats {
    fileCount: number
    totalSize: number
    loc: number // approximate
    lastModified: number
}

export interface WorkspaceIssue {
    type: 'error' | 'warning'
    message: string
    file: string
    line: number
}

export interface WorkspaceFilesPageMeta {
    offset: number
    limit: number
    total: number
    hasMore: boolean
}

export interface WorkspaceFilesPageResult extends WorkspaceFilesPageMeta {
    files: string[]
}

export interface WorkspaceAnalysis {
    type: 'node' | 'python' | 'rust' | 'go' | 'cpp' | 'java' | 'php' | 'csharp' | 'unknown' | string
    frameworks: string[]
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
    stats: WorkspaceStats
    languages: Record<string, number>
    files: string[]
    filesPage?: WorkspaceFilesPageMeta
    monorepo?: {
        type: 'npm' | 'yarn' | 'pnpm' | 'lerna' | 'turbo' | 'rush' | 'unknown';
        packages: string[];
    }
    todos: string[]
    issues?: WorkspaceIssue[]
}

const LOG_CONTEXT = 'WorkspaceService';

export class WorkspaceService extends BaseService {
    private watchers: Map<string, import('fs').FSWatcher> = new Map();
    private analysisCache: Map<string, { data: WorkspaceAnalysis; timestamp: number }> = new Map();
    private fileListCache: Map<string, { files: string[]; timestamp: number }> = new Map();
    private changedPathSets: Map<string, Set<string>> = new Map();
    private readonly ANALYSIS_CACHE_TTL_MS = 300000;
    private readonly WORKSPACE_FILES_PAGE_SIZE = 1000;

    constructor() {
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

        // Stop existing watcher if any
        if (this.watchers.has(rootPath)) {
            this.watchers.get(rootPath)?.close();
            this.watchers.delete(rootPath);
        }

        try {
            const { watch } = await import('fs');
            const eventThrottleMap = new Map<string, number>();
            const EVENT_THROTTLE_MS = 150;

            // Recursive native watcher
            const watcher = watch(rootPath, { recursive: true }, (event, filename) => {
                if (!filename) { return; }
                // Simple debounce/filter could be added here
                if (filename.includes('node_modules') || filename.includes('.git')) { return; }
                const fileName = filename.toString();
                const absolutePath = path.join(rootPath, fileName);
                const throttleKey = `${event}:${absolutePath}`;
                const now = Date.now();
                const lastEmittedAt = eventThrottleMap.get(throttleKey) ?? 0;
                if (now - lastEmittedAt < EVENT_THROTTLE_MS) {
                    return;
                }
                eventThrottleMap.set(throttleKey, now);
                this.trackChangedPath(rootPath, absolutePath);
                onChange(event, absolutePath);
            });

            watcher.on('error', (err) => this.logError(`Error on ${rootPath}:`, err));
            this.watchers.set(rootPath, watcher);

        } catch (e) {
            this.logWarn(`Failed to watch ${rootPath}:`, getErrorMessage(e as Error));
        }
    }

    /** Closes all file watchers and clears caches. */
    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up WorkspaceService watchers...');
        for (const [path, watcher] of this.watchers) {
            try {
                watcher.close();
            } catch (err) {
                this.logWarn(`Error closing watcher for ${path}:`, err as Error);
            }
        }
        this.watchers.clear();
        this.analysisCache.clear();
        this.fileListCache.clear();
        this.changedPathSets.clear();
    }

    /**
     * Stops watching a specific workspace directory.
     * @param rootPath - Absolute path to the workspace root
     */
    async stopWatch(rootPath: string) {
        rootPath = this.resolveAndValidateRootPath(rootPath);
        if (this.watchers.has(rootPath)) {
            this.watchers.get(rootPath)?.close();
            this.watchers.delete(rootPath);
            this.changedPathSets.delete(rootPath);
            this.logInfo(`Stopped watching ${rootPath}`);
        }
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
        for (const changedPath of changedPaths) {
            try {
                const stat = await fs.stat(changedPath);
                if (stat.isFile() && !this.shouldIgnore(path.basename(changedPath))) {
                    nextFiles.add(changedPath);
                } else {
                    nextFiles.delete(changedPath);
                }
            } catch {
                nextFiles.delete(changedPath);
            }
        }

        const updatedFiles = Array.from(nextFiles).sort();
        const timestamp = Date.now();
        this.fileListCache.set(rootPath, { files: updatedFiles, timestamp });
        const cachedAnalysis = this.analysisCache.get(rootPath);
        if (!cachedAnalysis) {
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
            return cached.data;
        }

        this.logInfo('Analyzing workspace at (normalized):', { rootPath });
        const runStart = Date.now();

        const files = await this.scanFiles(rootPath, rootPath);
        this.logInfo(`Found ${files.length} files`);
        const type = await this.detectType(files);
        const { frameworks, dependencies, devDependencies } = await this.analyzeDependencies(rootPath, type, files);
        const stats = await this.calculateStats(files, runStart);
        this.logInfo(`Stats calculated:`, stats as unknown as JsonObject);
        const languages = this.calculateLanguages(files);
        const monorepo = await this.detectMonorepo(rootPath, files);
        const todos: string[] = [];
        const issues = await this.findIssues(rootPath, files);
        const initialFilePage = this.paginateFiles(files, 0, this.WORKSPACE_FILES_PAGE_SIZE);

        this.logInfo(`Analysis complete in ${Date.now() - runStart}ms`);

        const analysis: WorkspaceAnalysis = {
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
            todos,
            issues
        };

        const timestamp = Date.now();
        this.analysisCache.set(rootPath, { data: analysis, timestamp });
        this.fileListCache.set(rootPath, { files, timestamp });
        return analysis;
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
            files = await this.scanFiles(rootPath, rootPath);
            this.fileListCache.set(rootPath, { files, timestamp: Date.now() });
        }

        return this.paginateFiles(files, offset, limit);
    }

    private paginateFiles(files: string[], offset: number, limit: number): WorkspaceFilesPageResult {
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

    private async findIssues(rootPath: string, files: string[]): Promise<WorkspaceIssue[]> {
        const issues: WorkspaceIssue[] = [];
        const codeFiles = files.filter(f => /\.(ts|tsx|js|jsx|py|go|rs|kt|java|cpp|h)$/.test(f)).slice(0, 100);

        for (const file of codeFiles) {
            try {
                await this.scanFileIssues(file, rootPath, issues);
                if (issues.length >= 50) { break; }
            } catch (error) {
                this.logWarn(`Failed to scan issues in ${file}: ${getErrorMessage(error as Error)}`);
            }
            if (issues.length >= 50) { break; }
        }
        return issues;
    }

    private async scanFileIssues(file: string, rootPath: string, issues: WorkspaceIssue[]) {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        const fileName = path.relative(rootPath, file);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();

            if (lowerLine.includes('console.error(') || lowerLine.includes('fixme:') || lowerLine.includes('bug:')) {
                issues.push({ type: 'error', message: line.trim(), file: fileName, line: i + 1 });
            } else if (lowerLine.includes('console.warn(') || lowerLine.includes('warning:')) {
                issues.push({ type: 'warning', message: line.trim(), file: fileName, line: i + 1 });
            }
            if (issues.length >= 50) { break; }
        }
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
        readme: string | null
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

        // 2. Check for README.md
        let readme: string | null = null;
        try {
            const readmePath = path.join(dirPath, 'README.md');
            readme = await fs.readFile(readmePath, 'utf-8');
        } catch (error) {
            /* README.md not found */
            this.logDebug(`README.md not found in ${dirPath}:`, getErrorMessage(error as Error));
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

        const stats = await this.calculateStats(files, Date.now());

        return { hasPackageJson, pkg, readme, stats };
    }

    private calculateLanguages(files: string[]): Record<string, number> {
        const langMap: Record<string, number> = {};
        const commonExts: Record<string, string> = {
            'js': 'JavaScript',
            'mjs': 'JavaScript',
            'cjs': 'JavaScript',
            'ts': 'TypeScript',
            'mts': 'TypeScript',
            'cts': 'TypeScript',
            'tsx': 'React (TS)',
            'jsx': 'React (JS)',
            'py': 'Python',
            'go': 'Go',
            'rs': 'Rust',
            'java': 'Java',
            'c': 'C',
            'cpp': 'C++',
            'cc': 'C++',
            'cs': 'C#',
            'php': 'PHP',
            'rb': 'Ruby',
            'lua': 'Lua',
            'swift': 'Swift',
            'kt': 'Kotlin',
            'dart': 'Dart',
            'html': 'HTML',
            'vue': 'Vue',
            'svelte': 'Svelte',
            'css': 'CSS',
            'scss': 'SCSS',
            'sass': 'Sass',
            'less': 'Less',
            'json': 'JSON',
            'md': 'Markdown',
            'yaml': 'YAML',
            'yml': 'YAML',
            'xml': 'XML',
            'svg': 'SVG',
            'sql': 'SQL',
            'sh': 'Shell',
            'bash': 'Shell',
            'zsh': 'Shell',
            'fish': 'Shell',
            'ps1': 'PowerShell',
            'bat': 'Batch',
            'cmd': 'Batch',
            'pl': 'Perl',
            'pm': 'Perl',
            'scala': 'Scala',
            'hs': 'Haskell',
            'ex': 'Elixir',
            'exs': 'Elixir',
            'clj': 'Clojure',
            'm': 'Objective-C',
            'mm': 'Objective-C',
            'graphql': 'GraphQL',
            'gql': 'GraphQL',
            'proto': 'Protobuf',
            'sol': 'Solidity',
            'toml': 'TOML',
            'ini': 'INI',
            'dockerfile': 'Dockerfile',
            'makefile': 'Makefile',
            'hbs': 'Handlebars',
            'pug': 'Pug',
            'jade': 'Pug',
            'coffee': 'CoffeeScript',
            'fs': 'F#',
            'pas': 'Pascal',
            'f': 'Fortran',
            'v': 'Verilog',
            'vhd': 'VHDL'
        };

        for (const file of files) {
            const ext = path.extname(file).slice(1).toLowerCase();
            if (!ext) { continue; }

            const lang = commonExts[ext] ?? ext.toUpperCase();
            langMap[lang] = (langMap[lang] ?? 0) + 1;
        }

        return langMap;
    }

    private async scanFiles(dir: string, rootPath: string, fileList: string[] = []): Promise<string[]> {
        this.logInfo(`Scanning directory: ${dir}`);
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (this.shouldIgnore(entry.name)) { continue; }
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await this.scanFiles(fullPath, rootPath, fileList);
                } else {
                    fileList.push(fullPath);
                }
            }
        } catch (error) {
            this.logWarn(`Failed to scan directory ${dir}:`, getErrorMessage(error as Error));
        }
        if (dir === rootPath) {
            this.logInfo(`Workspace analysis started for ${rootPath}. Found ${fileList.slice(0, 3)}...`);
        }
        return fileList;
    }

    private shouldIgnore(name: string): boolean {
        const lowerName = name.toLowerCase();
        const ignoredNames = [
            'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.Tengra',
            '.vscode', '.idea', 'coverage', '.nyc_output', 'target', 'bin', 'obj',
            '.next', '.nuxt', '.cache', '__pycache__', '.pytest_cache', '.output',
            '.yarn', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'composer.lock',
            'cargo.lock', 'go.sum', '.ds_store', 'thumbs.db', '.parcel-cache', '.turbo'
        ];
        if (ignoredNames.includes(lowerName)) { return true; }

        // Also ignore common binary or large asset extensions
        const ignoredExtensions = [
            '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
            '.pyc', '.pyo', '.pyd', '.class', '.jar', '.war', '.ear',
            '.zip', '.tar', '.gz', '.7z', '.rar',
            '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
            '.mp3', '.mp4', '.wav', '.mov', '.pdf', '.doc', '.docx'
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
            case 'node': return this.analyzeNodeDependencies(rootPath);
            case 'python': return this.analyzePythonDependencies(rootPath);
            case 'go': return this.analyzeGoDependencies(rootPath);
            case 'rust': return this.analyzeRustDependencies(rootPath);
            case 'java': return this.analyzeJavaDependencies(rootPath, allFiles);
            default: return { frameworks: [], dependencies: {}, devDependencies: {} };
        }
    }

    private async analyzeNodeDependencies(rootPath: string) {
        const result = { frameworks: [] as string[], dependencies: {} as Record<string, string>, devDependencies: {} };
        try {
            const pkgPath = path.join(rootPath, 'package.json');
            const content = await fs.readFile(pkgPath, 'utf-8');
            const pkg = safeJsonParse<JsonObject>(content, {});

            result.dependencies = pkg.dependencies ? (pkg.dependencies as Record<string, string>) : {};
            result.devDependencies = pkg.devDependencies ? (pkg.devDependencies as Record<string, string>) : {};

            this.detectNodeFrameworks(pkg, result.frameworks);
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
            'tailwindcss': 'TailwindCSS',
            'typescript': 'TypeScript'
        };

        for (const [key, name] of Object.entries(FRAMEWORK_MAP)) {
            if (depKeys.includes(key) && !frameworks.includes(name)) {
                frameworks.push(name);
            }
        }
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
                appLogger.debug(LOG_CONTEXT, `Failed to read gradle file ${file}:`, getErrorMessage(error as Error));
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
                appLogger.debug(LOG_CONTEXT, `Failed to read pom file ${file}:`, getErrorMessage(error as Error));
            }
        }
    }

    private detectJavaFrameworks(depKeys: string[], frameworks: string[]) {
        if (depKeys.some(d => d.includes('junit'))) { frameworks.push('JUnit'); }
        if (depKeys.some(d => d.includes('hibernate'))) { frameworks.push('Hibernate'); }
        if (depKeys.some(d => d.includes('dagger')) || depKeys.some(d => d.includes('hilt'))) { frameworks.push('Dagger/Hilt'); }
        if (depKeys.some(d => d.includes('retrofit'))) { frameworks.push('Retrofit'); }
    }

    private async calculateStats(files: string[], runStart: number): Promise<WorkspaceStats> {
        if (runStart % 100 === 0) {
            appLogger.info(LOG_CONTEXT, 'Calculate stats sample', { filesCount: files.length });
        }
        let totalSize = 0;
        let lastModified = 0;
        const fileCount = files.length;

        // Simple LOC estimation based on file size (very rough)
        // 100 bytes approx 1 line of code including whitespace
        let totalBytes = 0;

        for (const file of files) {
            try {
                const stat = await fs.stat(file);
                totalSize += stat.size;
                totalBytes += stat.size;
                if (stat.mtimeMs > lastModified) {
                    lastModified = stat.mtimeMs;
                }
            } catch (error) {
                // Ignore missing file errors during scan
                appLogger.debug(LOG_CONTEXT, `Failed to stat file ${file}:`, getErrorMessage(error as Error));
            }
        }

        return {
            fileCount,
            totalSize,
            loc: Math.round(totalBytes / 50), // Rough estimate: 50 bytes per line avg
            lastModified
        };
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
            appLogger.debug(LOG_CONTEXT, `Failed to read .env file at ${envPath}: ${getErrorMessage(error as Error)}`);
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
        const sanitizedInput = process.platform === 'win32' && inputPath.startsWith('/') && inputPath.charAt(2) === ':'
            ? inputPath.slice(1)
            : inputPath;
        const parsedPath = WorkspaceRootPathSchema.safeParse(sanitizedInput);
        if (!parsedPath.success) {
            throw new ValidationError(`Invalid workspace root path: ${parsedPath.error.issues[0]?.message ?? 'unknown validation issue'}`);
        }
        return path.resolve(parsedPath.data);
    }
}


