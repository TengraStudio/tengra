import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ToolResult } from '@/types'
import { JsonObject, JsonValue } from '@/types/common'
import { useTranslation, Language } from '@/i18n'

interface CommandExecutionResult {
    stdout?: string;
    stderr?: string;
    error?: string;
}

interface ToolCallType {
    id: string;
    name: string;
    arguments: JsonObject;
}

interface ToolDisplayProps {
    toolCall: ToolCallType
    result?: ToolResult
    isExecuting?: boolean
    language?: Language
}

import { cn } from '@/lib/utils'

export function ToolDisplay({ toolCall, result, isExecuting, language = 'en' }: ToolDisplayProps) {
    const { t } = useTranslation(language)
    const hasError = result?.error
    const resultData = result?.result as CommandExecutionResult | undefined
    const execStdout = resultData?.stdout
    const execStderr = resultData?.stderr
    const execError = resultData?.error
    const [commandExpanded, setCommandExpanded] = useState(false)
    const [showMarkdown, setShowMarkdown] = useState(false)

    useEffect(() => {
        if (toolCall.name !== 'execute_command') return
        if (isExecuting || execError || execStderr) {
            setCommandExpanded(true)
        }
    }, [toolCall.name, isExecuting, execError, execStderr])

    // SPECIAL HANDLING: Terminal Commands ("Direct & Real-time")
    if (toolCall.name === 'execute_command') {
        const command = String(toolCall.arguments.command || '')
        const stdout = execStdout
        const stderr = execStderr
        const error = execError
        const outputText = [stdout, stderr, error].filter(Boolean).join('\n')
        const preview = outputText ? outputText.split('\n').slice(0, 6).join('\n') : ''
        const hasOutput = Boolean(outputText)
        const statusLabel = isExecuting ? t('tools.running') : (error || stderr ? t('tools.error') : t('tools.completed'))
        const statusClass = error || stderr
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : isExecuting
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-muted/20 text-muted-foreground border-border/50'

        return (
            <div className="my-3 animate-in fade-in slide-in-from-bottom-1 duration-500">
                <button
                    onClick={() => setCommandExpanded(!commandExpanded)}
                    className={cn(
                        "w-full text-left rounded-xl border px-3 py-2 transition-all",
                        commandExpanded ? "bg-muted/30 border-border" : "bg-muted/10 border-border/50 hover:bg-muted/20"
                    )}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border", statusClass)}>
                                {statusLabel}
                            </span>
                            <span className="text-xs text-muted-foreground">{t('tools.command')}</span>
                            <span className="text-xs font-mono text-foreground/80 truncate">{command}</span>
                        </div>
                        <span className={cn("text-xs text-muted-foreground transition-transform", commandExpanded && "rotate-180")}>v</span>
                    </div>
                    {!commandExpanded && (
                        <div className="mt-2 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-24 overflow-hidden">
                            {preview || (isExecuting ? t('tools.executing') : t('tools.noOutput'))}
                        </div>
                    )}
                </button>

                {commandExpanded && (
                    <div className="terminal-window mt-3 border border-border shadow-2xl rounded-xl overflow-hidden">
                        {/* Mac-style Header */}
                        <div className="terminal-header bg-muted h-7 flex items-center justify-between px-2">
                            <div className="flex gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                                <div className="terminal-dot bg-[#ff5f56] border-[#e0443e]"></div>
                                <div className="terminal-dot bg-[#ffbd2e] border-[#dea123]"></div>
                                <div className="terminal-dot bg-[#27c93f] border-[#1aab29]"></div>
                            </div>
                            <div className="text-sm text-zinc-400 font-medium select-none flex-1 text-center font-mono flex items-center justify-center gap-2">
                                <span className="opacity-50">admin@macbook</span>
                                <span className="text-zinc-600">~</span>
                                <span>zsh</span>
                            </div>
                            {hasOutput && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setShowMarkdown(!showMarkdown)
                                    }}
                                    className="text-xs bg-background/50 text-muted-foreground hover:bg-background/80 px-2 py-0.5 rounded border border-border transition-colors uppercase tracking-wider font-bold mr-2"
                                    title="Markdown Gorunumu"
                                >
                                    {showMarkdown ? t('tools.text') : t('tools.markdown')}
                                </button>
                            )}
                            {/* KILL BUTTON */}
                            {isExecuting && (
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation()
                                        const success = await window.electron.killTool(toolCall.id)
                                        if (success) console.log("Process killed")
                                    }}
                                    className="text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-0.5 rounded border border-red-500/20 transition-colors uppercase tracking-wider font-bold"
                                    title={t('tools.forceStop')}
                                >
                                    {t('tools.stop')}
                                </button>
                            )}
                        </div>

                        {/* Terminal Body */}
                        <div className="terminal-content p-4 bg-background min-h-[120px] max-h-[400px] overflow-y-auto font-mono text-sm leading-relaxed selection:bg-primary/20">
                            {/* Command Prompt Line */}
                            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                                <span className="text-blue-400">&gt;</span>
                                <span className="text-cyan-300">~</span>
                                <span className="text-zinc-200">{command}</span>
                            </div>

                            {/* Output */}
                            <div className="pl-0 mt-2">
                                {/* Loading State */}
                                {isExecuting && (
                                    <div className="flex items-center gap-2 text-zinc-500 italic mb-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse"></span>
                                        {t('tools.executingCommand')}
                                    </div>
                                )}

                                {result ? (
                                    <>
                                        {showMarkdown ? (
                                            <div className="text-zinc-200 text-sm leading-6">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {outputText || t('tools.noOutputReturned')}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <>
                                                {stdout && (
                                                    <div className="text-zinc-300 whitespace-pre-wrap leading-6 tracking-wide">
                                                        {stdout}
                                                    </div>
                                                )}
                                                {stderr && (
                                                    <div className="text-red-400 whitespace-pre-wrap mt-2 leading-6">
                                                        <span className="inline-block mr-2">stderr:</span>
                                                        {stderr}
                                                    </div>
                                                )}
                                                {error && (
                                                    <div className="text-red-500 font-bold whitespace-pre-wrap mt-2 leading-6 bg-red-500/10 p-2 rounded">
                                                        <span className="inline-block mr-2">error:</span>
                                                        {error}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {!hasOutput && !isExecuting && (
                                            <div className="text-zinc-600 italic text-xs mt-1 opacity-50">
                                                {t('tools.noOutput')}
                                            </div>
                                        )}
                                    </>
                                ) : null}

                                {/* Blinking Cursor at the end */}
                                <div className="mt-2">
                                    <span className="text-emerald-400 font-bold mr-2">&gt;</span>
                                    <span className="inline-block w-2.5 h-5 bg-zinc-500/80 align-sub animate-pulse"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // DEFAULT HANDLING: Status Bar Style
    // const icon = getToolIcon(toolCall.name) // Unused now
    // const isCompleted = !!result

    // Auto-expand only if there is an error or it's a specific tool type
    const [userExpanded, setUserExpanded] = useState(false)

    // Specific status messages
    let statusText = t('tools.usingTool')
    if (isExecuting) {
        if (toolCall.name.includes('search')) statusText = t('tools.searching')
        else if (toolCall.name.includes('file')) statusText = t('tools.readingFiles')
        else if (toolCall.name.includes('command')) statusText = t('tools.executingCmd')
        else if (toolCall.name.includes('screenshot')) statusText = t('tools.screenshotting')
    } else {
        if (hasError) statusText = t('tools.failed')
        else statusText = t('tools.completed')
    }

    if (isExecuting) {
        return (
            <div className="flex items-center gap-3 py-2 px-1 animate-pulse">
                <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span className="text-sm text-foreground/70 font-medium">{statusText}</span>
            </div>
        )
    }

    return (
        <div className="my-2 group">
            <button
                onClick={() => setUserExpanded(!userExpanded)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full text-left",
                    hasError
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
            >
                <div>{hasError ? '❌' : '✅'}</div>
                <div className="flex-1 truncate font-mono opacity-80">
                    <span className="opacity-70 mr-2">{toolCall.name}</span>
                    <span className="opacity-50">({statusText})</span>
                </div>
                <div className="transition-transform duration-200 opacity-50" style={{ transform: userExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                </div>
            </button>

            {userExpanded && (
                <div className="mt-2 ml-2 border-l-2 border-white/10 pl-3 py-1 space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                        <div className="text-sm uppercase tracking-wider text-muted-foreground font-bold opacity-50">{t('tools.input')}</div>
                        <ToolArguments name={toolCall.name} args={toolCall.arguments} />
                    </div>
                    {result && (
                        <div className="space-y-1">
                            <div className="text-sm uppercase tracking-wider text-muted-foreground font-semibold opacity-70">{t('tools.output')}</div>
                            <ToolOutput name={toolCall.name} result={result.result} t={t} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function ToolArguments({ name, args }: { name: string; args: JsonObject }) {
    if (name === 'read_file' || name === 'write_file') {
        const pathValue = typeof args.path === 'string'
            ? args.path
            : (typeof args.file === 'string' ? args.file : '')
        return <div className="font-mono text-primary bg-primary/10 px-2 py-1 rounded inline-block">Path: {pathValue}</div>
    }
    return <pre className="font-mono text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>
}

function ToolOutput({ name, result, t }: { name: string; result: JsonValue; t: (key: string) => string }) {
    // Other tool outputs remain the same but cleaner
    if (name === 'read_file') {
        const content = typeof result === 'string'
            ? result
            : (result && typeof result === 'object' && !Array.isArray(result) && typeof (result as JsonObject).content === 'string'
                ? (result as JsonObject).content as string
                : '')
        return (
            <div className="relative group">
                <div className="absolute right-2 top-2 text-sm text-muted-foreground opacity-50">{t('tools.filePreview')}</div>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        code({ className, children, ...props }) {
                            return <code className={className} {...props}>{children}</code>
                        }
                    }}
                >
                    {`\`\`\`\n${content}\n\`\`\``}
                </ReactMarkdown>
            </div>
        )
    }

    if (name === 'search_web') {
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            const resultsValue = (result as JsonObject).results
            const results = Array.isArray(resultsValue)
                ? resultsValue.filter((item): item is JsonObject => !!item && typeof item === 'object' && !Array.isArray(item))
                : []
            if (results.length > 0) {
                return (
                    <div className="flex flex-col gap-2">
                        {results.map((r, i) => {
                            const url = typeof r.url === 'string' ? r.url : ''
                            const title = typeof r.title === 'string' ? r.title : ''
                            const snippet = typeof r.snippet === 'string' ? r.snippet : ''
                            const content = typeof r.content === 'string' ? r.content : ''
                            return (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block p-2 bg-card border border-border rounded hover:border-primary/50 transition-colors group">
                                    <div className="font-medium text-primary group-hover:underline truncate">{title}</div>
                                    <div className="text-muted-foreground line-clamp-2 mt-1">{content || snippet}</div>
                                </a>
                            )
                        })}
                    </div>
                )
            }
        }
    }

    if (name === 'capture_screenshot') {
        const imgParams = typeof result === 'string'
            ? result
            : (result && typeof result === 'object' && !Array.isArray(result) ? (result as JsonObject).image : undefined)
        if (typeof imgParams === 'string') return <img src={imgParams} className="max-w-full rounded-md border border-border shadow-sm" alt="Screenshot" />
    }

    if (typeof result === 'string') {
        return (
            <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result}
                </ReactMarkdown>
            </div>
        )
    }

    let displayStr = ''
    try { displayStr = JSON.stringify(result, null, 2) } catch { displayStr = String(result) }
    return <pre className="font-mono text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-h-60">{displayStr}</pre>
}
