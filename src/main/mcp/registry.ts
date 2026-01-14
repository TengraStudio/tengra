import { OllamaService } from '../services/llm/ollama.service'
import { ContentService } from '../services/content.service'
import { CommandService } from '../services/system/command.service'
import { ClipboardService } from '../services/clipboard.service'
import { DockerService } from '../services/project/docker.service'
import { DatabaseService } from '../services/data/database.service'
import { EmbeddingService } from '../services/llm/embedding.service'
import { FileManagementService } from '../services/data/file.service'
import { FileSystemService } from '../services/data/filesystem.service'
import { GitService } from '../services/project/git.service'
import { MonitoringService } from '../services/monitoring.service'
import { NetworkService } from '../services/network.service'
import { NotificationService } from '../services/notification.service'
import { ScannerService } from '../services/scanner.service'
import { ScreenshotService } from '../services/screenshot.service'
import { SecurityService } from '../services/security.service'
import { SettingsService } from '../services/settings.service'
import { SSHService, SSHConnection } from '../services/ssh.service'
import { SystemService } from '../services/system.service'
import { UtilityService } from '../services/utility.service'
import { WebService } from '../services/web.service'
import { McpAction, McpService, McpResult } from './types'
import { promises as dns } from 'dns'
import { JsonObject, JsonValue } from '../../shared/types/common'
import { getErrorMessage } from '../../shared/utils/error.util'
import { ServiceResponse } from '../../shared/types'

interface McpDeps {
    web: WebService
    utility: UtilityService
    system: SystemService
    ssh: SSHService
    screenshot: ScreenshotService
    scanner: ScannerService
    notification: NotificationService
    network: NetworkService
    monitoring: MonitoringService
    git: GitService
    security: SecurityService
    settings: SettingsService
    filesystem: FileSystemService
    file: FileManagementService
    embedding: EmbeddingService
    docker: DockerService
    database: DatabaseService
    content: ContentService
    command: CommandService
    clipboard: ClipboardService
    ollama: OllamaService
}

type McpHandlerResult = JsonValue | ServiceResponse<JsonValue | void> | void | unknown

function wrap(handler: (args: JsonObject) => McpHandlerResult | Promise<McpHandlerResult>): (args: JsonObject) => Promise<McpResult> {
    return async (args: JsonObject) => {
        try {
            const rawResult = await Promise.resolve(handler(args))
            if (rawResult && typeof rawResult === 'object' && 'success' in rawResult) {
                const res = rawResult as ServiceResponse<unknown>
                if (res.success === false) {
                    return { success: false, error: (res.error || res.message) || 'Unknown error' }
                }
                const data = (res.data ?? res.result ?? res.content ?? res) ?? null
                return { success: true, data: data as JsonValue }
            }
            return { success: true, data: (rawResult ?? null) as JsonValue }
        } catch (error) {
            return { success: false, error: getErrorMessage(error) }
        }
    }
}

const buildActions = (actions: Array<Omit<McpAction, 'handler'> & { handler: (args: JsonObject) => McpHandlerResult | Promise<McpHandlerResult> }>): McpAction[] =>
    actions.map(a => ({ ...a, handler: wrap(a.handler) }))

