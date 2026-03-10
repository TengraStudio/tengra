import { Check, Copy, ExternalLink, Play, Save, Square, Volume2, VolumeX } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import React, { memo, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { normalizeLanguage } from '@/utils/language-map';

const PRISM_LANGUAGE_ALIASES: Record<string, string> = {
    plaintext: 'text',
    shell: 'bash',
    zsh: 'bash',
    dockerfile: 'docker',
    mysql: 'sql',
    pgsql: 'sql',
    'objective-c': 'objectivec',
    mdx: 'jsx',
};

const PRISM_SUPPORTED_LANGUAGES = new Set([
    'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'docker', 'go', 'graphql',
    'html', 'ini', 'java', 'javascript', 'json', 'jsx', 'kotlin', 'less',
    'lua', 'markdown', 'objectivec', 'perl', 'php', 'powershell', 'python',
    'ruby', 'rust', 'scala', 'sql', 'swift', 'text', 'tsx', 'typescript',
    'xml', 'yaml',
]);

const getHighlightLanguage = (language: string): string => {
    const lowerLanguage = language.toLowerCase().trim();
    const normalizedLanguage = normalizeLanguage(language);
    const prismLanguage =
        PRISM_LANGUAGE_ALIASES[lowerLanguage] ??
        PRISM_LANGUAGE_ALIASES[normalizedLanguage] ??
        normalizedLanguage;

    return PRISM_SUPPORTED_LANGUAGES.has(prismLanguage) ? prismLanguage : 'text';
};

interface MonacoBlockProps {
    language: string;
    code: string;
    isSpeaking?: boolean | undefined;
    onSpeak?: (() => void) | undefined;
    onStop?: (() => void) | undefined;
    i18nLanguage?: Language | undefined;
}

export const MonacoBlock = memo<MonacoBlockProps>(
    ({ language, code, isSpeaking, onSpeak, onStop, i18nLanguage = 'en' }) => {
        const { t } = useTranslation(i18nLanguage);
        const [copied, setCopied] = useState(false);
        const [isExecuting, setIsExecuting] = useState(false);
        const [executionResult, setExecutionResult] = useState<{
            output: string;
            error?: boolean;
        } | null>(null);

        const handleCopy = () => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        };

        const handleExecute = () => {
            setIsExecuting(true);
            setExecutionResult(null);
            setTimeout(() => {
                setIsExecuting(false);
                setExecutionResult({ output: t('chat.codeBlock.executed', { language }) });
            }, 1500);
        };

        const lines = code.split('\n').length;
        const height = Math.min(Math.max(lines * 19 + 20, 100), 600);
        const normalizedLanguage = normalizeLanguage(language);
        const highlightLanguage = getHighlightLanguage(language);
        const canExecute = [
            'javascript',
            'typescript',
            'python',
            'shell',
            'sh',
            'bash',
            'powershell',
        ].includes(normalizedLanguage);

        return (
            <div className="not-prose my-4 rounded-xl overflow-hidden border border-border/30 bg-card group/code transition-all duration-300 shadow-xl relative">
                <BlockHeader
                    language={language}
                    isSpeaking={isSpeaking}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    handleCopy={handleCopy}
                    copied={copied}
                    t={t}
                />
                <div style={{ height: `${height}px` }} className="relative w-full overflow-hidden">
                    <Highlight theme={themes.vsDark} code={code} language={highlightLanguage}>
                        {({ style, tokens, getLineProps, getTokenProps }) => (
                            <pre
                                className="m-0 h-full overflow-auto bg-card p-4 text-sm leading-relaxed"
                                style={style}
                            >
                                {tokens.map((line, index) => (
                                    <div
                                        key={index}
                                        {...getLineProps({ line })}
                                        className="flex min-w-max"
                                    >
                                        <span className="mr-4 inline-block w-6 shrink-0 select-none text-right text-xs text-muted-foreground/30">
                                            {index + 1}
                                        </span>
                                        <div className="flex-1">
                                            {line.map((token, tokenIndex) => (
                                                <span key={tokenIndex} {...getTokenProps({ token })} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </pre>
                        )}
                    </Highlight>
                    <FloatingActions
                        canExecute={canExecute}
                        isExecuting={isExecuting}
                        handleExecute={handleExecute}
                        t={t}
                    />
                </div>
                <ExecutionOverlay
                    result={executionResult}
                    onClose={() => setExecutionResult(null)}
                    t={t}
                />
            </div>
        );
    }
);

const BlockHeader: React.FC<{
    language: string;
    isSpeaking?: boolean | undefined;
    onSpeak?: (() => void) | undefined;
    onStop?: (() => void) | undefined;
    handleCopy: () => void;
    copied: boolean;
    t: (key: string) => string;
}> = ({ language, isSpeaking, onSpeak, onStop, handleCopy, copied, t }) => (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
            <div className="flex gap-1.5 mr-2">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
            </div>
            <span className="text-xxs text-muted-foreground uppercase font-black tracking-widest opacity-60 group-hover/code:opacity-100 transition-opacity flex items-center gap-1.5">
                {language || t('chat.codeBlock.plaintext')}
            </span>
        </div>
        <div className="flex items-center gap-1.5">
            {isSpeaking ? (
                <button
                    onClick={onStop}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-primary"
                    title={t('workspace.stopSpeaking')}
                >
                    <VolumeX className="w-3.5 h-3.5" />
                </button>
            ) : (
                <button
                    onClick={onSpeak}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground"
                    title={t('workspace.speakCode')}
                >
                    <Volume2 className="w-3.5 h-3.5" />
                </button>
            )}
            <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground relative"
            >
                {copied ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                ) : (
                    <Copy className="w-3.5 h-3.5" />
                )}
            </button>
        </div>
    </div>
);

const FloatingActions: React.FC<{
    canExecute: boolean;
    isExecuting: boolean;
    handleExecute: () => void;
    t: (key: string) => string;
}> = ({ canExecute, isExecuting, handleExecute, t }) => (
    <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover/code:opacity-100 transition-all duration-300 transform translate-x-2 group-hover/code:translate-x-0 z-10">
        <AnimatePresence>
            {canExecute && (
                <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={isExecuting ? undefined : handleExecute}
                    className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xxs font-bold uppercase tracking-wider backdrop-blur-xl border transition-all shadow-lg',
                        isExecuting
                            ? 'bg-warning/20 border-warning/30 text-warning-light'
                            : 'bg-success/20 border-success/30 text-success-light hover:bg-success/30 active:scale-95'
                    )}
                >
                    {isExecuting ? (
                        <Square className="w-3 h-3 animate-pulse" />
                    ) : (
                        <Play className="w-3 h-3" />
                    )}
                    <span>
                        {isExecuting ? t('chat.codeBlock.running') : t('chat.codeBlock.execute')}
                    </span>
                </motion.button>
            )}
            <ActionButton
                icon={<Save className="w-3 h-3" />}
                label={t('chat.codeBlock.addToWorkspace')}
                delay={0.05}
                primary
            />
            <ActionButton
                icon={<ExternalLink className="w-3 h-3" />}
                label={t('chat.codeBlock.openInEditor')}
                delay={0.1}
            />
        </AnimatePresence>
    </div>
);

const ActionButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    delay: number;
    primary?: boolean;
}> = ({ icon, label, delay, primary }) => (
    <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay }}
        className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xxs font-bold uppercase tracking-wider backdrop-blur-xl border active:scale-95 transition-all shadow-lg',
            primary
                ? 'bg-primary/20 border-primary/30 text-primary-foreground hover:bg-primary/30'
                : 'bg-white/5 border-white/10 text-foreground/70 hover:bg-white/10'
        )}
    >
        {icon}
        <span>{label}</span>
    </motion.button>
);

const ExecutionOverlay: React.FC<{
    result: { output: string; error?: boolean } | null;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ result, onClose, t }) => (
    <AnimatePresence>
        {result && (
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={cn(
                    'px-4 py-3 text-xs font-mono border-t backdrop-blur-md',
                    result.error
                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                        : 'bg-success/5 border-success/10 text-success-light/80'
                )}
            >
                <div className="flex items-center justify-between mb-1 opacity-40">
                    <span className="text-xxxs uppercase font-bold tracking-widest">
                        {t('chat.codeBlock.output')}
                    </span>
                    <button onClick={onClose} className="hover:text-foreground transition-colors">
                        <Square className="w-3 h-3" />
                    </button>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{result.output}</div>
            </motion.div>
        )}
    </AnimatePresence>
);

MonacoBlock.displayName = 'MonacoBlock';
