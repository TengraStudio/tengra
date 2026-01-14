import { promises as fs } from 'fs'
import path from 'path'

import { JsonObject } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'

export interface ProjectStats {
    fileCount: number
    totalSize: number
    loc: number // approximate
    lastModified: number
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
}

export class ProjectService {
    constructor() { }

    private watchers: Map<string, import('fs').FSWatcher> = new Map()

    async watchProject(rootPath: string, onChange: (event: string, path: string) => void): Promise<void> {
        console.log(`[ProjectService] Starting watch on ${rootPath}`)

        // Stop existing watcher if any
        if (this.watchers.has(rootPath)) {
            this.watchers.get(rootPath)?.close()
            this.watchers.delete(rootPath)
        }

        try {
            const { watch } = await import('fs')

            // Recursive native watcher
            const watcher = watch(rootPath, { recursive: true }, (event, filename) => {
                if (!filename) {return}
                // Simple debounce/filter could be added here
                if (filename.includes('node_modules') || filename.includes('.git')) {return}
                onChange(event, path.join(rootPath, filename.toString()))
            })

            watcher.on('error', (err) => console.error(`[ProjectWatcher] Error on ${rootPath}:`, err))
            this.watchers.set(rootPath, watcher)

        } catch (e) {
            console.warn(`[ProjectService] Failed to watch ${rootPath}:`, getErrorMessage(e as Error))
        }
    }

    async stopWatch(rootPath: string) {
        if (this.watchers.has(rootPath)) {
            this.watchers.get(rootPath)?.close()
            this.watchers.delete(rootPath)
        }
    }

    async analyzeProject(rootPath: string): Promise<ProjectAnalysis> {
        // Handle Windows paths from renderer that might have leading slash (e.g. /C:/...)
        if (process.platform === 'win32' && rootPath.startsWith('/') && rootPath.charAt(2) === ':') {
            rootPath = rootPath.slice(1)
        }
        rootPath = path.resolve(rootPath)
        console.log('[ProjectService] Analyzing project at (normalized):', rootPath)
        const runStart = Date.now()

        const files = await this.scanFiles(rootPath, rootPath)
        console.log(`[ProjectService] Found ${files.length} files`)
        const type = await this.detectType(files)
        const { frameworks, dependencies, devDependencies } = await this.analyzeDependencies(rootPath, type, files)
        const stats = await this.calculateStats(files)
        console.log(`[ProjectService] Stats calculated:`, stats)
        const languages = this.calculateLanguages(files)
        const monorepo = await this.detectMonorepo(rootPath, files)
        const todos = await this.findTodos(rootPath, files)

        console.log(`[ProjectService] Analysis complete in ${Date.now() - runStart}ms`)

        return {
            type,
            frameworks,
            dependencies,
            devDependencies,
            stats,
            languages,
            files: files.slice(0, 1000), // Limit file list for performance in IPC
            monorepo,
            todos
        }
    }

    private async detectMonorepo(rootPath: string, files: string[]): Promise<ProjectAnalysis['monorepo'] | undefined> {
        try {
            const fileNames = files.map(f => path.basename(f).toLowerCase())

            // pnpm
            if (fileNames.includes('pnpm-workspace.yaml')) {
                return { type: 'pnpm', packages: await this.findPackages(rootPath, 'pnpm-workspace.yaml') }
            }

            // lerna
            if (fileNames.includes('lerna.json')) {
                return { type: 'lerna', packages: await this.findPackages(rootPath, 'lerna.json') }
            }

            // yarn/npm workspaces (in package.json)
            if (fileNames.includes('package.json')) {
                const pkgPath = path.join(rootPath, 'package.json')
                const content = await fs.readFile(pkgPath, 'utf-8')
                const pkg = JSON.parse(content)
                if (pkg.workspaces) {
                    return { type: 'npm', packages: pkg.workspaces } // Simplification: actually explicit globs
                }
            }

            // Gradle multi-project
            const gradleSettings = fileNames.find(f => f === 'settings.gradle' || f === 'settings.gradle.kts')
            if (gradleSettings) {
                const settingsPath = path.join(rootPath, gradleSettings)
                const content = await fs.readFile(settingsPath, 'utf-8')
                // Match include 'module', include ':module', include(":module")
                const moduleMatches = content.matchAll(/include\s*\(?([\s\S]*?)\)?(?:\n|$)/g)
                const packages: string[] = []
                for (const m of moduleMatches) {
                    const block = m[1]
                    const names = block.matchAll(/['"]:?([^'"]+)['"]/g)
                    for (const n of names) {
                        packages.push(n[1])
                    }
                }
                if (packages.length > 0) {
                    return { type: 'unknown', packages } // Gradle doesn't have a single "monorepo" type in the UI enum but we can use packages
                }
            }

            // Turbo
            if (fileNames.includes('turbo.json')) {
                return { type: 'turbo', packages: [] }
            }

        } catch (e) {
            console.warn('[ProjectService] Monorepo detection failed:', e)
        }
        return undefined
    }

