import { promises as fs } from 'fs';
import path from 'path';

import { appLogger } from '@main/logging/logger';
import { JsonObject } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface ProjectStats {
    fileCount: number
    totalSize: number
    loc: number // approximate
    lastModified: number
}

export interface ProjectIssue {
    type: 'error' | 'warning'
    message: string
    file: string
    line: number
}

export interface ProjectAnalysis {
    type: 'node' | 'python' | 'rust' | 'go' | 'cpp' | 'java' | 'php' | 'csharp' | 'unknown' | string
    frameworks: string[]
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
    stats: ProjectStats
    languages: Record<string, number>
    files: string[]
    monorepo?: {
        type: 'npm' | 'yarn' | 'pnpm' | 'lerna' | 'turbo' | 'rush' | 'unknown';
        packages: string[];
    }
    todos: string[]
    issues?: ProjectIssue[]
}

const LOG_CONTEXT = 'ProjectService';

export class ProjectService {
    private watchers: Map<string, import('fs').FSWatcher> = new Map();
    private analysisCache: Map<string, { data: ProjectAnalysis; timestamp: number }> = new Map();

    constructor() { }

    async watchProject(rootPath: string, onChange: (event: string, path: string) => void): Promise<void> {
        appLogger.info(LOG_CONTEXT, `Starting watch on ${rootPath}`);

        // Stop existing watcher if any
        if (this.watchers.has(rootPath)) {
            this.watchers.get(rootPath)?.close();
            this.watchers.delete(rootPath);
        }

        try {
            const { watch } = await import('fs');

            // Recursive native watcher
            const watcher = watch(rootPath, { recursive: true }, (event, filename) => {
                if (!filename) { return; }
                // Simple debounce/filter could be added here
                if (filename.includes('node_modules') || filename.includes('.git')) { return; }
                onChange(event, path.join(rootPath, filename.toString()));
            });

            watcher.on('error', (err) => appLogger.error(LOG_CONTEXT, `Error on ${rootPath}:`, err));
            this.watchers.set(rootPath, watcher);

        } catch (e) {
            appLogger.warn(LOG_CONTEXT, `Failed to watch ${rootPath}:`, getErrorMessage(e as Error));
        }
    }

    async stopWatch(rootPath: string) {
        if (this.watchers.has(rootPath)) {
            this.watchers.get(rootPath)?.close();
            this.watchers.delete(rootPath);
        }
    }

    async analyzeProject(rootPath: string): Promise<ProjectAnalysis> {
        // Handle Windows paths from renderer that might have leading slash (e.g. /C:/...)
        if (process.platform === 'win32' && rootPath.startsWith('/') && rootPath.charAt(2) === ':') {
            rootPath = rootPath.slice(1);
        }
        rootPath = path.resolve(rootPath);

        // Cache Check (5 min TTL)
        const cached = this.analysisCache.get(rootPath);
        if (cached && (Date.now() - cached.timestamp < 300000)) {
            appLogger.debug(LOG_CONTEXT, 'Returning cached project analysis for:', rootPath);
            return cached.data;
        }

        appLogger.info(LOG_CONTEXT, 'Analyzing project at (normalized):', { rootPath });
        const runStart = Date.now();

        const files = await this.scanFiles(rootPath, rootPath);
        appLogger.info(LOG_CONTEXT, `Found ${files.length} files`);
        const type = await this.detectType(files);
        const { frameworks, dependencies, devDependencies } = await this.analyzeDependencies(rootPath, type, files);
        const stats = await this.calculateStats(files, runStart);
        appLogger.info(LOG_CONTEXT, `Stats calculated:`, stats as unknown as JsonObject);
        const languages = this.calculateLanguages(files);
        const monorepo = await this.detectMonorepo(rootPath, files);
        const todos = await this.findTodos(rootPath, files);
        const issues = await this.findIssues(rootPath, files);

        appLogger.info(LOG_CONTEXT, `Analysis complete in ${Date.now() - runStart}ms`);

        const analysis: ProjectAnalysis = {
            type,
            frameworks,
            dependencies,
            devDependencies,
            stats,
            languages,
            files: files.slice(0, 1000), // Limit file list for performance in IPC
            monorepo,
            todos,
            issues
        };

        this.analysisCache.set(rootPath, { data: analysis, timestamp: Date.now() });
        return analysis;
    }

