import { ChildProcess, spawn } from 'child_process'
import { randomUUID } from 'crypto'

import { appLogger } from '@main/logging/logger'
import { McpDispatchResult, McpService } from '@main/mcp/types'
import { SettingsService } from '@main/services/system/settings.service'
import { ToolDefinition } from '@shared/types/chat'
import { CatchError, JsonObject } from '@shared/types/common'
import { MCPServerConfig } from '@shared/types/settings'
import { getErrorMessage } from '@shared/utils/error.util'
import { safeJsonParse } from '@shared/utils/sanitize.util'

type McpToolContent = {
    type?: string
    text?: string
}

type McpToolResult = {
    isError?: boolean
    content?: McpToolContent[]
}

type PendingRequest = {
    resolve: (val: McpToolResult) => void
    reject: (err: CatchError) => void
}

export class McpDispatcher {
    private activeServers = new Map<string, ChildProcess>()
    private requestQueue = new Map<string, PendingRequest>()
    private bufferMap = new Map<string, string>()

    constructor(
        private services: McpService[],
        private settingsService: SettingsService
    ) { }

    listServices() {
        const settings = this.settingsService.getSettings()
        const disabledServers = settings.mcpDisabledServers ?? []
        const userServers = settings.mcpUserServers ?? []

        const coreList = this.services.map(s => ({
            name: s.name,
            description: s.description,
            source: 'core' as const,
            isEnabled: !disabledServers.includes(s.name),
            actions: s.actions.map(a => ({ name: a.name, description: a.description }))
        }))

        const userList = userServers.map(s => ({
            name: s.name,
            description: s.description,
            source: 'user' as const,
            isEnabled: !disabledServers.includes(s.name),
            actions: s.tools ?? []
        }))

        return [...coreList, ...userList]
    }

    getToolDefinitions() {
        const settings = this.settingsService.getSettings()
        const disabledServers = settings.mcpDisabledServers ?? []

        const tools: ToolDefinition[] = []

        // Add tools from core services
        const enabledCoreServices = this.services.filter(s => !disabledServers.includes(s.name))
        for (const service of enabledCoreServices) {
            for (const action of service.actions) {
                const toolName = `mcp__${service.name}__${action.name}`
                tools.push({
                    type: 'function',
                    function: {
                        name: toolName,
                        description: `[MCP: ${service.name}] ${action.description}`,
                        parameters: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                })
            }
        }

        // Add tools from user-defined servers
        const userServers = settings.mcpUserServers ?? []
        const enabledUserServers = userServers.filter(s => !disabledServers.includes(s.name))
        for (const server of enabledUserServers) {
            const toolsList = server.tools ?? []
            for (const tool of toolsList) {
                const toolName = `mcp__${server.name}__${tool.name}`
                tools.push({
                    type: 'function',
                    function: {
                        name: toolName,
                        description: `[MCP: ${server.name}] ${tool.description}`,
                        // Since we don't have schemas for marketplace tools yet, we allow any args
                        parameters: {
                            type: 'object',
                            properties: {},
                            additionalProperties: true
                        }
                    }
                })
            }
        }

        return tools
    }

    installService(config: MCPServerConfig) {
        const settings = this.settingsService.getSettings()
        const userServers = [...(settings.mcpUserServers ?? [])]

        if (userServers.find(s => s.name === config.name)) {
            return { success: false, error: 'Server already exists' }
        }

        userServers.push({ ...config })
        this.settingsService.saveSettings({ mcpUserServers: userServers }).catch(e => appLogger.error('MCP', `Failed to save settings: ${e}`))
        return { success: true }
    }

    uninstallService(name: string) {
        this.killServer(name)
        const settings = this.settingsService.getSettings()
        const userServers = (settings.mcpUserServers ?? []).filter(s => s.name !== name)
        this.settingsService.saveSettings({ mcpUserServers: userServers }).catch(e => appLogger.error('MCP', `Failed to save settings: ${e}`))
        return { success: true }
    }

    toggleService(name: string, enabled: boolean) {
        if (!enabled) {
            this.killServer(name)
        }
        const settings = this.settingsService.getSettings()
        let disabledServers = [...(settings.mcpDisabledServers ?? [])]

        if (enabled) {
            disabledServers = disabledServers.filter(s => s !== name)
        } else {
            if (!disabledServers.includes(name)) {
                disabledServers.push(name)
            }
        }

        this.settingsService.saveSettings({ mcpDisabledServers: disabledServers }).catch(e => appLogger.error('MCP', `Failed to save settings: ${e}`))
        return { success: true, isEnabled: enabled }
    }

    async dispatch(serviceName: string, actionName: string, args: JsonObject): Promise<McpDispatchResult> {
        const disabledServers = this.settingsService.getSettings().mcpDisabledServers ?? []
        if (disabledServers.includes(serviceName)) {
            return { success: false, error: `Service ${serviceName} is currently disabled.` }
        }

        // Try Internal Service
        const service = this.services.find(s => s.name === serviceName)
        if (service) {
            const action = service.actions.find(a => a.name === actionName)
            if (!action) {
                return { success: false, error: `Unknown action: ${actionName}` }
            }
            try {
                const result = await action.handler(args)
                return { ...result, service: serviceName, action: actionName }
            } catch (error) {
                return { success: false, error: getErrorMessage(error as Error) }
            }
        }

        // Try External Service
        const settings = this.settingsService.getSettings()
        const userServer = (settings.mcpUserServers ?? []).find(s => s.name === serviceName)
        if (userServer) {
            return this.dispatchExternal(userServer, actionName, args)
        }

        return { success: false, error: `Unknown service: ${serviceName}` }
    }

    private async dispatchExternal(serverConfig: MCPServerConfig, toolName: string, args: JsonObject): Promise<McpDispatchResult> {
        try {
            const server = await this.getOrStartServer(serverConfig)
            const id = randomUUID()

            const request = {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                },
                id
            }

            return new Promise((resolve) => {
                // Set timeout
                const timeout = setTimeout(() => {
                    this.requestQueue.delete(id)
                    resolve({ success: false, error: 'MCP Request Timeout (30s)' })
                }, 30000)

                this.requestQueue.set(id, {
                    resolve: (result: McpToolResult) => {
                        clearTimeout(timeout)
                        if (result.isError) {
                            resolve({ success: false, error: result.content?.map((c) => c.text).join('\n') ?? 'Unknown tool error' })
                        } else {
                            // Extract content from MCP tool result
                            const text = result.content?.map((c) => c.text).join('\n')
                            resolve({ success: true, data: text ?? null, service: serverConfig.name, action: toolName })
                        }
                    },
                    reject: (err) => {
                        clearTimeout(timeout)
                        resolve({ success: false, error: getErrorMessage(err as Error) })
                    }
                })

                if (server.stdin) {
                    const payload = JSON.stringify(request) + '\n'
                    server.stdin.write(payload)
                } else {
                    resolve({ success: false, error: 'Server stdin not available' })
                }
            })

        } catch (error) {
            const message = getErrorMessage(error as Error)
            return { success: false, error: `Failed to execute: ${message}` }
        }
    }