const normalizeTarget = (target: string): string => {
    const trimmed = String(target || '').trim()
    if (!trimmed) return ''
    try {
        const url = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`)
        return url.hostname
    } catch {
        return trimmed
    }
}

const ensureAllowedTarget = (deps: McpDeps, target: string) => {
    const allowed = deps.settings.getSettings().mcpSecurityAllowedHosts || []
    const normalized = normalizeTarget(target)
    if (!normalized) {
        throw new Error('Target is required')
    }
    if (!allowed.includes(normalized)) {
        throw new Error(`Target not allowlisted: ${normalized}`)
    }
    return normalized
}

export function buildMcpServices(deps: McpDeps): McpService[] {
    return [
        {
            name: 'filesystem',
            description: 'File system access with allowed-root guardrails',
            actions: buildActions([
                { name: 'read', description: 'Read a UTF-8 file', handler: ({ path }) => deps.filesystem.readFile(path as string) },
                { name: 'write', description: 'Write text to file', handler: ({ path, content }) => deps.filesystem.writeFile(path as string, content as string) },
                { name: 'list', description: 'List directory entries', handler: ({ path }) => deps.filesystem.listDirectory(path as string) }
            ])
        },
        {
            name: 'file',
            description: 'File management helpers (zip, download, rename)',
            actions: buildActions([
                { name: 'extractStrings', description: 'Extract printable strings', handler: ({ path, minLength }) => deps.file.extractStrings(path as string, minLength as number) },
                { name: 'unzip', description: 'Unzip archive', handler: ({ zipPath, destPath }) => deps.file.unzip(zipPath as string, destPath as string) },
                { name: 'download', description: 'Download a file over HTTPS', handler: ({ url, destPath }) => deps.file.downloadFile(url as string, destPath as string) }
            ])
        },
        {
            name: 'command',
            description: 'Local shell execution with safety checks',
            actions: buildActions([
                { name: 'run', description: 'Execute a shell command', handler: ({ command, cwd }) => deps.command.executeCommand(command as string, { cwd: cwd as string }) },
                { name: 'kill', description: 'Kill a tracked command', handler: ({ id }) => Promise.resolve({ success: deps.command.killCommand(id as string) }) }
            ])
        },
        {
            name: 'web',
            description: 'HTTP utilities',
            actions: buildActions([
                { name: 'fetch', description: 'Fetch web page HTML/text', handler: ({ url }) => deps.web.fetchWebPage(url as string) },
                { name: 'search', description: 'Search the web', handler: ({ query, numResults }) => deps.web.searchWeb(query as string, numResults as number) }
            ])
        },
        {
            name: 'utility',
            description: 'Utility helpers',
            actions: buildActions([
                { name: 'exchangeRate', description: 'Get FX rate', handler: ({ from, to }) => deps.utility.getExchangeRate(from as string, to as string) },
                { name: 'storeMemory', description: 'Store memory key/value', handler: ({ key, value }) => deps.utility.storeMemory(key as string, value as string) },
                { name: 'recallMemory', description: 'Recall memory by key', handler: ({ key }) => deps.utility.recallMemory(key as string) }
            ])
        },
        {
            name: 'system',
            description: 'Local system info',
            actions: buildActions([
                { name: 'diskSpace', description: 'Get disk space info', handler: () => deps.system.getDiskSpace() },
                { name: 'processOnPort', description: 'Find process on port', handler: ({ port }) => deps.system.getProcessOnPort(Number(port)) }
            ])
        },
        {
            name: 'ssh',
            description: 'SSH connections and remote commands',
            actions: buildActions([
                { name: 'connect', description: 'Open SSH connection', handler: (args) => deps.ssh.connect(args as SSHConnection) },
                { name: 'execute', description: 'Run remote command', handler: ({ connectionId, command, cwd }) => deps.ssh.executeCommand(connectionId as string, command as string, { cwd: cwd as string }) },
                { name: 'disconnect', description: 'Close SSH connection', handler: ({ connectionId }) => deps.ssh.disconnect(connectionId as string).then(() => ({ success: true })) }
            ])
        },
        {
            name: 'screenshot',
            description: 'Screen capture utilities',
            actions: buildActions([
                { name: 'capture', description: 'Capture primary screen', handler: () => deps.screenshot.captureScreen() },
                { name: 'listWindows', description: 'List windows', handler: () => deps.screenshot.listWindows() }
            ])
        },
        {
            name: 'scanner',
            description: 'Project scanning',
            actions: buildActions([
                { name: 'scanDirectory', description: 'Scan directory for code files', handler: ({ path }) => deps.scanner.scanDirectory(path as string) }
            ])
        },
        {
            name: 'notification',
            description: 'System notifications',
            actions: buildActions([
                { name: 'notify', description: 'Send notification', handler: ({ title, body, silent }) => deps.notification.showNotification(title as string, body as string, silent as boolean) }
            ])
        },
        {
            name: 'network',
            description: 'Network utilities',
            actions: buildActions([
                { name: 'ping', description: 'Ping host', handler: ({ host }) => deps.network.ping(host as string) },
                { name: 'traceroute', description: 'Run traceroute', handler: ({ host }) => deps.network.traceroute(host as string) },
                { name: 'whois', description: 'WHOIS lookup', handler: ({ domain }) => deps.network.whois(domain as string) }
            ])
        },
        {
            name: 'monitoring',
            description: 'System monitoring',
            actions: buildActions([
                { name: 'usage', description: 'Get CPU/memory usage', handler: () => deps.monitoring.getUsage() }
            ])
        },
        {
            name: 'git',
            description: 'Git helpers',
            actions: buildActions([
                { name: 'status', description: 'Get git status', handler: ({ repoPath }) => deps.git.getStatus(repoPath as string) },
                { name: 'log', description: 'Get git log', handler: ({ repoPath, limit }) => deps.git.getLog(repoPath as string, limit as number) }
            ])
        },
        {
            name: 'security',
            description: 'Security helpers',
            actions: buildActions([
                { name: 'generatePassword', description: 'Generate a password', handler: ({ length, numbers, symbols }) => Promise.resolve(deps.security.generatePassword(length as number, numbers as boolean, symbols as boolean)) },
                { name: 'checkPasswordStrength', description: 'Check password strength', handler: ({ password }) => Promise.resolve(deps.security.checkPasswordStrength(password as string)) },
                { name: 'generateHash', description: 'Generate hash', handler: ({ text, algorithm }) => Promise.resolve(deps.security.generateHash(text as string, algorithm as 'md5' | 'sha256' | 'sha512')) },
                { name: 'stripMetadata', description: 'Strip file metadata', handler: ({ path, outputPath }) => deps.security.stripMetadata(path as string, outputPath as string) }
            ])
        },
        {
            name: 'security-audit',
            description: 'Defensive security and network checks (allowlist enforced)',
            actions: buildActions([
                {
                    name: 'dnsLookup',
                    description: 'Resolve DNS A/AAAA records',
                    handler: (async (args: JsonObject) => {
                        const target = args.target as string
                        const hostname = ensureAllowedTarget(deps, target)
                        const records = await dns.lookup(hostname, { all: true })
                        return { hostname, records: records.map(r => ({ address: r.address, family: r.family })) }
                    })
                },
                {
                    name: 'mxLookup',
                    description: 'Resolve DNS MX records',
                    handler: (async (args: JsonObject) => {
                        const target = args.target as string
                        const hostname = ensureAllowedTarget(deps, target)
                        const records = await dns.resolveMx(hostname)
                        return { hostname, records: records.map(r => ({ exchange: r.exchange, priority: r.priority })) }
                    })
                },
                {
                    name: 'httpHeaders',
                    description: 'Fetch HTTP headers (HEAD request)',
                    handler: (async (args: JsonObject) => {
                        const url = args.url as string
                        const hostname = ensureAllowedTarget(deps, url)
                        const targetUrl = url.includes('://') ? url : `https://${hostname}`
                        const response = await fetch(targetUrl, { method: 'HEAD' })
                        const headers: Record<string, string> = {}
                        response.headers.forEach((value, key) => { headers[key] = value })
                        return { status: response.status, headers }
                    })
                },
                {
                    name: 'portScan',
                    description: 'Scan ports with nmap (allowlist only)',
                    handler: (async (args: JsonObject) => {
                        const target = args.target as string
                        const ports = args.ports as string | undefined
                        const hostname = ensureAllowedTarget(deps, target)
                        const portArg = ports ? `-p ${ports}` : ''
                        const command = `nmap -Pn ${portArg} ${hostname}`.trim()
                        return deps.command.executeCommand(command)
                    })
                }
            ])
        },
        {
            name: 'embedding',
            description: 'Embedding operations',
            actions: buildActions([
                { name: 'embed', description: 'Generate embedding', handler: ({ text }) => deps.embedding.generateEmbedding(text as string) }
            ])
        },
        {
            name: 'docker',
            description: 'Docker utilities',
            actions: buildActions([
                { name: 'listContainers', description: 'List docker containers', handler: () => deps.docker.listContainers() },
                { name: 'stats', description: 'Docker stats (no stream)', handler: () => deps.docker.getStats() },
                { name: 'listImages', description: 'List docker images', handler: () => deps.docker.listImages() }
            ])
        },
        {
            name: 'ollama',
            description: 'Ollama local LLM utilities',
            actions: buildActions([
                { name: 'listModels', description: 'List local ollama models', handler: () => deps.ollama.getModels() },
                { name: 'ps', description: 'List running ollama models', handler: () => deps.ollama.ps() }
            ])
        },
        {
            name: 'database',
            description: 'App database access',
            actions: buildActions([
                { name: 'stats', description: 'Get DB stats', handler: () => deps.database.getStats() },
                { name: 'chats', description: 'List chats', handler: () => deps.database.getAllChats() }
            ])
        },
        {
            name: 'content',
            description: 'Content helpers (markdown/code)',
            actions: buildActions([
                { name: 'base64Encode', description: 'Base64 encode', handler: ({ text }) => deps.content.base64Encode(text as string) },
                { name: 'formatJson', description: 'Pretty print JSON', handler: ({ json }) => deps.content.formatJson(json as JsonValue) }
            ])
        },
        {
            name: 'clipboard',
            description: 'Clipboard helpers',
            actions: buildActions([
                { name: 'read', description: 'Read clipboard text', handler: () => deps.clipboard.readText() },
                { name: 'write', description: 'Write clipboard text', handler: ({ text }) => deps.clipboard.writeText(text as string) }
            ])
        }
    ]
}
