import { useState } from 'react'
import { chatStream } from '@renderer/lib/chat-stream'
import { GitCommit, Copy, Check, RefreshCw, Sparkles } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface GitCommitGeneratorProps {
    projectPath?: string
    onClose?: () => void
}

export function GitCommitGenerator({ projectPath, onClose }: GitCommitGeneratorProps) {
    const { t } = useTranslation()
    const [diff, setDiff] = useState<string>('')
    const [suggestion, setSuggestion] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [isCopied, setIsCopied] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchStagedDiff = async () => {
        if (!projectPath) return

        setIsLoading(true)
        setError(null)

        try {
            // Get staged diff via IPC
            const result = await window.electron.runCommand('git', ['diff', '--staged'], projectPath)

            if (result.stderr && !result.stdout) {
                setError(t('git.noStagedChanges'))
                return
            }

            setDiff(result.stdout || '')

            // Generate commit message using AI
            if (result.stdout) {
                await generateCommitMessage(result.stdout)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : t('git.error')
            setError(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const generateCommitMessage = async (diffContent: string) => {
        try {
            const truncatedDiff = diffContent.slice(0, 8000) // Limit diff size

            const prompt = `Based on the following git diff, generate a concise and descriptive commit message following conventional commit format (feat/fix/docs/style/refactor/test/chore). Output ONLY the commit message, nothing else.

Git Diff:
\`\`\`diff
${truncatedDiff}
\`\`\`

Commit message:`

            const stream = chatStream(
                [{ role: 'user', content: prompt, id: 'temp-git', timestamp: new Date() }],
                'llama3.2', // Use local Ollama model as requested
                [],
                'ollama'
            )

            let fullContent = ''
            for await (const chunk of stream) {
                if (chunk.type === 'content') fullContent += chunk.content
            }

            const response = { content: fullContent }

            if (response.content) {
                setSuggestion(response.content.trim().replace(/^["']|["']$/g, ''))
            }
        } catch (err) {
            console.error('Failed to generate commit message:', err)
            setSuggestion('feat: update code') // Fallback
        }
    }

    const copyToClipboard = async () => {
        if (!suggestion) return

        try {
            await navigator.clipboard.writeText(suggestion)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const executeCommit = async () => {
        if (!projectPath || !suggestion) return

        try {
            const result = await window.electron.runCommand('git', ['commit', '-m', suggestion], projectPath)
            if (result.stderr && !result.stdout) {
                setError(result.stderr)
                return
            }
            // Success - close the modal
            onClose?.()
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : t('git.error')
            setError(errorMessage)
        }
    }

    return (
        <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30">
                    <GitCommit size={20} className="text-green-400" />
                </div>
                <div className="flex-1">
                    <h2 className="font-semibold text-white">{t('git.commitGenerator')}</h2>
                    <p className="text-xs text-zinc-500">{t('git.generatorSubtitle')}</p>
                </div>
                <button
                    onClick={fetchStagedDiff}
                    disabled={isLoading || !projectPath}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium disabled:opacity-50"
                >
                    {isLoading ? (
                        <RefreshCw size={16} className="animate-spin" />
                    ) : (
                        <Sparkles size={16} />
                    )}
                    {t('git.generate')}
                </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {!projectPath && (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        {t('git.selectProject')}
                    </div>
                )}

                {suggestion && (
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500">{t('git.suggestedMessage')}</label>
                        <div className="relative">
                            <textarea
                                value={suggestion}
                                onChange={(e) => setSuggestion(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-green-500/50 resize-none"
                                rows={3}
                            />
                            <button
                                onClick={copyToClipboard}
                                className="absolute top-2 right-2 p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                title={t('git.copy')}
                            >
                                {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                )}

                {diff && (
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500">{t('git.stagedChanges')}</label>
                        <pre className="bg-black/30 border border-white/5 rounded-lg p-3 text-xs font-mono text-zinc-400 max-h-48 overflow-y-auto">
                            {diff.slice(0, 2000)}
                            {diff.length > 2000 && '\n... (truncated)'}
                        </pre>
                    </div>
                )}
            </div>

            {/* Footer */}
            {suggestion && (
                <div className="flex gap-3 p-4 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg bg-white/5 text-zinc-400 text-sm font-medium hover:bg-white/10"
                    >
                        {t('git.cancel')}
                    </button>
                    <button
                        onClick={executeCommit}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium"
                    >
                        {t('git.commit')}
                    </button>
                </div>
            )}
        </div>
    )
}
