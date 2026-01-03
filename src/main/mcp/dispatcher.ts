import { McpService, McpDispatchResult } from './types'
import { SettingsService } from '../services/settings.service'
import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'

export class McpDispatcher {
    private activeServers = new Map<string, ChildProcess>()
    private requestQueue = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>()
    private bufferMap = new Map<string, string>()

    constructor(
        private services: McpService[],
        private settingsService: SettingsService
    ) { }

    listServices() {
        const settings = this.settingsService.getSettings()
        const disabledServers = settings.mcpDisabledServers || []
        const userServers = settings.mcpUserServers || []

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
            actions: s.tools || []
        }))

        return [...coreList, ...userList]
    }

    getToolDefinitions() {
        const settings = this.settingsService.getSettings()
        const disabledServers = settings.mcpDisabledServers || []

        const tools: any[] = []

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
        const userServers = settings.mcpUserServers || []
        const enabledUserServers = userServers.filter(s => !disabledServers.includes(s.name))
        for (const server of enabledUserServers) {
            const toolsList = server.tools || []
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

    installService(config: { name: string, command: string, args: string[], description: string, tools?: { name: string, description: string }[] }) {
        const settings = this.settingsService.getSettings()
        const userServers = [...(settings.mcpUserServers || [])]

        if (userServers.find(s => s.name === config.name)) {
            return { success: false, error: 'Server already exists' }
        }

        userServers.push({ ...config })
        this.settingsService.saveSettings({ mcpUserServers: userServers })
        return { success: true }
    }

    uninstallService(name: string) {
        this.killServer(name)
        const settings = this.settingsService.getSettings()
        const userServers = (settings.mcpUserServers || []).filter(s => s.name !== name)
        this.settingsService.saveSettings({ mcpUserServers: userServers })
        return { success: true }
    }

    toggleService(name: string, enabled: boolean) {
        if (!enabled) {
            this.killServer(name)
        }
        const settings = this.settingsService.getSettings()
        let disabledServers = [...(settings.mcpDisabledServers || [])]

        if (enabled) {
            disabledServers = disabledServers.filter(s => s !== name)
        } else {
            if (!disabledServers.includes(name)) {
                disabledServers.push(name)
            }
        }

        this.settingsService.saveSettings({ mcpDisabledServers: disabledServers })
        return { success: true, isEnabled: enabled }
    }

    async dispatch(serviceName: string, actionName: string, args: any): Promise<McpDispatchResult> {
        const disabledServers = this.settingsService.getSettings().mcpDisabledServers || []
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
            } catch (error: any) {
                return { success: false, error: error.message }
            }
        }

        // Try External Service
        const settings = this.settingsService.getSettings()
        const userServer = (settings.mcpUserServers || []).find(s => s.name === serviceName)
        if (userServer) {
            return this.dispatchExternal(userServer, actionName, args)
        }

        return { success: false, error: `Unknown service: ${serviceName}` }
    }

    private async dispatchExternal(serverConfig: any, toolName: string, args: any): Promise<McpDispatchResult> {
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
                    resolve: (result: any) => {
                        clearTimeout(timeout)
                        if (result.isError) {
                            resolve({ success: false, error: result.content?.map((c: any) => c.text).join('\n') || 'Unknown tool error' })
                        } else {
                            // Extract content from MCP tool result
                            const text = result.content?.map((c: any) => c.text).join('\n')
                            resolve({ success: true, data: text, service: serverConfig.name, action: toolName })
                        }
                    },
                    reject: (err: any) => {
                        clearTimeout(timeout)
                        resolve({ success: false, error: err.message || String(err) })
                    }
                })

                if (server.stdin) {
                    const payload = JSON.stringify(request) + '\n'
                    server.stdin.write(payload)
                } else {
                    resolve({ success: false, error: 'Server stdin not available' })
                }
            })

        } catch (error: any) {
            return { success: false, error: `Failed to execute: ${error.message}` }
        }
    }

    private async getOrStartServer(config: any): Promise<ChildProcess> {
        if (this.activeServers.has(config.name)) {
            const process = this.activeServers.get(config.name)
            if (process && !process.killed) return process
        }

        console.log(`[MCP] Starting server: ${config.name} (${config.command})`)
        const args = config.args || []
        const env = { ...process.env, ...config.env } // Merge process env with config env
        // Use shell: true for npx on windows compatibility
        const server = spawn(config.command, args, {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env
        })

        server.stdout?.setEncoding('utf8')
        server.stderr?.setEncoding('utf8')

        server.stdout?.on('data', (chunk) => this.handleServerOutput(config.name, chunk))
        server.stderr?.on('data', (chunk) => console.log(`[MCP:${config.name}] ERR:`, chunk))

        server.on('error', (err) => {
            console.error(`[MCP:${config.name}] Process error:`, err)
            this.killServer(config.name)
        })

        server.on('exit', (code) => {
            console.log(`[MCP:${config.name}] Exited with code ${code}`)
            this.activeServers.delete(config.name)
        })

        // Wait for server to potentially emit initialization messages?
        // Basic MCP servers might not need init handshake for simple tool calls,
        // but robust implementation would do 'initialize'.
        // For now we assume ready-to-use stdio.

        this.activeServers.set(config.name, server)
        return server
    }

    private handleServerOutput(serverName: string, chunk: string) {
        let buffer = (this.bufferMap.get(serverName) || '') + chunk
        const lines = buffer.split('\n')
        // Keep the last part if not complete line
        this.bufferMap.set(serverName, lines.pop() || '')

        for (const line of lines) {
            if (!line.trim()) continue
            try {
                const msg = JSON.parse(line)
                if (msg.jsonrpc === '2.0' && msg.id) {
                    const handler = this.requestQueue.get(msg.id)
                    if (handler) {
                        this.requestQueue.delete(msg.id)
                        if (msg.error) {
                            handler.reject(new Error(msg.error.message))
                        } else {
                            handler.resolve(msg.result)
                        }
                    }
                } else {
                    // console.log(`[MCP:${serverName}] Log:`, line)
                }
            } catch (e) {
                // Not JSON, maybe raw output
                // console.log(`[MCP:${serverName}] Raw:`, line)
            }
        }
    }

    private killServer(name: string) {
        const server = this.activeServers.get(name)
        if (server) {
            console.log(`[MCP] Killing server: ${name}`)
            server.stdout?.removeAllListeners()
            server.stderr?.removeAllListeners()
            server.kill()
            this.activeServers.delete(name)
        }
        this.bufferMap.delete(name)
    }
}
