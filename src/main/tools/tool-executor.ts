import { FileSystemService } from '../services/filesystem.service'
import { CommandService } from '../services/command.service'
import { ScreenshotService } from '../services/screenshot.service'
import { WebService } from '../services/web.service'
import { toolDefinitions } from './tool-definitions'

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

export class ToolExecutor {
    constructor(
        private fileSystem: FileSystemService,
        private command: CommandService,
        private screenshot: ScreenshotService,
        private web: WebService
    ) { }

    getToolDefinitions() {
        return toolDefinitions
    }

    async execute(toolName: string, args: any): Promise<ToolResult> {
        try {
            switch (toolName) {
                // File System Tools
                case 'read_file':
                    return await this.fileSystem.readFile(args.path)

                case 'write_file':
                    return await this.fileSystem.writeFile(args.path, args.content)

                case 'list_directory':
                    return await this.fileSystem.listDirectory(args.path)

                case 'create_directory':
                    return await this.fileSystem.createDirectory(args.path)

                case 'delete_file':
                    return await this.fileSystem.deleteFile(args.path)

                case 'file_exists':
                    return { success: true, result: await this.fileSystem.fileExists(args.path) }

                case 'copy_file':
                    return await this.fileSystem.copyFile(args.source, args.destination)

                case 'move_file':
                    return await this.fileSystem.moveFile(args.source, args.destination)

                case 'get_file_info':
                    return await this.fileSystem.getFileInfo(args.path)

                // Command Tools
                case 'execute_command':
                    return await this.command.executeCommand(args.command, { cwd: args.cwd })

                case 'get_system_info':
                    const sysInfo = await this.command.getSystemInfo()
                    return { success: true, result: sysInfo }

                // Screenshot Tools
                case 'capture_screenshot':
                    return await this.screenshot.captureScreen()

                case 'capture_window':
                    return await this.screenshot.captureWindow(args.window_name)

                case 'list_windows':
                    return await this.screenshot.listWindows()

                // Web Tools
                case 'fetch_webpage':
                    return await this.web.fetchWebPage(args.url)

                case 'search_web':
                    return await this.web.searchWeb(args.query, parseInt(args.num_results) || 5)

                case 'fetch_json':
                    return await this.web.fetchJson(args.url)

                default:
                    return { success: false, error: `Unknown tool: ${toolName}` }
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
