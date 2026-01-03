import { ContentService } from '../services/content.service'
import { CommandService } from '../services/command.service'
import { ClipboardService } from '../services/clipboard.service'
import { DockerService } from '../services/docker.service'
import { DatabaseService } from '../services/database.service'
import { EmbeddingService } from '../services/embedding.service'
import { FileManagementService } from '../services/file.service'
import { FileSystemService } from '../services/filesystem.service'
import { GitService } from '../services/git.service'
import { MonitoringService } from '../services/monitoring.service'
import { NetworkService } from '../services/network.service'
import { NotificationService } from '../services/notification.service'
import { ScannerService } from '../services/scanner.service'
import { ScreenshotService } from '../services/screenshot.service'
import { SecurityService } from '../services/security.service'
import { SettingsService } from '../services/settings.service'
import { SSHService } from '../services/ssh.service'
import { SystemService } from '../services/system.service'
import { UtilityService } from '../services/utility.service'
import { WebService } from '../services/web.service'
import { McpAction, McpService, McpResult } from './types'
import { promises as dns } from 'dns'

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
}

function wrap(handler: (args: any) => any): (args: any) => Promise<McpResult> {
    return async (args: any) => {
        try {
            const result = await Promise.resolve(handler(args))
            if (result?.success === false) {
                return { success: false, error: result.error || 'Unknown error' }
            }
            return { success: true, data: result?.result ?? result }
        } catch (error: any) {
            return { success: false, error: error?.message || String(error) }
        }
    }
}