    private async findTodos(rootPath: string, files: string[]): Promise<string[]> {
        const todoFiles = ['todo.md', 'todo.txt', 'todo', 'tasks.md', 'tasks.txt', 'roadmap.md']
        const foundFile = files.find(f => {
            const rel = path.relative(rootPath, f).toLowerCase()
            return todoFiles.includes(rel)
        })

        if (foundFile) {
            try {
                const content = await fs.readFile(foundFile, 'utf-8')
                // Extract tasks (lines starting with - [ ], - [x], etc.)
                const lines = content.split('\n')
                const tasks = lines
                    .map(l => l.trim())
                    .filter(l => /^[-*+]\s*\[[ xX]?\]/.test(l) || /^[-*+]\s+/.test(l))
                    .map(l => l.replace(/^[-*+]\s*\[[ xX]?\]\s*/, '').replace(/^[-*+]\s+/, ''))

                if (tasks.length > 0) {return tasks}

                // If no checklist, just return first non-empty 10 lines
                return lines.filter(l => l.trim().length > 0).slice(0, 10)
            } catch (e) {
                console.warn('[ProjectService] Failed to read todo file:', e)
            }
        }

        // Fallback: look for TODO comments in code (first 10)
        const codeFiles = files.filter(f => /\.(ts|tsx|js|jsx|py|go|rs|kt|java|cpp|h)$/.test(f)).slice(0, 100)
        const todoComments: string[] = []
        for (const file of codeFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8')
                const lines = content.split('\n')
                for (const line of lines) {
                    if (line.includes('TODO:') || line.includes('FIXME:')) {
                        todoComments.push(line.split('TODO:')[1]?.trim() || line.split('FIXME:')[1]?.trim())
                        if (todoComments.length >= 10) {break}
                    }
                }
            } catch { /* ignore */ }
            if (todoComments.length >= 10) {break}
        }

