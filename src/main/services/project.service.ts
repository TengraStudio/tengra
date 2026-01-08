import { promises as fs } from 'fs'
import path from 'path'

export interface ProjectStats {
    fileCount: number
    totalSize: number
    loc: number // approximate
    lastModified: number
}

export interface ProjectAnalysis {
    type: 'node' | 'python' | 'rust' | 'go' | 'unknown'
    frameworks: string[]
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
    stats: ProjectStats
    languages: Record<string, number>
    files: string[]
}

export class ProjectService {
    constructor() { }

    async analyzeProject(rootPath: string): Promise<ProjectAnalysis> {
        console.log('[ProjectService] Analyzing project at:', rootPath)
        const runStart = Date.now()

        const files = await this.scanFiles(rootPath)
        const type = await this.detectType(files)
        const { frameworks, dependencies, devDependencies } = await this.analyzeDependencies(rootPath, type)
        const stats = await this.calculateStats(files)
        const languages = this.calculateLanguages(files)

        console.log(`[ProjectService] Analysis complete in ${Date.now() - runStart}ms`)

        return {
            type,
            frameworks,
            dependencies,
            devDependencies,
            stats,
            languages,
            files: files.slice(0, 1000) // Limit file list for performance in IPC
        }
    }

    async analyzeDirectory(dirPath: string): Promise<{
        hasPackageJson: boolean
        pkg: any
        readme: string | null
        stats: ProjectStats
    }> {
        // 1. Check for package.json
        let hasPackageJson = false
        let pkg = {}
        try {
            const pkgPath = path.join(dirPath, 'package.json')
            const content = await fs.readFile(pkgPath, 'utf-8')
            pkg = JSON.parse(content)
            hasPackageJson = true
        } catch { }

        // 2. Check for README.md
        let readme: string | null = null
        try {
            const readmePath = path.join(dirPath, 'README.md')
            readme = await fs.readFile(readmePath, 'utf-8')
        } catch { }

        // 3. Stats for this folder (non-recursive deep scan for speed, or shallow?)
        // Let's do a quick scan of just this directory + 1 level deep?
        // For now, reusing scanFiles but might be too heavy for deep folders.
        // We will just do a shallow scan for file count in this dir
        let files: string[] = []
        try {
            const entries = await fs.readdir(dirPath)
            files = entries.map(e => path.join(dirPath, e))
        } catch { }

        const stats = await this.calculateStats(files)

        return { hasPackageJson, pkg, readme, stats }
    }

    private calculateLanguages(files: string[]): Record<string, number> {
        const langMap: Record<string, number> = {}
        const commonExts: Record<string, string> = {
            'js': 'JavaScript',
            'ts': 'TypeScript',
            'tsx': 'React (TS)',
            'jsx': 'React (JS)',
            'py': 'Python',
            'go': 'Go',
            'rs': 'Rust',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'md': 'Markdown',
            'yaml': 'YAML',
            'yml': 'YAML'
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
            console.warn(`[ProjectService] Failed to scan directory ${dir}:`, error)
        }
        return fileList
    }

    private async detectType(files: string[]): Promise<ProjectAnalysis['type']> {
        // Check for specific indicator files
        const fileNames = files.map(f => path.basename(f).toLowerCase())
        if (fileNames.includes('package.json')) return 'node'
        if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml') || fileNames.some(f => f.endsWith('.py'))) return 'python'
        if (fileNames.includes('cargo.toml')) return 'rust'
        if (fileNames.includes('go.mod')) return 'go'

        return 'unknown'
    }

    private async analyzeDependencies(rootPath: string, type: string): Promise<{ frameworks: string[], dependencies: Record<string, string>, devDependencies: Record<string, string> }> {
        const result = {
            frameworks: [] as string[],
            dependencies: {},
            devDependencies: {}
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
                console.warn('[ProjectService] Failed to parse package.json:', error)
            }
        } else if (type === 'python') {
            // Basic python requirement parsing could go here
            // For now, we'll just check file extensions in the next iteration or use a simpler check
            // TODO: Implement requirements.txt parsing
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
            } catch {
                // Ignore missing file errors during scan
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