    private async getOrStartServer(config: MCPServerConfig): Promise<ChildProcess> {
        if (this.activeServers.has(config.name)) {
            const process = this.activeServers.get(config.name)
            if (process && !process.killed) { return process }
        }

        appLogger.info('MCP', `Starting server: ${config.name} (${config.command})`)
        const args = config.args
        const env = { ...process.env, ...config.env } // Merge process env with config env
        const isWindows = process.platform === 'win32'
        let command = config.command

        // Resolve .cmd extension for Windows scripts if needed
        if (isWindows && !command.endsWith('.exe') && !command.endsWith('.cmd') && !command.endsWith('.bat')) {
            if (['npm', 'npx', 'pnpm', 'yarn'].includes(command)) {
                command = `${command}.cmd`
            }
        }

        const server = spawn(command, args, {
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
            env
        })

        server.stdout.setEncoding('utf8')
        server.stderr.setEncoding('utf8')

        server.stdout.on('data', (chunk) => this.handleServerOutput(config.name, chunk))
        server.stderr.on('data', (chunk) => appLogger.debug('MCP', `${config.name} ERR: ${chunk}`))

        server.on('error', (err) => {
            appLogger.error('MCP', `${config.name} Process error: ${getErrorMessage(err)}`)
            this.killServer(config.name)
        })

        server.on('exit', (code) => {
            appLogger.info('MCP', `${config.name} Exited with code ${code}`)
            this.activeServers.delete(config.name)
        })

        this.activeServers.set(config.name, server)
        return server
    }

    private handleServerOutput(serverName: string, chunk: string) {
        const buffer = (this.bufferMap.get(serverName) ?? '') + chunk
        const lines = buffer.split('\n')
        // Keep the last part if not complete line
        this.bufferMap.set(serverName, lines.pop() ?? '')

        for (const line of lines) {
            if (!line.trim()) { continue }
            const msg = safeJsonParse<JsonObject>(line, {})
            if (msg.jsonrpc === '2.0' && msg.id) {
                const msgId = typeof msg.id === 'string' ? msg.id : (typeof msg.id === 'number' ? String(msg.id) : '')
                if (!msgId) { continue }
                const handler = this.requestQueue.get(msgId)
                if (handler) {
                    this.requestQueue.delete(msgId)
                    if (msg.error && typeof msg.error === 'object') {
                        const message = typeof (msg.error as JsonObject).message === 'string'
                            ? (msg.error as JsonObject).message as string
                            : 'Unknown MCP error'
                        handler.reject(new Error(message))
                    } else {
                        handler.resolve((msg.result as McpToolResult | undefined) ?? {})
                    }
                }
            }
        }
    }

    private killServer(name: string) {
        const server = this.activeServers.get(name)
        if (server) {
            appLogger.info('MCP', `Killing server: ${name}`)
            server.stdout?.removeAllListeners()
            server.stderr?.removeAllListeners()
            server.kill()
            this.activeServers.delete(name)
        }
        this.bufferMap.delete(name)
    }
}
