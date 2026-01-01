import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ToolResult } from '../types'

interface ToolDisplayProps {
    toolCall: {
        id: string
        name: string
        arguments: any
    }
    result?: ToolResult
    isExecuting?: boolean
}

export function ToolDisplay({ toolCall, result, isExecuting }: ToolDisplayProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    // SPECIAL HANDLING: Terminal Commands ("Direct & Real-time")
    if (toolCall.name === 'execute_command') {
        const command = toolCall.arguments.command
        const stdout = result?.result?.stdout
        const stderr = result?.result?.stderr
        const error = result?.result?.error


        return (
            <div className="terminal-window mt-6 mb-4 animate-in fade-in slide-in-from-bottom-1 duration-500 border border-white/10 shadow-2xl">
                {/* Mac-style Header */}
                <div className="terminal-header bg-[#2d2d2d] h-7 flex items-center justify-between px-2">
                    <div className="flex gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                        <div className="terminal-dot bg-[#ff5f56] border-[#e0443e]"></div>
                        <div className="terminal-dot bg-[#ffbd2e] border-[#dea123]"></div>
                        <div className="terminal-dot bg-[#27c93f] border-[#1aab29]"></div>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-medium select-none flex-1 text-center font-mono flex items-center justify-center gap-2">
                        <span className="opacity-50">admin@macbook</span>
                        <span className="text-zinc-600">~</span>
                        <span>zsh</span>
                    </div>
                    {/* KILL BUTTON */}
                    {isExecuting && (
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                const success = await window.electron.killTool(toolCall.id);
                                if (success) console.log("Process killed");
                            }}
                            className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-0.5 rounded border border-red-500/20 transition-colors uppercase tracking-wider font-bold"
                            title="İşlemi Zorla Durdur"
                        >
                            DURDUR
                        </button>
                    )}
                </div>

                {/* Terminal Body */}
                <div className="terminal-content p-4 bg-[#1e1e1e] min-h-[120px] max-h-[400px] overflow-y-auto font-mono text-[13px] leading-relaxed selection:bg-white/20">
                    {/* Command Prompt Line */}
                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                        <span className="text-blue-400">➜</span>
                        <span className="text-cyan-300">~</span>
                        <span className="text-[#e5e5e5]">{command}</span>
                    </div>

                    {/* Output */}
                    <div className="pl-0 mt-2">
                        {/* Loading State */}
                        {isExecuting && (
                            <div className="flex items-center gap-2 text-zinc-500 italic mb-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse"></span>
                                komut yürütülüyor...
                            </div>
                        )}

                        {result ? (
                            <>
                                {stdout && (
                                    <div className="text-[#cccccc] whitespace-pre-wrap leading-6 tracking-wide">
                                        {stdout}
                                    </div>
                                )}
                                {stderr && (
                                    <div className="text-red-400 whitespace-pre-wrap mt-2 leading-6">
                                        <span className="inline-block mr-2">✖</span>
                                        {stderr}
                                    </div>
                                )}
                                {error && (
                                    <div className="text-red-500 font-bold whitespace-pre-wrap mt-2 leading-6 bg-red-500/10 p-2 rounded">
                                        <span className="inline-block mr-2">⚠️</span>
                                        {error}
                                    </div>
                                )}
                                {!stdout && !stderr && !isExecuting && (
                                    <div className="text-zinc-600 italic text-xs mt-1 opacity-50">
                                        (No output returned)
                                    </div>
                                )}
                            </>
                        ) : null}

                        {/* Blinking Cursor at the end */}
                        <div className="mt-2">
                            <span className="text-emerald-400 font-bold mr-2">➜</span>
                            <span className="inline-block w-2.5 h-5 bg-zinc-500/80 align-sub animate-pulse"></span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // DEFAULT HANDLING: Other Tools (Collapsible)
    const icon = getToolIcon(toolCall.name)
    const shouldDefaultExpand = isExecuting || ['read_file', 'list_directory', 'search_web'].includes(toolCall.name)
    const showBody = isExpanded || shouldDefaultExpand

    return (
        <div className={`tool-container overflow-hidden rounded-lg border border-border/50 bg-secondary/20 my-2 ${result?.error ? 'border-destructive/30' : ''}`}>
            <div
                className="tool-header-row flex items-center justify-between px-3 py-2 bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-4 flex justify-center">
                        {isExecuting ? <span className="animate-spin text-xs">⏳</span> :
                            result?.error ? '❌' :
                                result ? '✅' : '⚡'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 truncate">
                        <span className="text-base">{icon}</span>
                        <span className="font-mono opacity-80">{toolCall.name}</span>
                    </div>
                </div>
                <div className="text-[10px] text-muted-foreground transition-transform duration-200" style={{ transform: showBody ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▼
                </div>
            </div>

            {showBody && (
                <div className="tool-body border-t border-border/30 bg-background/50 p-3 text-xs space-y-3">
                    {/* Arguments */}
                    <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold opacity-70">Girdi</div>
                        <ToolArguments name={toolCall.name} args={toolCall.arguments} />
                    </div>

                    {/* Result */}
                    {result && (
                        <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold opacity-70">Çıktı</div>
                            <ToolOutput name={toolCall.name} result={result.result} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function ToolArguments({ name, args }: { name: string, args: any }) {
    if (name === 'read_file' || name === 'write_file') {
        return <div className="font-mono text-primary bg-primary/10 px-2 py-1 rounded inline-block">📄 {args.path || args.file}</div>
    }
    return <pre className="font-mono text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>
}

function ToolOutput({ name, result }: { name: string, result: any }) {
    // Other tool outputs remain the same but cleaner
    if (name === 'read_file') {
        const content = typeof result === 'string' ? result : result.content
        return (
            <div className="relative group">
                <div className="absolute right-2 top-2 text-[10px] text-muted-foreground opacity-50">FILE PREVIEW</div>
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
        if (result.results && Array.isArray(result.results)) {
            return (
                <div className="flex flex-col gap-2">
                    {result.results.map((r: any, i: number) => (
                        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block p-2 bg-card border border-border rounded hover:border-primary/50 transition-colors group">
                            <div className="font-medium text-primary group-hover:underline truncate">{r.title}</div>
                            <div className="text-muted-foreground line-clamp-2 mt-1">{r.content || r.snippet}</div>
                        </a>
                    ))}
                </div>
            )
        }
    }

    if (name === 'capture_screenshot') {
        const imgParams = typeof result === 'string' ? result : result.image
        if (imgParams) return <img src={imgParams} className="max-w-full rounded-md border border-border shadow-sm" alt="Screenshot" />
    }

    let displayStr = ''
    try { displayStr = JSON.stringify(result, null, 2) } catch { displayStr = String(result) }
    return <pre className="font-mono text-muted-foreground bg-muted/50 p-2 rounded overflow-x-auto max-h-60">{displayStr}</pre>
}


function getToolIcon(name: string): string {
    if (name.includes('file') || name.includes('directory')) return '📁'
    if (name.includes('web') || name.includes('fetch')) return '🌐'
    if (name.includes('screenshot')) return '📷'
    return '🔧'
}
