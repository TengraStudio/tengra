import React, { useCallback,useState } from 'react';

import { useTranslation } from '@/i18n';

import { LanguageSelector } from './LanguageSelector';
import { OutputDisplay } from './OutputDisplay';

type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'shell';

interface ExecutionResult {
    success: boolean;
    stdout: string;
    stderr: string;
    durationMs: number;
}

/**
 * Inline code execution panel for running snippets in a sandboxed environment.
 * Supports JavaScript, TypeScript, Python, and Shell.
 */
export const CodeSandboxPanel: React.FC = () => {
    const { t } = useTranslation();
    const [language, setLanguage] = useState<SandboxLanguage>('javascript');
    const [code, setCode] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<ExecutionResult | null>(null);

    const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCode(e.target.value);
    }, []);

    const handleRun = useCallback(async () => {
        if (!code.trim() || isRunning) {return;}

        setIsRunning(true);
        setResult(null);

        try {
            const response = await window.electron.codeSandbox.execute({
                language,
                code,
            });

            setResult({
                success: response.success,
                stdout: response.stdout,
                stderr: response.stderr,
                durationMs: response.durationMs,
            });
        } catch {
            setResult({
                success: false,
                stdout: '',
                stderr: t('codeSandbox.error'),
                durationMs: 0,
            });
        } finally {
            setIsRunning(false);
        }
    }, [code, language, isRunning, t]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleRun();
            }
        },
        [handleRun]
    );

    return (
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {t('codeSandbox.title')}
                </h3>
                <LanguageSelector
                    value={language}
                    onChange={setLanguage}
                    disabled={isRunning}
                />
            </div>

            <textarea
                value={code}
                onChange={handleCodeChange}
                onKeyDown={handleKeyDown}
                placeholder={t('codeSandbox.codePlaceholder')}
                disabled={isRunning}
                rows={8}
                className="w-full resize-y rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                spellCheck={false}
            />

            <div className="mt-3 flex justify-end">
                <button
                    onClick={() => void handleRun()}
                    disabled={isRunning || !code.trim()}
                    className="rounded-lg bg-[var(--accent-primary)] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isRunning ? t('codeSandbox.running') : t('codeSandbox.run')}
                </button>
            </div>

            {result && (
                <OutputDisplay
                    stdout={result.stdout}
                    stderr={result.stderr}
                    durationMs={result.durationMs}
                    success={result.success}
                />
            )}
        </div>
    );
};

CodeSandboxPanel.displayName = 'CodeSandboxPanel';
