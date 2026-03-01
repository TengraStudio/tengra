/**
 * IPC API Reference Auto-Generator
 *
 * Scans src/main/ipc/ for handler registrations and generates
 * docs/api/IPC_CHANNELS.md with a comprehensive channel reference.
 *
 * Usage: npx tsx scripts/generate-ipc-docs.ts
 */

import * as fs from 'fs'
import * as path from 'path'

interface IpcChannel {
  channel: string
  direction: string
  description: string
  parameters: string
  returnType: string
  file: string
}

const IPC_DIR = path.resolve(__dirname, '..', 'src', 'main', 'ipc')
const OUTPUT_FILE = path.resolve(__dirname, '..', 'docs', 'api', 'IPC_CHANNELS.md')

/** Extract JSDoc comment above a given line index */
function extractJsDoc(lines: string[], lineIndex: number): string {
  let end = lineIndex - 1
  while (end >= 0 && lines[end].trim() === '') end--
  if (end < 0 || !lines[end].trim().endsWith('*/')) return ''

  let start = end
  while (start >= 0 && !lines[start].includes('/**')) start--

  const comment = lines
    .slice(start, end + 1)
    .map((l) => l.replace(/^\s*\*?\s?\/?\*?\*?\/?/g, '').trim())
    .filter(Boolean)
    .join(' ')

  return comment
}

/** Extract parameter info from handler signature */
function extractParams(line: string, nextLines: string[]): string {
  const combined = [line, ...nextLines.slice(0, 5)].join(' ')
  const match = combined.match(/(?:_event[^,]*,\s*)(.+?)(?:\)\s*(?:=>|:))/)
  if (!match) return '—'

  const params = match[1]
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\)$/, '')

  return params.length > 80 ? params.substring(0, 77) + '...' : params || '—'
}

/** Extract return type from handler */
function extractReturnType(line: string, nextLines: string[]): string {
  const combined = [line, ...nextLines.slice(0, 5)].join(' ')
  const match = combined.match(/Promise<([^>]+)>/)
  if (match) return `Promise<${match[1].trim()}>`

  const arrowMatch = combined.match(/=>\s*\{/)
  if (arrowMatch) return 'Promise<unknown>'

  return '—'
}

/** Parse a single IPC handler file */
function parseFile(filePath: string): IpcChannel[] {
  const channels: IpcChannel[] = []
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const fileName = path.basename(filePath, '.ts')

  // Match patterns: ipcMain.handle('channel', ...) or createIpcHandler('channel', ...)
  // or createValidatedIpcHandler('channel', ...) or handle('channel', ...)
  const patterns = [
    /ipcMain\.handle\(\s*['"`]([^'"`]+)['"`]/,
    /ipcMain\.on\(\s*['"`]([^'"`]+)['"`]/,
    /createIpcHandler\(\s*['"`]([^'"`]+)['"`]/,
    /createValidatedIpcHandler\(\s*['"`]([^'"`]+)['"`]/,
    /handle\(\s*['"`]([^'"`]+)['"`]/,
    /['"`]([\w:-]+)['"`]\s*,\s*async\s*\(/,
  ]

  const seen = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    for (const pattern of patterns) {
      const match = line.match(pattern)
      if (!match) continue

      const channel = match[1]
      if (seen.has(channel) || !channel.includes(':') && !channel.includes('-')) continue
      seen.add(channel)

      const jsDoc = extractJsDoc(lines, i)
      const nextLines = lines.slice(i + 1, i + 6)
      const isOn = line.includes('ipcMain.on') || line.includes('.on(')
      const direction = isOn ? 'Renderer → Main (one-way)' : 'Renderer ↔ Main'

      channels.push({
        channel,
        direction,
        description: jsDoc || inferDescription(channel),
        parameters: extractParams(line, nextLines),
        returnType: extractReturnType(line, nextLines),
        file: fileName,
      })
      break
    }
  }

  return channels
}

/** Infer a description from channel name when no JSDoc exists */
function inferDescription(channel: string): string {
  const parts = channel.split(':')
  const domain = parts[0]
  const action = parts.slice(1).join(' ').replace(/-/g, ' ')
  return `${capitalize(domain)}: ${action || 'handler'}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Group channels by domain prefix */
function groupByDomain(channels: IpcChannel[]): Map<string, IpcChannel[]> {
  const groups = new Map<string, IpcChannel[]>()
  for (const ch of channels) {
    const domain = ch.channel.split(':')[0]
    if (!groups.has(domain)) groups.set(domain, [])
    groups.get(domain)!.push(ch)
  }
  return groups
}

/** Generate the markdown document */
function generateMarkdown(channels: IpcChannel[]): string {
  const grouped = groupByDomain(channels)
  const domains = Array.from(grouped.keys()).sort()

  let md = `# IPC Channel Reference

> **Auto-generated** by \`scripts/generate-ipc-docs.ts\`
> Run \`npx tsx scripts/generate-ipc-docs.ts\` to regenerate.

## Summary

- **Total Channels**: ${channels.length}
- **Domains**: ${domains.length}
- **Source**: \`src/main/ipc/\`

## Direction Legend

| Symbol | Meaning |
|--------|---------|
| Renderer ↔ Main | Request/response (invoke/handle) |
| Renderer → Main | One-way event (send/on) |

## Channels by Domain

`

  for (const domain of domains) {
    const domainChannels = grouped.get(domain)!
    md += `### ${capitalize(domain)} (${domainChannels.length} channels)\n\n`
    md += `| Channel | Direction | Description | Source File |\n`
    md += `|---------|-----------|-------------|-------------|\n`

    for (const ch of domainChannels) {
      const desc = ch.description.length > 60
        ? ch.description.substring(0, 57) + '...'
        : ch.description
      md += `| \`${ch.channel}\` | ${ch.direction} | ${desc} | ${ch.file}.ts |\n`
    }
    md += '\n'
  }

  md += `---

*Generated on ${new Date().toISOString().split('T')[0]}*
`

  return md
}

/** Main entry point */
function main(): void {
  if (!fs.existsSync(IPC_DIR)) {
    console.error(`IPC directory not found: ${IPC_DIR}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(IPC_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'sender-validator.ts')
    .map((f) => path.join(IPC_DIR, f))

  const allChannels: IpcChannel[] = []
  for (const file of files) {
    const channels = parseFile(file)
    allChannels.push(...channels)
  }

  allChannels.sort((a, b) => a.channel.localeCompare(b.channel))

  const markdown = generateMarkdown(allChannels)

  const outDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf-8')
  console.log(`Generated ${OUTPUT_FILE} with ${allChannels.length} channels from ${files.length} files`)
}

main()