const buildActions = (actions: Array<Omit<McpAction, 'handler'> & { handler: (args: any) => any }>): McpAction[] =>
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
                { name: 'read', description: 'Read a UTF-8 file', handler: ({ path }) => deps.filesystem.readFile(path) },
                { name: 'write', description: 'Write text to file', handler: ({ path, content }) => deps.filesystem.writeFile(path, content) },
                { name: 'list', description: 'List directory entries', handler: ({ path }) => deps.filesystem.listDirectory(path) }
            ])
        },
        {
            name: 'file',
            description: 'File management helpers (zip, download, rename)',
            actions: buildActions([
                { name: 'extractStrings', description: 'Extract printable strings', handler: ({ path, minLength }) => deps.file.extractStrings(path, minLength) },
                { name: 'unzip', description: 'Unzip archive', handler: ({ zipPath, destPath }) => deps.file.unzip(zipPath, destPath) },
                { name: 'download', description: 'Download a file over HTTPS', handler: ({ url, destPath }) => deps.file.downloadFile(url, destPath) }
            ])
        },
        {
            name: 'command',
            description: 'Local shell execution with safety checks',
            actions: buildActions([
                { name: 'run', description: 'Execute a shell command', handler: ({ command, cwd }) => deps.command.executeCommand(command, { cwd }) },
                { name: 'kill', description: 'Kill a tracked command', handler: ({ id }) => Promise.resolve({ success: deps.command.killCommand(id) }) }
            ])
        },
        {
            name: 'web',
            description: 'HTTP utilities',
            actions: buildActions([
                { name: 'fetch', description: 'Fetch web page HTML/text', handler: ({ url }) => deps.web.fetchWebPage(url) },
                { name: 'search', description: 'Search the web', handler: ({ query, numResults }) => deps.web.searchWeb(query, numResults) }
            ])
        },
        {
            name: 'utility',
            description: 'Utility helpers',
            actions: buildActions([
                { name: 'exchangeRate', description: 'Get FX rate', handler: ({ from, to }) => deps.utility.getExchangeRate(from, to) },
                { name: 'storeMemory', description: 'Store memory key/value', handler: ({ key, value }) => deps.utility.storeMemory(key, value) },
                { name: 'recallMemory', description: 'Recall memory by key', handler: ({ key }) => deps.utility.recallMemory(key) }
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
                { name: 'connect', description: 'Open SSH connection', handler: (args) => deps.ssh.connect(args) },
                { name: 'execute', description: 'Run remote command', handler: ({ connectionId, command, cwd }) => deps.ssh.executeCommand(connectionId, command, { cwd }) },
                { name: 'disconnect', description: 'Close SSH connection', handler: ({ connectionId }) => deps.ssh.disconnect(connectionId).then(() => ({ success: true })) }
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
                { name: 'scanDirectory', description: 'Scan directory for code files', handler: ({ path }) => deps.scanner.scanDirectory(path) }
            ])
        },
        {
            name: 'notification',
            description: 'System notifications',
            actions: buildActions([
                { name: 'notify', description: 'Send notification', handler: ({ title, body, silent }) => deps.notification.showNotification(title, body, silent) }
            ])
        },
        {
            name: 'network',
            description: 'Network utilities',
            actions: buildActions([
                { name: 'ping', description: 'Ping host', handler: ({ host }) => deps.network.ping(host) },
                { name: 'traceroute', description: 'Run traceroute', handler: ({ host }) => deps.network.traceroute(host) },
                { name: 'whois', description: 'WHOIS lookup', handler: ({ domain }) => deps.network.whois(domain) }
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
                { name: 'status', description: 'Get git status', handler: ({ repoPath }) => deps.git.getStatus(repoPath) },
                { name: 'log', description: 'Get git log', handler: ({ repoPath, limit }) => deps.git.getLog(repoPath, limit) }
            ])
        },
        {
            name: 'security',
            description: 'Security helpers',
            actions: buildActions([
                { name: 'generatePassword', description: 'Generate a password', handler: ({ length, numbers, symbols }) => Promise.resolve(deps.security.generatePassword(length, numbers, symbols)) },
                { name: 'checkPasswordStrength', description: 'Check password strength', handler: ({ password }) => Promise.resolve(deps.security.checkPasswordStrength(password)) },
                { name: 'generateHash', description: 'Generate hash', handler: ({ text, algorithm }) => Promise.resolve(deps.security.generateHash(text, algorithm)) },
                { name: 'stripMetadata', description: 'Strip file metadata', handler: ({ path, outputPath }) => deps.security.stripMetadata(path, outputPath) }
            ])
        },
        {
            name: 'security-audit',
            description: 'Defensive security and network checks (allowlist enforced)',
            actions: buildActions([
                {
                    name: 'dnsLookup',
                    description: 'Resolve DNS A/AAAA records',
                    handler: async ({ target }) => {
                        const hostname = ensureAllowedTarget(deps, target)
                        const records = await dns.lookup(hostname, { all: true })
                        return { hostname, records }
                    }
                },
                {
                    name: 'mxLookup',
                    description: 'Resolve DNS MX records',
                    handler: async ({ target }) => {
                        const hostname = ensureAllowedTarget(deps, target)
                        const records = await dns.resolveMx(hostname)
                        return { hostname, records }
                    }
                },
                {
                    name: 'httpHeaders',
                    description: 'Fetch HTTP headers (HEAD request)',
                    handler: async ({ url }) => {
                        const hostname = ensureAllowedTarget(deps, url)
                        const targetUrl = url.includes('://') ? url : `https://${hostname}`
                        const response = await fetch(targetUrl, { method: 'HEAD' })
                        const headers: Record<string, string> = {}
                        response.headers.forEach((value, key) => { headers[key] = value })
                        return { status: response.status, headers }
                    }
                },
                {
                    name: 'portScan',
                    description: 'Scan ports with nmap (allowlist only)',
                    handler: async ({ target, ports }) => {
                        const hostname = ensureAllowedTarget(deps, target)
                        const portArg = ports ? `-p ${ports}` : ''
                        const command = `nmap -Pn ${portArg} ${hostname}`.trim()
                        return deps.command.executeCommand(command)
                    }
                }
            ])
        },
        {
            name: 'embedding',
            description: 'Embedding operations',
            actions: buildActions([
                { name: 'embed', description: 'Generate embedding', handler: ({ text }) => deps.embedding.generateEmbedding(text) }
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
                { name: 'base64Encode', description: 'Base64 encode', handler: ({ text }) => deps.content.base64Encode(text) },
                { name: 'formatJson', description: 'Pretty print JSON', handler: ({ json }) => deps.content.formatJson(json) }
            ])
        },
        {
            name: 'clipboard',
            description: 'Clipboard helpers',
            actions: buildActions([
                { name: 'read', description: 'Read clipboard text', handler: () => deps.clipboard.readText() },
                { name: 'write', description: 'Write clipboard text', handler: ({ text }) => deps.clipboard.writeText(text) }
            ])
        }
    ]
}