    private async detectMonorepo(rootPath: string, files: string[]): Promise<ProjectAnalysis['monorepo'] | undefined> {
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
            appLogger.warn(LOG_CONTEXT, 'Monorepo detection failed:', getErrorMessage(e as Error));
        }
        return undefined;
    }

    private async checkNpmWorkspace(rootPath: string): Promise<ProjectAnalysis['monorepo'] | undefined> {
        const pkgPath = path.join(rootPath, 'package.json');
        const content = await fs.readFile(pkgPath, 'utf-8');
        const pkg = safeJsonParse<{ workspaces?: string[] }>(content, {});
        if (pkg.workspaces) {
            return { type: 'npm', packages: pkg.workspaces };
        }
        return undefined;
    }

    private async checkGradleWorkspace(rootPath: string, fileNames: string[]): Promise<ProjectAnalysis['monorepo'] | undefined> {
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

    private async findTodos(rootPath: string, files: string[]): Promise<string[]> {
        const todoFiles = ['todo.md', 'todo.txt', 'todo', 'tasks.md', 'tasks.txt', 'roadmap.md'];
        const foundFile = files.find(f => {
            const rel = path.relative(rootPath, f).toLowerCase();
            return todoFiles.includes(rel);
        });

        if (foundFile) {
            return this.parseTodoFile(foundFile);
        }

        // Fallback: look for TODO comments in code (first 10)
        return this.scanCodeComments(files);
    }

    private async parseTodoFile(filePath: string): Promise<string[]> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const tasks = lines
                .map(l => l.trim())
                .map(l => {
                    const match = l.match(/^[-*+]\s*\[([ xX-])\]\s*(.*)/);
                    if (match) { return match[2].trim(); }
                    if (l.startsWith('TODO:') || l.startsWith('FIXME:')) { return l.replace(/^(TODO|FIXME):?\s*/, '').trim(); }
                    return null;
                })
                .filter((t): t is string => t !== null && t.length > 0);

            if (tasks.length > 0) { return tasks; }
            // If no checklist, just return first non-empty 10 lines
            return lines.filter(l => l.trim().length > 0).slice(0, 10);
        } catch (e) {
            appLogger.warn(LOG_CONTEXT, 'Failed to read todo file:', getErrorMessage(e as Error));
            return [];
        }
    }

    private async scanCodeComments(files: string[]): Promise<string[]> {
        const codeFiles = files.filter(f => /\.(ts|tsx|js|jsx|py|go|rs|kt|java|cpp|h)$/.test(f)).slice(0, 100);
        const todoComments: string[] = [];
        for (const file of codeFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                this.extractTodosFromContent(content, todoComments, file);
                if (todoComments.length >= 10) { break; }
            } catch { /* ignore */ }
            if (todoComments.length >= 10) { break; }
        }
        return todoComments;
    }

    private extractTodosFromContent(content: string, todoComments: string[], filePath?: string) {
        const lines = content.split('\n');
        const fileName = filePath ? path.basename(filePath) : '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('TODO:') || line.includes('FIXME:')) {
                const match = line.match(/(TODO|FIXME):?\s*(.*)/);
                if (match?.[2]) {
                    const text = match[2].trim();
                    todoComments.push(fileName ? `[${fileName}:${i + 1}] ${text}` : text);
                }
                if (todoComments.length >= 10) { break; }
            }
        }
    }

    private async findIssues(rootPath: string, files: string[]): Promise<ProjectIssue[]> {
        const issues: ProjectIssue[] = [];
        const codeFiles = files.filter(f => /\.(ts|tsx|js|jsx|py|go|rs|kt|java|cpp|h)$/.test(f)).slice(0, 100);

        for (const file of codeFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const lines = content.split('\n');
                const fileName = path.relative(rootPath, file);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lowerLine = line.toLowerCase();

                    // Scan for errors
                    if (lowerLine.includes('console.error(') || lowerLine.includes('fixme:') || lowerLine.includes('bug:')) {
                        issues.push({
                            type: 'error',
                            message: line.trim(),
                            file: fileName,
                            line: i + 1
                        });
                    } else if (lowerLine.includes('console.warn(') || lowerLine.includes('warning:')) {
                        issues.push({
                            type: 'warning',
                            message: line.trim(),
                            file: fileName,
                            line: i + 1
                        });
                    }

                    if (issues.length >= 50) { break; }
                }
            } catch { /* ignore */ }
            if (issues.length >= 50) { break; }
        }
        return issues;
    }

    private async findPackages(_rootPath: string, _configType: string): Promise<string[]> {
        // Placeholder for real glob parsing logic
        // For Phase 1, we just return basic assumption
        return ['packages/*'];
    }

    async analyzeDirectory(dirPath: string): Promise<{
        hasPackageJson: boolean
        pkg: JsonObject
        readme: string | null
        stats: ProjectStats
    }> {
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
            appLogger.debug('project.service', `[ProjectService] package.json not found in ${dirPath}:`, getErrorMessage(error as Error));
        }

        // 2. Check for README.md
        let readme: string | null = null;
        try {
            const readmePath = path.join(dirPath, 'README.md');
            readme = await fs.readFile(readmePath, 'utf-8');
        } catch (error) {
            /* README.md not found */
            appLogger.debug(LOG_CONTEXT, `README.md not found in ${dirPath}:`, getErrorMessage(error as Error));
        }

        // 3. Stats for this folder
        let files: string[] = [];
        try {
            const entries = await fs.readdir(dirPath);
            files = entries.map(e => path.join(dirPath, e));
        } catch (error) {
            /* Failed to read directory */
            appLogger.warn(LOG_CONTEXT, `Failed to read directory ${dirPath}:`, getErrorMessage(error as Error));
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
        appLogger.info(LOG_CONTEXT, `Scanning directory: ${dir}`);
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
            appLogger.warn(LOG_CONTEXT, `Failed to scan directory ${dir}:`, getErrorMessage(error as Error));
        }
        if (dir === rootPath) {
            appLogger.info(LOG_CONTEXT, `Project analysis started for ${rootPath}. Found ${fileList.slice(0, 3)}...`);
        }
        return fileList;
    }

    private shouldIgnore(name: string): boolean {
        const lowerName = name.toLowerCase();
        const ignoredNames = [
            'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.orbit',
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

    private async detectType(files: string[]): Promise<ProjectAnalysis['type'] | string> {
        const fileNames = files.map(f => path.basename(f).toLowerCase());
        if (fileNames.includes('package.json')) { return 'node'; }
        if (this.isPythonProject(fileNames)) { return 'python'; }
        if (fileNames.includes('cargo.toml')) { return 'rust'; }
        if (fileNames.includes('go.mod')) { return 'go'; }
        if (this.isJavaProject(fileNames)) { return 'java'; }
        if (this.isCppProject(fileNames)) { return 'cpp'; }
        if (fileNames.some(f => f.endsWith('.php'))) { return 'php'; }
        if (this.isCsharpProject(fileNames)) { return 'csharp'; }
        return 'unknown';
    }

    private isPythonProject(fileNames: string[]): boolean {
        return fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml') || fileNames.some(f => f.endsWith('.py'));
    }

    private isJavaProject(fileNames: string[]): boolean {
        return fileNames.includes('pom.xml') || fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts') || fileNames.some(f => f.endsWith('.kt') || f.endsWith('.kts'));
    }

    private isCppProject(fileNames: string[]): boolean {
        return fileNames.includes('cmakelists.txt') || fileNames.some(f => f.endsWith('.cpp') || f.endsWith('.cc') || f.endsWith('.h') || f.endsWith('.hpp'));
    }

    private isCsharpProject(fileNames: string[]): boolean {
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
            appLogger.warn(LOG_CONTEXT, 'Failed to parse package.json:', getErrorMessage(error as Error));
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
        await this.analyzePyProject(rootPath, result.dependencies);

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
            appLogger.debug(LOG_CONTEXT, 'requirements.txt not found:', getErrorMessage(error as Error));
        }
    }

    private async analyzePyProject(rootPath: string, dependencies: Record<string, string>) {
        try {
            const pyprojectPath = path.join(rootPath, 'pyproject.toml');
            const content = await fs.readFile(pyprojectPath, 'utf-8');

            this.parsePyProjectDependencies(content, dependencies);
            this.parsePoetryDependencies(content, dependencies);
        } catch (error) {
            appLogger.debug(LOG_CONTEXT, 'pyproject.toml not found:', getErrorMessage(error as Error));
        }
    }

    private parsePyProjectDependencies(content: string, dependencies: Record<string, string>) {
        const depMatch = content.match(/\[project\.dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/);
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
            appLogger.debug(LOG_CONTEXT, 'go.mod not found:', getErrorMessage(error as Error));
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
            appLogger.debug(LOG_CONTEXT, 'Cargo.toml not found:', getErrorMessage(error as Error));
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

    private async calculateStats(files: string[], runStart: number): Promise<ProjectStats> {
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

    async getEnvVars(rootPath: string): Promise<Record<string, string>> {
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
                let value = trimmed.slice(firstEquals + 1).trim();
                // Remove quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                result[key] = value;
            }
            return result;
        } catch (error) {
            appLogger.debug(LOG_CONTEXT, `Failed to read .env file at ${envPath}: ${getErrorMessage(error as Error)}`);
            return {};
        }
    }

    async saveEnvVars(rootPath: string, vars: Record<string, string>): Promise<void> {
        const envPath = path.join(rootPath, '.env');
        try {
            const content = Object.entries(vars)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            await fs.writeFile(envPath, content, 'utf-8');
            appLogger.info(LOG_CONTEXT, `Successfully saved .env vars to ${envPath}`);
        } catch (error) {
            appLogger.error(LOG_CONTEXT, `Failed to save .env file at ${envPath}:`, error as Error);
            throw error;
        }
    }
}
