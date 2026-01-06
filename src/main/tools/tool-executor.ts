import { FileSystemService } from '../services/filesystem.service'
import { CommandService } from '../services/command.service'
import { ScreenshotService } from '../services/screenshot.service'
import { WebService } from '../services/web.service'
import { toolDefinitions } from './tool-definitions'
import { SystemService } from '../services/system.service'
import { NetworkService } from '../services/network.service'
import { NotificationService } from '../services/notification.service'
import { DockerService } from '../services/docker.service'
import { SSHService as SshService } from '../services/ssh.service'
import { ScannerService } from '../services/scanner.service'
import { EmbeddingService } from '../services/embedding.service'
import { UtilityService } from '../services/utility.service'
import { ContentService } from '../services/content.service'
import { FileManagementService as FileService } from '../services/file.service'
import { MonitoringService as MonitorService } from '../services/monitoring.service'
import { ClipboardService } from '../services/clipboard.service'
import { GitService } from '@main/services/git.service'
import { SecurityService } from '@main/services/security.service'
import { McpDispatcher } from '../mcp/dispatcher'
import { LLMService } from '../services/llm.service'

interface ToolResult {
    success: boolean
    result?: any
    error?: string
    files?: any[]
    results?: any[]
    content?: string
    stdout?: string
    stderr?: string
}

interface ToolExecutorOptions {
    fileSystem: FileSystemService,
    command: CommandService,
    web: WebService,
    screenshot: ScreenshotService,
    system: SystemService,
    network: NetworkService,
    notification: NotificationService,
    docker: DockerService,
    ssh: SshService,
    scanner: ScannerService,
    embedding: EmbeddingService,
    utility: UtilityService,
    content: ContentService,
    file: FileService,
    monitor: MonitorService,
    clipboard: ClipboardService,
    git: GitService,
    security: SecurityService,
    mcp: McpDispatcher,
    llm: LLMService
}

export class ToolExecutor {
    constructor(
        private options: ToolExecutorOptions,
    ) { }

    getToolDefinitions() {
        const nativeTools = toolDefinitions
        let mcpTools: any[] = []
        try {
            mcpTools = this.options.mcp.getToolDefinitions()
        } catch (e) {
            console.error('[ToolExecutor] Failed to get MCP tool definitions:', e)
        }
        return [...nativeTools, ...mcpTools]
    }

    async execute(toolName: string, args: any, toolCallId?: string): Promise<ToolResult> {
        try {
            const normalizedName = typeof toolName === 'string'
                ? toolName
                : String((toolName as any)?.name || '')

            if (!normalizedName) {
                return { success: false, error: 'Invalid tool name' }
            }

            switch (normalizedName) {
                // File System Tools
                case 'read_file':
                    return await this.options.fileSystem.readFile(args.path)

                case 'write_file':
                    return await this.options.fileSystem.writeFile(args.path, args.content)

                case 'list_directory':
                    return await this.options.fileSystem.listDirectory(args.path)

                case 'create_directory':
                    return await this.options.fileSystem.createDirectory(args.path)

                case 'delete_file':
                    return await this.options.fileSystem.deleteFile(args.path)

                case 'file_exists':
                    return { success: true, result: await this.options.fileSystem.fileExists(args.path) }

                case 'copy_file':
                    return await this.options.fileSystem.copyFile(args.source, args.destination)

                case 'move_file':
                    return await this.options.fileSystem.moveFile(args.source, args.destination)

                case 'get_file_info':
                    return await this.options.fileSystem.getFileInfo(args.path)

                // Command Tools
                case 'execute_command':
                    return await this.options.command.executeCommand(args.command, { cwd: args.cwd, id: toolCallId })

                case 'get_system_info':
                    const sysInfo = await this.options.command.getSystemInfo()
                    return { success: true, result: sysInfo }

                // Screenshot Tools
                case 'capture_screenshot':
                    return await this.options.screenshot.captureScreen()

                case 'capture_window':
                    return await this.options.screenshot.captureWindow(args.window_name)

                case 'list_windows':
                    return await this.options.screenshot.listWindows()

                // Web Tools
                case 'fetch_webpage':
                    return await this.options.web.fetchWebPage(args.url)

                case 'search_web':
                    return await this.options.web.searchWeb(args.query, parseInt(args.num_results) || 5)

                case 'fetch_json':
                    return await this.options.web.fetchJson(args.url)

                // AI Generation Tools
                case 'generate_image': {
                    const count = Math.min(Math.max(1, parseInt(args.count) || 1), 5)
                    const prompt = args.prompt
                    const imagePaths: string[] = []

                    try {
                        console.log(`[ToolExecutor:generate_image] Generating ${count} images for prompt: ${prompt}`)
                        // Run requests in parallel
                        const promises = Array(count).fill(0).map((_, i) => {
                            console.log(`[ToolExecutor:generate_image] Submitting image request ${i + 1}/${count}`)
                            return this.options.llm.chat(
                                [{ role: 'user', content: prompt }],
                                'gemini-3-pro-image',
                                [], // no tools
                                'antigravity' // force provider
                            )
                        })

                        const responses = await Promise.all(promises)

                        responses.forEach(resp => {
                            if (resp.images && Array.isArray(resp.images)) {
                                resp.images.forEach((img: any) => {
                                    if (typeof img === 'string') imagePaths.push(img);
                                    else if (img && typeof img === 'object' && (img as any).path) imagePaths.push((img as any).path);
                                    else if (img && typeof img === 'object' && (img as any).image_url?.url) imagePaths.push((img as any).image_url.url);
                                });
                            }
                        })

                        if (imagePaths.length === 0) {
                            return { success: false, error: 'Resim uretilemedi.' }
                        }

                        return {
                            success: true,
                            result: `${imagePaths.length} resim uretildi.`,
                            files: imagePaths.map(p => ({
                                name: p.split(/[/\\]/).pop(),
                                path: p,
                                isImage: true
                            }))
                        }

                    } catch (e: any) {
                        return { success: false, error: `Gorsel uretim hatasi: ${e.message}` }
                    }
                }

                default:
                    // Check for MCP tools (prefix: mcp__)
                    if (normalizedName.startsWith('mcp__')) {
                        const parts = normalizedName.split('__')
                        if (parts.length >= 3) {
                            const service = parts[1]
                            const action = parts.slice(2).join('__')
                            return await this.options.mcp.dispatch(service, action, args)
                        }
                    }
                    return { success: false, error: `Unknown tool: ${normalizedName}` }
            }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    }

    formatToolResult(toolName: string, result: ToolResult): string {
        if (!result.success) {
            return `Error: ${result.error}`
        }

        switch (toolName) {
            case 'list_directory':
                if (result.files) {
                    return result.files.map((f: any) =>
                        `${f.isDirectory ? '📁' : '📄'} ${f.name}${f.size ? ` (${this.formatSize(f.size)})` : ''}`
                    ).join('\n')
                }
                return JSON.stringify(result, null, 2)

            case 'capture_screenshot':
                return '[Screenshot captured]'

            case 'search_web':
                if (result.results) {
                    return result.results.map((r: any, i: number) =>
                        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
                    ).join('\n\n')
                }
                return JSON.stringify(result, null, 2)

            default:
                if (typeof result.result === 'string') {
                    return result.result
                }
                if (result.content) {
                    return result.content
                }
                if (result.stdout) {
                    return result.stdout + (result.stderr ? `\nStderr: ${result.stderr}` : '')
                }
                return JSON.stringify(result, null, 2)
        }
    }

    private formatSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB']
        let size = bytes
        let unitIndex = 0
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024
            unitIndex++
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`
    }
}
