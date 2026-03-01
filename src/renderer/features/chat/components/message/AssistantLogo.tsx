import { memo } from 'react';

import LogoAntigravity from '@/assets/antigravity.svg';
import LogoOpenAI from '@/assets/chatgpt.svg';
import LogoClaude from '@/assets/claude.svg';
import LogoCopilot from '@/assets/copilot.png';
import LogoOllama from '@/assets/ollama.svg';
import { cn } from '@/lib/utils';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

interface MessageIconProps {
    short: string;
    color: string;
    title: string;
}

const MessageIcon = ({ short, color, title }: MessageIconProps) => (
    <div
        className={cn(
            'w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1',
            `bg-${color}-500/10 border-${color}-500/10`
        )}
        title={title}
    >
        <span className={cn('font-black text-xxs', `text-${color}-400`)}>{short}</span>
    </div>
);

const getSpecialModelLogo = (name: string, t: TranslationFn) => {
    const families = [
        { key: 'llama', short: 'LL', color: 'blue', title: t('messageBubble.modelFamilies.llama') },
        { key: 'mistral', short: 'M', color: 'orange', title: t('messageBubble.modelFamilies.mistral') },
        { key: 'mixtral', short: 'M', color: 'orange', title: t('messageBubble.modelFamilies.mistral') },
        { key: 'deepseek', short: 'DS', color: 'indigo', title: t('messageBubble.modelFamilies.deepseek') },
        { key: 'qwen', short: 'Q', color: 'purple', title: t('messageBubble.modelFamilies.qwen') },
        { key: 'phi', short: 'Φ', color: 'cyan', title: t('messageBubble.modelFamilies.phi') },
    ];
    const match = families.find(f => name.includes(f.key));
    if (match) {
        return { short: match.short, color: match.color, title: match.title };
    }
    return null;
};

const getInferredProvider = (name: string) => {
    if (name.startsWith('gpt-') || name.startsWith('o1-')) {return 'openai';}
    if (name.startsWith('claude-')) {return 'anthropic';}
    if (name.startsWith('grok-')) {return 'groq';}
    if (name.startsWith('antigravity-')) {return 'antigravity';}
    return null;
};

const getProviderLogoInfo = (modelName: string, provider?: string, backend?: string) => {
    const name = modelName.toLowerCase();
    const inferred = getInferredProvider(name);
    const effective = (provider ?? backend ?? inferred ?? 'ollama').toLowerCase();

    const logoMap: Record<string, { logo: string | null; key: string; color: string; short?: string }> = {
        openai: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        codex: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        gpt: { logo: LogoOpenAI, key: 'openai', color: 'emerald' },
        anthropic: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        claude: { logo: LogoClaude, key: 'anthropic', color: 'orange' },
        antigravity: { logo: LogoAntigravity, key: 'antigravity', color: 'yellow' },
        github: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        copilot: { logo: LogoCopilot, key: 'copilot', color: 'black' },
        groq: { logo: null, key: 'groq', color: 'red', short: 'G' },
    };

    const matchedKey = Object.keys(logoMap).find(k => effective.includes(k));
    if (matchedKey) {return logoMap[matchedKey];}
    return { logo: LogoOllama, key: effective, color: 'muted' };
};

export interface AssistantLogoProps {
    displayModel?: string;
    provider?: string;
    backend?: string;
    t: TranslationFn;
}

/**
 * AssistantLogo component
 * 
 * Renders the logo for the AI assistant based on the model, provider, or backend.
 */
export const AssistantLogo = memo(({ displayModel, provider, backend, t }: AssistantLogoProps) => {
    const modelName = (displayModel ?? '').toString().toLowerCase();
    const special = getSpecialModelLogo(modelName, t);
    if (special) {
        return <MessageIcon {...special} />;
    }
    const info = getProviderLogoInfo(modelName, provider, backend);
    if (info.logo) {
        return (
            <div
                className={cn(
                    'w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1',
                    `bg-${info.color}-500/10 border-${info.color}-500/10`
                )}
                title={info.key.toUpperCase()}
            >
                <img src={info.logo} className="w-full h-full opacity-70" alt={info.key} />
            </div>
        );
    }
    return (
        <MessageIcon
            short={info.short ?? t('common.ai')}
            color={info.color}
            title={info.key.toUpperCase()}
        />
    );
});

AssistantLogo.displayName = 'AssistantLogo';
