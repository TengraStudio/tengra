import { promises as fs } from 'fs'
import * as path from 'path'

export class CodeIntelligenceService {

    // 2.4.41 Symbol Search (Regex)
    async findSymbols(rootPath: string, query: string): Promise<any[]> {
        const results: any[] = []
        // Basic symbol search: look for function/class/const definitions matching query
        await this.scanDirForSymbols(rootPath, query, results)
        return results
    }

    // 2.5.50 General Search Panel
    async searchFiles(rootPath: string, query: string, isRegex: boolean = false): Promise<any[]> {
        const results: any[] = []
        await this.scanDirForText(rootPath, query, isRegex, results)
        return results
    }

    // 2.4.42 TODO Scanner
    async scanTodos(rootPath: string): Promise<{ file: string, line: number, text: string }[]> {
        const todos: { file: string, line: number, text: string }[] = []
        // Recursively find TODOs
        await this.scanDirForTodos(rootPath, todos)
        return todos
    }

    // 2.4.47 Code Structure (Outline)
    async getFileDimensions(filePath: string): Promise<any[]> {
        try {
            const content = await fs.readFile(filePath, 'utf-8')
            const lines = content.split('\n')
            const outline: any[] = []

            // Simple regex parser for major languages (TS, JS, Py)
            const regex = /^(?:export\s+)?(?:async\s+)?(class|function|interface|type|const|let|var|def)\s+([a-zA-Z0-9_]+)/

            lines.forEach((line, index) => {
                const match = line.trim().match(regex)
                if (match) {
                    outline.push({
                        type: match[1],
                        name: match[2],
                        line: index + 1,
                        text: line.trim()
                    })
                }
            })
            return outline
        } catch { return [] }
    }

    // 2.5 Advanced Agent Tool: Find Usage
    async findUsage(rootPath: string, symbol: string): Promise<any[]> {
        const results: any[] = []
        // Reuse scanDirForText but with strict symbol boundaries if possible
        // effectively "grep -r '\bSymbol\b'"
        await this.scanDirForText(rootPath, `\\b${symbol}\\b`, true, results)
        return results
    }

    private async scanDirForTodos(dir: string, results: any[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue

                if (entry.isDirectory()) {
                    await this.scanDirForTodos(fullPath, results)
                } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.py'))) {
                    const content = await fs.readFile(fullPath, 'utf-8')
                    const lines = content.split('\n')
                    lines.forEach((line, index) => {
                        if (line.includes('// TODO') || line.includes('# TODO')) {
                            results.push({
                                file: fullPath,
                                line: index + 1,
                                text: line.trim()
                            })
                        }
                    })
                }
            }
        } catch { }
    }

    private async scanDirForSymbols(dir: string, query: string, results: any[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue

                if (entry.isDirectory()) {
                    await this.scanDirForSymbols(fullPath, query, results)
                } else if (entry.isFile() && /\.(ts|tsx|js|jsx|py)$/.test(entry.name)) {
                    const content = await fs.readFile(fullPath, 'utf-8')
                    const lines = content.split('\n')
                    // Simple regex for definitions
                    const symbolRegex = new RegExp(`(function|class|const|let|var|interface|type)\\s+(${query}\\w*)`, 'i')

                    lines.forEach((line, index) => {
                        const match = line.match(symbolRegex)
                        if (match) {
                            results.push({
                                file: fullPath,
                                line: index + 1,
                                text: line.trim(),
                                type: match[1],
                                name: match[2]
                            })
                        }
                    })
                }
            }
        } catch { }
    }

    private async scanDirForText(dir: string, query: string, isRegex: boolean, results: any[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue

                if (entry.isDirectory()) {
                    await this.scanDirForText(fullPath, query, isRegex, results)
                } else if (entry.isFile() && !/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp4|webm)$/i.test(entry.name)) {
                    const content = await fs.readFile(fullPath, 'utf-8')
                    const lines = content.split('\n')

                    lines.forEach((line, index) => {
                        let match = false
                        if (isRegex) {
                            try {
                                if (new RegExp(query).test(line)) match = true
                            } catch { }
                        } else {
                            if (line.includes(query)) match = true
                        }

                        if (match) {
                            // Limit result length
                            if (results.length < 1000) {
                                results.push({
                                    file: fullPath,
                                    line: index + 1,
                                    text: line.trim().substring(0, 200)
                                })
                            }
                        }
                    })
                }
            }
        } catch { }
    }
}
