import { appLogger } from '../logging/logger'
import { FileSystemService } from '../services/data/filesystem.service'
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
import { EmbeddingService } from '../services/llm/embedding.service'
import { UtilityService } from '../services/utility.service'
import { ContentService } from '../services/content.service'
import { FileManagementService as FileService } from '../services/data/file.service'
import { MonitoringService as MonitorService } from '../services/monitoring.service'
import { ClipboardService } from '../services/clipboard.service'
import { GitService } from '../services/git.service'
import { SecurityService } from '../services/security.service'
import { McpDispatcher } from '../mcp/dispatcher'
import { LLMService } from '../services/llm/llm.service'
import { MemoryService } from '../services/memory.service'
import { PageSpeedService } from '../services/pagespeed.service'
import { JsonObject, JsonValue } from '../../shared/types'
import type { ToolDefinition } from '../../shared/types/chat'

interface ToolResult {
    success: boolean
    result?: JsonValue
    error?: string
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
    llm: LLMService,
    memory: MemoryService,
    pageSpeed: PageSpeedService
}

export class ToolExecutor {
    constructor(
        private options: ToolExecutorOptions,
    ) { }

    getToolDefinitions(): ToolDefinition[] {
        const nativeTools = toolDefinitions as ToolDefinition[]
        let mcpTools: ToolDefinition[] = []
        try {
            mcpTools = this.options.mcp.getToolDefinitions()
        } catch (e) {
            appLogger.error('ToolExecutor', `Failed to get MCP tool definitions: ${e}`)
        }
        return [...nativeTools, ...mcpTools, this.options.pageSpeed.getToolDefinition() as ToolDefinition]
    }

    private asString(value: JsonValue | undefined): string {
        return typeof value === 'string' ? value : ''
    }

    private toText(value: JsonValue | undefined): string {
        if (typeof value === 'string') return value
        if (typeof value === 'number' || typeof value === 'boolean') return String(value)
        if (value === null || value === undefined) return ''
        try {
            return JSON.stringify(value)
        } catch {
            return ''
        }
    }

    async execute(toolName: string | JsonObject, args: JsonObject): Promise<ToolResult> {
        try {
            const normalizedName = typeof toolName === 'string'
                ? toolName
                : (typeof toolName.name === 'string' ? toolName.name : '')

            if (!normalizedName) {
                return { success: false, error: 'Invalid tool name' }
            }

            const getString = (v: JsonValue | undefined) => this.asString(v)

            switch (normalizedName) {
                case 'read_file': {
                    const res = await this.options.fileSystem.readFile(getString(args.path))
                    return { success: res.success, result: res.data, error: res.error }
                }

                case 'write_file': {
                    const res = await this.options.fileSystem.writeFile(getString(args.path), this.toText(args.content))
                    return { success: res.success, error: res.error }
                }

                case 'list_directory': {
                    const res = await this.options.fileSystem.listDirectory(getString(args.path))
                    return { success: res.success, result: res.data as JsonValue, error: res.error }
                }

                case 'create_directory': {
                    const res = await this.options.fileSystem.createDirectory(getString(args.path))
                    return { success: res.success, error: res.error }
                }

                case 'delete_file': {
                    const res = await this.options.fileSystem.deleteFile(getString(args.path))
                    return { success: res.success, error: res.error }
                }

                case 'file_exists': {
                    const res = await this.options.fileSystem.fileExists(getString(args.path))
                    return { success: true, result: res.exists }
                }

                case 'execute_command': {
                    const res = await this.options.command.executeCommand(getString(args.command), { cwd: getString(args.cwd) })
                    return { success: res.success, result: res.stdout, error: res.error || res.stderr }
                }

                case 'fetch_webpage': {
                    const res = await this.options.web.fetchWebPage(getString(args.url))
                    return { success: res.success, result: res.content, error: res.error }
                }

                case 'search_web': {
                    const res = await this.options.web.searchWeb(getString(args.query))
                    return { success: res.success, result: res.results as JsonValue, error: res.error }
                }

                case 'capture_screenshot': {
                    const res = await this.options.screenshot.captureScreen()
                    return { success: res.success, result: res.image, error: res.error }
                }

                case 'remember': {
                    const fact = getString(args.fact)
                    const tags = Array.isArray(args.tags) ? args.tags.map(t => String(t)) : []
                    const res = await this.options.memory.rememberFact(fact, 'user', 'global', tags)
                    return { success: true, result: res as JsonValue }
                }

                case 'recall': {
                    const res = await this.options.memory.recallRelevantFacts(getString(args.query))
                    return { success: true, result: res as JsonValue }
                }

                case 'forget': {
                    const success = await this.options.memory.forgetFact(getString(args.fact_id))
                    return { success }
                }

                default:
                    // Try MCP tools if native tool not found
                    if (normalizedName.startsWith('mcp__')) {
                        const parts = normalizedName.split('__')
                        if (parts.length >= 3) {
                            const serviceName = parts[1]
                            const actionName = parts.slice(2).join('__')
                            const mcpResult = await this.options.mcp.dispatch(serviceName, actionName, args)
                            return { success: mcpResult.success, result: mcpResult.data as JsonValue, error: mcpResult.error }
                        }
                    }
                    return { success: false, error: `Unknown tool: ${normalizedName}` }
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }
}
