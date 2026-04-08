import { Check, Copy } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import React, { memo, useState } from 'react';

import { Language, useTranslation } from '@/i18n'; 
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
    className?: string;
    children?: React.ReactNode;
    code?: string;
    language?: string;
    isSpeaking?: boolean | undefined;
    onSpeak?: ((text: string) => void) | undefined;
    onStop?: (() => void) | undefined;
    i18nLanguage?: Language | undefined;
    t?: (key: string, options?: Record<string, string | number>) => string;
}

export const MonacoBlock = memo<MonacoBlockProps>(
    ({
        className,
        children,
        code: propCode,
        language: propLanguage,
        isSpeaking,
        onSpeak,
        onStop,
        i18nLanguage = 'en',
        t: tProp,
    }) => {
        const { t: i18nT } = useTranslation(i18nLanguage);
        const t = tProp ?? i18nT;

        const match = /language-(\w+)/.exec(className ?? '');
        const language = propLanguage ?? match?.[1] ?? 'text';
        const code = propCode ?? String(children).replace(/\n$/, '');

        const [copied, setCopied] = useState(false); 

        const handleCopy = () => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }; 

        const highlightLanguage = getHighlightLanguage(language); 

        return (
            <div className=" border border-border/30 bg-card group/code transition-all duration-300 shadow-xl relative">
                <BlockHeader
                    language={language}
                    isSpeaking={isSpeaking}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    handleCopy={handleCopy}
                    copied={copied}
                    code={code}
                    t={t}
                />
                <div className="relative w-full">
                    <Highlight theme={themes.vsDark} code={code} language={highlightLanguage}>
                        {({ style, tokens, getLineProps, getTokenProps }) => (
                            <pre
                                className="m-0 h-full w-full overflow-auto p-4 leading-relaxed"
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
                </div> 
            </div>
        );
    }
);

const BlockHeader: React.FC<{
    language: string;
    isSpeaking?: boolean;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    handleCopy: () => void;
    copied: boolean;
    code: string;
    t: (key: string, options?: Record<string, string | number>) => string;
}> = ({ language, handleCopy, copied }) => (
    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/40 backdrop-blur-md">
        <div className="flex items-center gap-2">
            <span className="text-xxs text-muted-foreground font-bold opacity-60 group-hover/code:opacity-100 transition-opacity flex items-center gap-1.5">
                {language}
            </span>
        </div>
        <div className="flex items-center gap-1.5">
            <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-muted/40 rounded-md transition-colors text-muted-foreground hover:text-foreground relative"
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
 
MonacoBlock.displayName = 'MonacoBlock';
