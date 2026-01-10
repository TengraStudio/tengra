import { promises as fs } from 'fs'
import path from 'path'
import { JsonObject } from '../../shared/types'
import { getErrorMessage } from '../../shared/utils/error.util'

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
                if (!filename) return
                // Simple debounce/filter could be added here
                if (filename.includes('node_modules') || filename.includes('.git')) return
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
        console.log('[ProjectService] Analyzing project at:', rootPath)
        const runStart = Date.now()

        const files = await this.scanFiles(rootPath)
        const type = await this.detectType(files)
        const { frameworks, dependencies, devDependencies } = await this.analyzeDependencies(rootPath, type)
        const stats = await this.calculateStats(files)
        const languages = this.calculateLanguages(files)
        const monorepo = await this.detectMonorepo(rootPath, files)

        console.log(`[ProjectService] Analysis complete in ${Date.now() - runStart}ms`)

        return {
            type,
            frameworks,
            dependencies,
            devDependencies,
            stats,
            languages,
            files: files.slice(0, 1000), // Limit file list for performance in IPC
            monorepo
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

            // Turbo
            if (fileNames.includes('turbo.json')) {
                return { type: 'turbo', packages: [] }
            }

        } catch (e) {
            console.warn('[ProjectService] Monorepo detection failed:', e)
        }
        return undefined
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
            if (!ext) continue

            const lang = commonExts[ext] || ext.toUpperCase()
            langMap[lang] = (langMap[lang] || 0) + 1
        }

        return langMap
    }

    private async scanFiles(dir: string, fileList: string[] = []): Promise<string[]> {
        // Simple recursive scan, respecting basic ignores
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                // Basic ignore list
                if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.orbit') continue

                if (entry.isDirectory()) {
                    await this.scanFiles(fullPath, fileList)
                } else {
                    fileList.push(fullPath)
                }
            }
        } catch (error) {
            console.warn(`[ProjectService] Failed to scan directory ${dir}:`, getErrorMessage(error as Error))
        }
        return fileList
    }

    private async detectType(files: string[]): Promise<ProjectAnalysis['type'] | string> {
        // Check for specific indicator files
        const fileNames = files.map(f => path.basename(f).toLowerCase())
        if (fileNames.includes('package.json')) return 'node'
        if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml') || fileNames.some(f => f.endsWith('.py'))) return 'python'
        if (fileNames.includes('cargo.toml')) return 'rust'
        if (fileNames.includes('go.mod')) return 'go'
        if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) return 'java'
        if (fileNames.includes('cmakeLists.txt') || fileNames.some(f => f.endsWith('.cpp') || f.endsWith('.cc'))) return 'cpp'
        if (fileNames.some(f => f.endsWith('.php'))) return 'php'
        if (fileNames.some(f => f.endsWith('.cs'))) return 'csharp'

        return 'unknown'
    }

    private async analyzeDependencies(rootPath: string, type: string): Promise<{ frameworks: string[], dependencies: Record<string, string>, devDependencies: Record<string, string> }> {
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
                if (depKeys.includes('react')) result.frameworks.push('React')
                if (depKeys.includes('next')) result.frameworks.push('Next.js')
                if (depKeys.includes('vue')) result.frameworks.push('Vue')
                if (depKeys.includes('svelte')) result.frameworks.push('Svelte')
                if (depKeys.includes('express')) result.frameworks.push('Express')
                if (depKeys.includes('electron')) result.frameworks.push('Electron')
                if (depKeys.includes('tailwindcss')) result.frameworks.push('TailwindCSS')
                if (depKeys.includes('typescript')) result.frameworks.push('TypeScript')
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
                    if (!trimmed || trimmed.startsWith('#')) continue

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
            if (allDeps.includes('django')) result.frameworks.push('Django')
            if (allDeps.includes('flask')) result.frameworks.push('Flask')
            if (allDeps.includes('fastapi')) result.frameworks.push('FastAPI')
            if (allDeps.includes('pytorch') || allDeps.includes('torch')) result.frameworks.push('PyTorch')
            if (allDeps.includes('tensorflow')) result.frameworks.push('TensorFlow')
            if (allDeps.includes('numpy')) result.frameworks.push('NumPy')
            if (allDeps.includes('pandas')) result.frameworks.push('Pandas')
            if (allDeps.includes('pytest')) result.frameworks.push('Pytest')

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
            if (allDeps.some(d => d.includes('gin-gonic'))) result.frameworks.push('Gin')
            if (allDeps.some(d => d.includes('echo'))) result.frameworks.push('Echo')
            if (allDeps.some(d => d.includes('fiber'))) result.frameworks.push('Fiber')
            if (allDeps.some(d => d.includes('gorilla/mux'))) result.frameworks.push('Gorilla Mux')
            if (allDeps.some(d => d.includes('gorm'))) result.frameworks.push('GORM')

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
                        if (!trimmed || trimmed.startsWith('#')) continue

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
                        if (!trimmed || trimmed.startsWith('#')) continue

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
            if (allDeps.includes('actix-web')) result.frameworks.push('Actix Web')
            if (allDeps.includes('axum')) result.frameworks.push('Axum')
            if (allDeps.includes('rocket')) result.frameworks.push('Rocket')
            if (allDeps.includes('tokio')) result.frameworks.push('Tokio')
            if (allDeps.includes('serde')) result.frameworks.push('Serde')
            if (allDeps.includes('diesel')) result.frameworks.push('Diesel')
            if (allDeps.includes('sqlx')) result.frameworks.push('SQLx')
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
