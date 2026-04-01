import { chatStream } from '@renderer/lib/chat-stream';
import { Check, Copy, GitCommit, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

interface GitCommitGeneratorProps {
    workspacePath?: string;
    onClose?: () => void;
}

interface HeaderProps {
    t: (key: string) => string;
    isLoading: boolean;
    workspacePath: string | undefined;
    onFetch: () => void;
}

const GeneratorHeader = ({ t, isLoading, workspacePath, onFetch }: HeaderProps) => (
    <div className="flex items-center gap-3 p-4 border-b border-border/30 bg-gradient-to-r from-success/10 to-success-light/10">
        <div className="p-2 rounded-xl bg-success/20 border border-success/30">
            <GitCommit size={20} className="text-success" />
        </div>
        <div className="flex-1">
            <h2 className="font-semibold text-foreground">{t('git.commitGenerator')}</h2>
            <p className="text-xs text-muted-foreground">{t('git.generatorSubtitle')}</p>
        </div>
        <button
            onClick={onFetch}
            disabled={isLoading || !workspacePath}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/20 border border-success/30 text-success text-sm font-medium disabled:opacity-50"
        >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {t('git.generate')}
        </button>
    </div>
);

interface SuggestionAreaProps {
    t: (key: string) => string;
    suggestion: string;
    setSuggestion: (val: string) => void;
    onCopy: () => void;
    isCopied: boolean;
}

const SuggestionArea = ({
    t,
    suggestion,
    setSuggestion,
    onCopy,
    isCopied,
}: SuggestionAreaProps) => (
    <div className="space-y-2">
        <label className="text-xs text-muted-foreground">{t('git.suggestedMessage')}</label>
        <div className="relative">
            <textarea
                value={suggestion}
                onChange={e => setSuggestion(e.target.value)}
                className="w-full bg-background/60 border border-border/40 rounded-lg px-4 py-3 text-sm text-foreground font-mono focus:outline-none focus:border-success/50 resize-none"
                rows={3}
            />
            <button
                onClick={onCopy}
                className="absolute top-2 right-2 p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title={t('git.copy')}
            >
                {isCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
        </div>
    </div>
);

export function GitCommitGenerator({ workspacePath, onClose }: GitCommitGeneratorProps) {
    const { t } = useTranslation();
    const [diff, setDiff] = useState<string>('');
    const [suggestion, setSuggestion] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStagedDiff = async () => {
        if (!workspacePath) {
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electron.runCommand(
                'git',
                ['diff', '--staged'],
                workspacePath
            );
            if (result.stderr && !result.stdout) {
                setError(t('git.noStagedChanges'));
                return;
            }
            setDiff(result.stdout || '');
            if (result.stdout) {
                await generateCommitMessage(result.stdout);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('git.error'));
        } finally {
            setIsLoading(false);
        }
    };

    const generateCommitMessage = async (diffContent: string) => {
        try {
            const truncatedDiff = diffContent.slice(0, 8000);
            const prompt = `Based on the following git diff, generate a concise and descriptive commit message following conventional commit format (feat/fix/docs/style/refactor/test/chore). Output ONLY the commit message, nothing else.\n\nGit Diff:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n\nCommit message:`;
            const stream = chatStream({
                messages: [
                    { role: 'user', content: prompt, id: 'temp-git', timestamp: new Date() },
                ],
                model: 'llama3.2',
                tools: [],
                provider: 'ollama',
            });
            let fullContent = '';
            for await (const chunk of stream) {
                if (chunk.type === 'content') {
                    fullContent += chunk.content;
                }
            }
            if (fullContent) {
                setSuggestion(fullContent.trim().replace(/^["']|["']$/g, ''));
            }
        } catch (err) {
            appLogger.error(
                'GitCommitGenerator',
                'Failed to generate commit message',
                err as Error
            );
            setSuggestion('feat: update code');
        }
    };

    const copyToClipboard = async () => {
        if (!suggestion) {
            return;
        }
        try {
            await navigator.clipboard.writeText(suggestion);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            appLogger.error('GitCommitGenerator', 'Failed to copy', err as Error);
        }
    };

    const executeCommit = async () => {
        if (!workspacePath || !suggestion) {
            return;
        }
        try {
            const result = await window.electron.runCommand(
                'git',
                ['commit', '-m', suggestion],
                workspacePath
            );
            if (result.stderr && !result.stdout) {
                setError(result.stderr);
                return;
            }
            onClose?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('git.error'));
        }
    };

    return (
        <div className="bg-muted rounded-2xl border border-border/40 overflow-hidden max-w-2xl w-full">
            <GeneratorHeader
                t={t}
                isLoading={isLoading}
                workspacePath={workspacePath}
                onFetch={() => {
                    void fetchStagedDiff();
                }}
            />
            <div className="p-4 space-y-4">
                {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        {error}
                    </div>
                )}
                {!workspacePath && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        {t('git.selectWorkspace')}
                    </div>
                )}
                {suggestion && (
                    <SuggestionArea
                        t={t}
                        suggestion={suggestion}
                        setSuggestion={setSuggestion}
                        onCopy={() => {
                            void copyToClipboard();
                        }}
                        isCopied={isCopied}
                    />
                )}
                {diff && (
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">
                            {t('git.stagedChanges')}
                        </label>
                        <pre className="bg-background/60 border border-border/30 rounded-lg p-3 text-xs font-mono text-muted-foreground max-h-48 overflow-y-auto">
                            {diff.slice(0, 2000)}
                            {diff.length > 2000 && '\n... (truncated)'}
                        </pre>
                    </div>
                )}
            </div>
            {suggestion && (
                <div className="flex gap-3 p-4 border-t border-border/30">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg bg-muted/40 text-muted-foreground text-sm font-medium hover:bg-muted/60"
                    >
                        {t('git.cancel')}
                    </button>
                    <button
                        onClick={() => {
                            void executeCommit();
                        }}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-success to-success-light text-foreground text-sm font-medium"
                    >
                        {t('git.commit')}
                    </button>
                </div>
            )}
        </div>
    );
}