        return todoComments
    }

    private async findPackages(_rootPath: string, _configType: string): Promise<string[]> {
        // Placeholder for real glob parsing logic
        // For Phase 1, we just return basic assumption
        return ['packages/*']
    }

    async analyzeDirectory(dirPath: string): Promise<{
        hasPackageJson: boolean
        pkg: JsonObject
        readme: string | null
        stats: ProjectStats
    }> {
        // 1. Check for package.json
        let hasPackageJson = false
        let pkg: JsonObject = {}
        try {
            const pkgPath = path.join(dirPath, 'package.json')
            const content = await fs.readFile(pkgPath, 'utf-8')
            pkg = JSON.parse(content)
            hasPackageJson = true
        } catch (error) {
            /* package.json not found or parse error */
            console.debug(`[ProjectService] package.json not found in ${dirPath}:`, getErrorMessage(error as Error))
        }

        // 2. Check for README.md
        let readme: string | null = null
        try {
            const readmePath = path.join(dirPath, 'README.md')
            readme = await fs.readFile(readmePath, 'utf-8')
        } catch (error) {
            /* README.md not found */
            console.debug(`[ProjectService] README.md not found in ${dirPath}:`, getErrorMessage(error as Error))
        }

        // 3. Stats for this folder
        let files: string[] = []
        try {
            const entries = await fs.readdir(dirPath)
            files = entries.map(e => path.join(dirPath, e))
        } catch (error) {
            /* Failed to read directory */
            console.warn(`[ProjectService] Failed to read directory ${dirPath}:`, getErrorMessage(error as Error))
        }

        const stats = await this.calculateStats(files)

        return { hasPackageJson, pkg, readme, stats }
    }

    private calculateLanguages(files: string[]): Record<string, number> {
        const langMap: Record<string, number> = {}
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
        }

        for (const file of files) {
            const ext = path.extname(file).slice(1).toLowerCase()
            if (!ext) {continue}

            const lang = commonExts[ext] || ext.toUpperCase()
            langMap[lang] = (langMap[lang] || 0) + 1
        }

        return langMap
    }

    private async scanFiles(dir: string, rootPath: string, fileList: string[] = []): Promise<string[]> {
        console.log(`[ProjectService] Scanning directory: ${dir}`)
        // Simple recursive scan, respecting basic ignores
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                // Basic ignore list
                if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.orbit' || entry.name === '.vscode' || entry.name === 'coverage') {continue}

                if (entry.isDirectory()) {
                    await this.scanFiles(fullPath, rootPath, fileList)
                } else {
                    fileList.push(fullPath)
                }
            }
        } catch (error) {
            console.warn(`[ProjectService] Failed to scan directory ${dir}:`, getErrorMessage(error as Error))
        }
        if (dir === rootPath) {
            console.log(`[ProjectService] Scan complete for ${dir}. Found ${fileList.length} files. First 3:`, fileList.slice(0, 3))
        }
        return fileList
    }

    private async detectType(files: string[]): Promise<ProjectAnalysis['type'] | string> {
        // Check for specific indicator files
        const fileNames = files.map(f => path.basename(f).toLowerCase())
        if (fileNames.includes('package.json')) {return 'node'}
        if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml') || fileNames.some(f => f.endsWith('.py'))) {return 'python'}
        if (fileNames.includes('cargo.toml')) {return 'rust'}
        if (fileNames.includes('go.mod')) {return 'go'}
        if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts')) {return 'java'}
        if (fileNames.includes('cmakelists.txt') || fileNames.some(f => f.endsWith('.cpp') || f.endsWith('.cc') || f.endsWith('.h') || f.endsWith('.hpp'))) {return 'cpp'}
        if (fileNames.some(f => f.endsWith('.php'))) {return 'php'}
        if (fileNames.some(f => f.endsWith('.cs')) || fileNames.some(f => f.endsWith('.csproj'))) {return 'csharp'}
        if (fileNames.some(f => f.endsWith('.kt')) || fileNames.some(f => f.endsWith('.kts'))) {return 'java'} // Map Kotlin to Java for now as they share the ecosystem

        return 'unknown'
    }

    private async analyzeDependencies(rootPath: string, type: string, allFiles: string[]): Promise<{ frameworks: string[], dependencies: Record<string, string>, devDependencies: Record<string, string> }> {
        const result = {
            frameworks: [] as string[],
            dependencies: {} as Record<string, string>,
            devDependencies: {} as Record<string, string>
        }

        if (type === 'node') {
            try {
                const pkgPath = path.join(rootPath, 'package.json')
                const content = await fs.readFile(pkgPath, 'utf-8')
                const pkg = JSON.parse(content)

                result.dependencies = pkg.dependencies || {}
                result.devDependencies = pkg.devDependencies || {}

                const allDeps = { ...result.dependencies, ...result.devDependencies }
                const depKeys = Object.keys(allDeps)

                // Framework detection logic
                if (depKeys.includes('react')) {result.frameworks.push('React')}
                if (depKeys.includes('next')) {result.frameworks.push('Next.js')}
                if (depKeys.includes('vue')) {result.frameworks.push('Vue')}
                if (depKeys.includes('svelte')) {result.frameworks.push('Svelte')}
                if (depKeys.includes('express')) {result.frameworks.push('Express')}
                if (depKeys.includes('electron')) {result.frameworks.push('Electron')}
                if (depKeys.includes('tailwindcss')) {result.frameworks.push('TailwindCSS')}
                if (depKeys.includes('typescript')) {result.frameworks.push('TypeScript')}
            } catch (error) {
                console.warn('[ProjectService] Failed to parse package.json:', getErrorMessage(error as Error))
            }
        } else if (type === 'python') {
            // Parse requirements.txt
            try {
                const reqPath = path.join(rootPath, 'requirements.txt')
                const content = await fs.readFile(reqPath, 'utf-8')
                const lines = content.split('\n')

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || trimmed.startsWith('#')) {continue}

                    // Parse package==version, package>=version, etc.
                    const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[=<>!~]+(.+))?/)
                    if (match) {
                        result.dependencies[match[1]] = match[2] || '*'
                    }
                }
            } catch (error) {
                /* requirements.txt not found */
                console.debug('[ProjectService] requirements.txt not found:', getErrorMessage(error as Error))
            }

            // Parse pyproject.toml for modern Python projects
            try {
                const pyprojectPath = path.join(rootPath, 'pyproject.toml')
                const content = await fs.readFile(pyprojectPath, 'utf-8')

                // Simple TOML parsing for dependencies section
                const depMatch = content.match(/\[project\.dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/)
                if (depMatch) {
                    const depLines = depMatch[1].split('\n')
                    for (const line of depLines) {
                        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/)
                        if (match) {
                            result.dependencies[match[1]] = '*'
                        }
                    }
                }

                // Also check [tool.poetry.dependencies] for Poetry projects
                const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/)
                if (poetryMatch) {
                    const depLines = poetryMatch[1].split('\n')
                    for (const line of depLines) {
                        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"?([^"]+)"?/)
                        if (match && match[1] !== 'python') {
                            result.dependencies[match[1]] = match[2] || '*'
                        }
                    }
                }
            } catch (error) {
                /* pyproject.toml not found */
                console.debug('[ProjectService] pyproject.toml not found:', getErrorMessage(error as Error))
            }

            // Python framework detection
            const allDeps = Object.keys(result.dependencies)
            if (allDeps.includes('django')) {result.frameworks.push('Django')}
            if (allDeps.includes('flask')) {result.frameworks.push('Flask')}
            if (allDeps.includes('fastapi')) {result.frameworks.push('FastAPI')}
            if (allDeps.includes('pytorch') || allDeps.includes('torch')) {result.frameworks.push('PyTorch')}
            if (allDeps.includes('tensorflow')) {result.frameworks.push('TensorFlow')}
            if (allDeps.includes('numpy')) {result.frameworks.push('NumPy')}
            if (allDeps.includes('pandas')) {result.frameworks.push('Pandas')}
            if (allDeps.includes('pytest')) {result.frameworks.push('Pytest')}

        } else if (type === 'go') {
            // Parse go.mod
            try {
                const goModPath = path.join(rootPath, 'go.mod')
                const content = await fs.readFile(goModPath, 'utf-8')

                // Extract require block
                const requireMatch = content.match(/require\s*\(([\s\S]*?)\)/)
                if (requireMatch) {
                    const lines = requireMatch[1].split('\n')
                    for (const line of lines) {
                        const match = line.trim().match(/^([^\s]+)\s+v?(.+)/)
                        if (match) {
                            result.dependencies[match[1]] = match[2]
                        }
                    }
                }

                // Also handle single-line requires
                const singleReqs = content.matchAll(/require\s+([^\s]+)\s+v?([^\s\n]+)/g)
                for (const match of singleReqs) {
                    result.dependencies[match[1]] = match[2]
                }
            } catch (error) {
                /* go.mod not found */
                console.debug('[ProjectService] go.mod not found:', getErrorMessage(error as Error))
            }

            // Go framework detection
            const allDeps = Object.keys(result.dependencies)
            if (allDeps.some(d => d.includes('gin-gonic'))) {result.frameworks.push('Gin')}
            if (allDeps.some(d => d.includes('echo'))) {result.frameworks.push('Echo')}
            if (allDeps.some(d => d.includes('fiber'))) {result.frameworks.push('Fiber')}
            if (allDeps.some(d => d.includes('gorilla/mux'))) {result.frameworks.push('Gorilla Mux')}
            if (allDeps.some(d => d.includes('gorm'))) {result.frameworks.push('GORM')}

        } else if (type === 'rust') {
            // Parse Cargo.toml
            try {
                const cargoPath = path.join(rootPath, 'Cargo.toml')
                const content = await fs.readFile(cargoPath, 'utf-8')

                // Extract [dependencies] section
                const depMatch = content.match(/\[dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/)
                if (depMatch) {
                    const lines = depMatch[1].split('\n')
                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed || trimmed.startsWith('#')) {continue}

                        // Handle both `package = "version"` and `package = { version = "x" }`
                        const simpleMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/)
                        const complexMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{/)

                        if (simpleMatch) {
                            result.dependencies[simpleMatch[1]] = simpleMatch[2]
                        } else if (complexMatch) {
                            // Extract version from complex declaration
                            const versionMatch = trimmed.match(/version\s*=\s*"([^"]+)"/)
                            result.dependencies[complexMatch[1]] = versionMatch ? versionMatch[1] : '*'
                        }
                    }
                }

                // Extract [dev-dependencies] section
                const devDepMatch = content.match(/\[dev-dependencies\]\s*\n([\s\S]*?)(?:\n\[|$)/)
                if (devDepMatch) {
                    const lines = devDepMatch[1].split('\n')
                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed || trimmed.startsWith('#')) {continue}

                        const simpleMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/)
                        if (simpleMatch) {
                            result.devDependencies[simpleMatch[1]] = simpleMatch[2]
                        }
                    }
                }
            } catch (error) {
                /* Cargo.toml not found */
                console.debug('[ProjectService] Cargo.toml not found:', getErrorMessage(error as Error))
            }

            // Rust framework detection
            const allDeps = Object.keys(result.dependencies)
            if (allDeps.includes('actix-web')) {result.frameworks.push('Actix Web')}
            if (allDeps.includes('axum')) {result.frameworks.push('Axum')}
            if (allDeps.includes('rocket')) {result.frameworks.push('Rocket')}
            if (allDeps.includes('tokio')) {result.frameworks.push('Tokio')}
            if (allDeps.includes('serde')) {result.frameworks.push('Serde')}
            if (allDeps.includes('diesel')) {result.frameworks.push('Diesel')}
            if (allDeps.includes('sqlx')) {result.frameworks.push('SQLx')}
        } else if (type === 'java') {
            // Find ALL build.gradle / build.gradle.kts files
            const gradleFiles = allFiles.filter(f => f.endsWith('build.gradle') || f.endsWith('build.gradle.kts'))

            for (const file of gradleFiles) {
                try {
                    const content = await fs.readFile(file, 'utf-8')

                    // Improved regex for dependencies (implementation "name" or implementation("name"))
                    const depRegex = /(?:implementation|api|compile|runtimeOnly|compileOnly|testImplementation|classpath)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g
                    let match
                    while ((match = depRegex.exec(content)) !== null) {
                        const dep = match[1]
                        const parts = dep.split(':')
                        const name = parts.length > 1 ? parts[1] : dep
                        result.dependencies[name] = parts.length > 2 ? parts[2] : '*'
                    }

                    // Framework detection from content
                    if (content.includes('org.springframework.boot')) {result.frameworks.push('Spring Boot')}
                    if (content.includes('com.android.application') || content.includes('com.android.library')) {result.frameworks.push('Android')}
                    if (content.includes('androidx.compose')) {result.frameworks.push('Jetpack Compose')}
                    if (content.includes('io.quarkus')) {result.frameworks.push('Quarkus')}
                    if (content.includes('io.micronaut')) {result.frameworks.push('Micronaut')}
                    if (content.includes('kotlin("jvm")') || content.includes('id "org.jetbrains.kotlin.jvm"')) {result.frameworks.push('Kotlin JVM')}
                    if (content.includes('kotlin("android")') || content.includes('id "org.jetbrains.kotlin.android"')) {result.frameworks.push('Kotlin Android')}
                } catch (error) {
                    console.debug(`[ProjectService] Failed to read gradle file ${file}:`, getErrorMessage(error as Error))
                }
            }

            // Framework detection from aggregated dependencies
            const depKeys = Object.keys(result.dependencies)
            if (depKeys.some(d => d.includes('junit'))) {result.frameworks.push('JUnit')}
            if (depKeys.some(d => d.includes('hibernate'))) {result.frameworks.push('Hibernate')}
            if (depKeys.some(d => d.includes('dagger')) || depKeys.some(d => d.includes('hilt'))) {result.frameworks.push('Dagger/Hilt')}
            if (depKeys.some(d => d.includes('retrofit'))) {result.frameworks.push('Retrofit')}
            if (depKeys.some(d => d.includes('base09'))) {result.frameworks.push('Base09')} // Custom?

            // Parse all pom.xml files
            const pomFiles = allFiles.filter(f => f.endsWith('pom.xml'))
            for (const file of pomFiles) {
                try {
                    const content = await fs.readFile(file, 'utf-8')
                    const depRegex = /<dependency>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?(?:<version>([^<]+)<\/version>)?[\s\S]*?<\/dependency>/g
                    let match
                    while ((match = depRegex.exec(content)) !== null) {
                        result.dependencies[match[1]] = match[2] || '*'
                    }
                    if (content.includes('spring-boot')) {result.frameworks.push('Spring Boot')}
                } catch (error) {
                    console.debug(`[ProjectService] Failed to read pom file ${file}:`, getErrorMessage(error as Error))
                }
            }

            // Deduplicate frameworks
            result.frameworks = [...new Set(result.frameworks)]
        }

        return result
    }

    private async calculateStats(files: string[]): Promise<ProjectStats> {
        let totalSize = 0
        let lastModified = 0
        const fileCount = files.length

        // Simple LOC estimation based on file size (very rough)
        // 100 bytes approx 1 line of code including whitespace
        let totalBytes = 0

        for (const file of files) {
            try {
                const stat = await fs.stat(file)
                totalSize += stat.size
                totalBytes += stat.size
                if (stat.mtimeMs > lastModified) {
                    lastModified = stat.mtimeMs
                }
            } catch (error) {
                // Ignore missing file errors during scan
                console.debug(`[ProjectService] Failed to stat file ${file}:`, getErrorMessage(error as Error))
            }
        }

        return {
            fileCount,
            totalSize,
            loc: Math.round(totalBytes / 50), // Rough estimate: 50 bytes per line avg
            lastModified
        }
    }
}
