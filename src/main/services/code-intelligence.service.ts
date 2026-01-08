import { promises as fs } from 'fs'
import * as path from 'path'

import { DatabaseService } from './database.service'
import { EmbeddingService } from './embedding.service'

export class CodeIntelligenceService {

    constructor(
        private db: DatabaseService,
        private embedding: EmbeddingService
    ) { }

    // Indexing
    async queryIndexedSymbols(query: string): Promise<any[]> {
        const vector = await this.embedding.generateEmbedding(query)
        return this.db.searchCodeSymbols(vector)
    }

    async indexProject(rootPath: string, projectId: string): Promise<void> {
        console.log(`[CodeIntelligence] Indexing project ${projectId} at ${rootPath}`)
        const { BrowserWindow } = require('electron')

        const sendProgress = (current: number, total: number, status: string) => {
            const windows = BrowserWindow.getAllWindows()
            windows.forEach((win: any) => {
                win.webContents.send('code:indexing-progress', { projectId, current, total, status })
            })
        }

        try {
            sendProgress(0, 0, 'Scanning...')
            await this.db.clearCodeSymbols(projectId)

            const results: any[] = []
            await this.scanDirForIndexing(rootPath, results)

            const total = results.length
            console.log(`[CodeIntelligence] Found ${total} symbols. Generating embeddings...`)

            for (let i = 0; i < total; i++) {
                const sym = results[i]
                if (i % 5 === 0) {
                    sendProgress(i + 1, total, `Indexing ${sym.name}...`)
                }

                // Generate embedding for "Function name(args) - docstring"
                const text = `${sym.kind} ${sym.name} ${sym.signature}\n${sym.docstring}`
                const vector = await this.embedding.generateEmbedding(text)

                await this.db.storeCodeSymbol({
                    id: Math.random().toString(36).substring(7),
                    project_path: projectId,
                    file_path: sym.file,
                    name: sym.name,
                    kind: sym.kind,
                    line: sym.line,
                    signature: sym.signature,
                    docstring: sym.docstring,
                    vector
                })
            }
            sendProgress(total, total, 'Complete')
            console.log(`[CodeIntelligence] Indexing complete for ${projectId}`)
        } catch (error) {
            console.error('[CodeIntelligence] Indexing failed:', error)
            sendProgress(0, 0, 'Failed')
        }
    }

    private async scanDirForIndexing(dir: string, results: any[]) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)
                // Skip hidden, node_modules, build/dist
                if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'out', 'coverage'].includes(entry.name)) continue

                if (entry.isDirectory()) {
                    await this.scanDirForIndexing(fullPath, results)
                } else if (entry.isFile() && /\.(ts|tsx|js|jsx|py|go|java|c|cpp)$/.test(entry.name)) {
                    await this.parseFileSymbols(fullPath, results)
                }
            }
        } catch { }
    }

    private async parseFileSymbols(filePath: string, results: any[]) {
        try {
            const content = await fs.readFile(filePath, 'utf-8')
            const lines = content.split('\n')

            // Regex for various languages (Simplified AST)
            // TS/JS: function foo(args) | class Foo | interface Foo | const foo = (...) =>
            // Py: def foo(args): | class Foo:

            const ext = path.extname(filePath)
            let regexes: { kind: string, regex: RegExp }[] = []

            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                regexes = [
                    { kind: 'function', regex: /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/ },
                    { kind: 'class', regex: /(?:export\s+)?class\s+([a-zA-Z0-9_]+)/ },
                    { kind: 'interface', regex: /(?:export\s+)?interface\s+([a-zA-Z0-9_]+)/ },
                    { kind: 'type', regex: /(?:export\s+)?type\s+([a-zA-Z0-9_]+)\s*=/ },
                    { kind: 'variable', regex: /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=/ }
                ]
            } else if (ext === '.py') {
                regexes = [
                    { kind: 'function', regex: /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/ },
                    { kind: 'class', regex: /class\s+([a-zA-Z0-9_]+)/ }
                ]
            } else if (ext === '.go') {
                regexes = [
                    { kind: 'function', regex: /func\s+([a-zA-Z0-9_]+)\s*\(/ },
                    { kind: 'type', regex: /type\s+([a-zA-Z0-9_]+)\s+struct/ }
                ]
            }

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()
                for (const { kind, regex } of regexes) {
                    const match = line.match(regex)
                    if (match) {
                        const name = match[1]
                        const signature = match[0] // approximation

                        // Extract docstring (look back)
                        let docstring = ''
                        if (i > 0 && (lines[i - 1].trim().startsWith('//') || lines[i - 1].trim().startsWith('#') || lines[i - 1].trim().endsWith('*/'))) {
                            // Simple 1-line lookback for now, recursion too complex for regex parser
                            const prev = lines[i - 1].trim()
                            docstring = prev.replace(/^\/\/\s*/, '').replace(/^#\s*/, '').replace(/\*\/$/, '').replace(/^\/\*\*\s*/, '')
                        }

                        results.push({
                            file: filePath,
                            line: i + 1,
                            name,
                            kind,
                            signature,
                            docstring
                        })
                    }
                }
            }

        } catch { }
    }

    // 2.4.41 Symbol Search (Regex) - Legacy/Quick
    async findSymbols(rootPath: string, query: string): Promise<any[]> {
        const results: any[] = []
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
        await this.scanDirForTodos(rootPath, todos)
        return todos
    }

    // 2.4.47 Code Structure (Outline)
    async getFileDimensions(filePath: string): Promise<any[]> {
        // Reuse parseFileSymbols logic but just return specific format?
        // For now keep legacy implementation to avoid breakages in outline view
        // or better: call parseFileSymbols and map it
        const results: any[] = []
        await this.parseFileSymbols(filePath, results)
        return results.map(r => ({
            type: r.kind,
            name: r.name,
            line: r.line,
            text: r.signature
        }))
    }

    // 2.5 Advanced Agent Tool: Find Usage
    async findUsage(rootPath: string, symbol: string): Promise<any[]> {
        const results: any[] = []
        await this.scanDirForText(rootPath, `\\b${symbol}\\b`, true, results)
        return results
    }

    // ... Keep private scan methods for legacy support if needed, or remove duplication
    // To minimize complexity, I will keep scanDirForTodos/Symbols/Text as they are specialized
    // for their specific tasks (Search Panel vs Outline).

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
