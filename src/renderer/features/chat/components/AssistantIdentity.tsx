import React from 'react';

import LogoAntigravity from '@/assets/antigravity.svg';
import LogoOpenAI from '@/assets/chatgpt.svg';
import LogoClaude from '@/assets/claude.svg';
import LogoCopilot from '@/assets/copilot.png';
import LogoOllama from '@/assets/ollama.svg';
import { useTranslation } from '@/i18n';

interface AssistantIdentityProps {
    model?: string
    provider?: string
    backend?: string
}

interface BrandConfig {
    bgClass: string
    borderClass: string
    titleKey: string
    content: (label: string) => React.ReactNode
    extraImgClass?: string
}

type ProviderKey = 'openai' | 'anthropic' | 'antigravity' | 'copilot' | 'groq' | 'ollama';
type ModelKey = 'llama' | 'mistral' | 'deepseek' | 'qwen' | 'phi';

const PROVIDER_CONFIGS: Record<ProviderKey, BrandConfig> = {
    openai: { bgClass: 'bg-success/10', borderClass: 'border-success/10', titleKey: 'assistantIdentity.openai', content: (label) => <img src={LogoOpenAI} className="w-full h-full opacity-70" alt={label} /> },
    anthropic: { bgClass: 'bg-warning/10', borderClass: 'border-orange/10', titleKey: 'assistantIdentity.anthropic', content: (label) => <img src={LogoClaude} className="w-full h-full opacity-70" alt={label} /> },
    antigravity: { bgClass: 'bg-yellow/10', borderClass: 'border-yellow/10', titleKey: 'assistantIdentity.antigravity', content: (label) => <img src={LogoAntigravity} className="w-full h-full opacity-70" alt={label} /> },
    copilot: { bgClass: 'bg-background', borderClass: 'border-white/5', titleKey: 'assistantIdentity.copilot', content: (label) => <img src={LogoCopilot} className="w-full h-full object-cover opacity-70" alt={label} /> },
    groq: { bgClass: 'bg-warning/10', borderClass: 'border-orange/10', titleKey: 'assistantIdentity.groq', content: () => <span className="font-bold text-orange text-xxs">G</span> },
    ollama: { bgClass: 'bg-muted/30', borderClass: 'border-border/50', titleKey: 'assistantIdentity.ollama', content: (label) => <img src={LogoOllama} className="w-full h-full opacity-50" alt={label} /> },
};

const MODEL_CONFIGS: Record<ModelKey, BrandConfig> = {
    llama: { bgClass: 'bg-primary/10', borderClass: 'border-primary/10', titleKey: 'assistantIdentity.llama', content: () => <span className="font-black text-primary text-xxs">LL</span> },
    mistral: { bgClass: 'bg-warning/20', borderClass: 'border-orange/20', titleKey: 'assistantIdentity.mistral', content: () => <span className="font-black text-orange text-xxs">M</span> },
    deepseek: { bgClass: 'bg-indigo/20', borderClass: 'border-indigo/20', titleKey: 'assistantIdentity.deepseek', content: () => <span className="font-black text-indigo text-xxs">DS</span> },
    qwen: { bgClass: 'bg-purple/20', borderClass: 'border-purple/20', titleKey: 'assistantIdentity.qwen', content: () => <span className="font-black text-purple text-xxs">Q</span> },
    phi: { bgClass: 'bg-cyan/20', borderClass: 'border-cyan/20', titleKey: 'assistantIdentity.phi', content: () => <span className="font-black text-cyan text-xxs">Φ</span> },
};

const PROVIDER_MATCHERS: { keywords: string[]; key: ProviderKey }[] = [
    { keywords: ['openai', 'codex', 'gpt'], key: 'openai' },
    { keywords: ['anthropic', 'claude'], key: 'anthropic' },
    { keywords: ['antigravity'], key: 'antigravity' },
    { keywords: ['github', 'copilot'], key: 'copilot' },
    { keywords: ['groq'], key: 'groq' },
];

const MODEL_MATCHERS: { keywords: string[]; key: ModelKey }[] = [
    { keywords: ['llama'], key: 'llama' },
    { keywords: ['mistral', 'mixtral'], key: 'mistral' },
    { keywords: ['deepseek'], key: 'deepseek' },
    { keywords: ['qwen'], key: 'qwen' },
    { keywords: ['phi'], key: 'phi' },
];

function inferProvider(modelName: string): string {
    if (modelName.startsWith('gpt-') || modelName.startsWith('o1-')) { return 'openai'; }
    if (modelName.startsWith('claude-')) { return 'anthropic'; }
    if (modelName.startsWith('grok-')) { return 'groq'; }
    if (modelName.startsWith('antigravity-')) { return 'antigravity'; }
    return '';
}

function findConfig(provider: string, modelName: string): BrandConfig {
    for (const m of PROVIDER_MATCHERS) {
        if (m.keywords.some(k => provider.includes(k))) { return PROVIDER_CONFIGS[m.key]; }
    }
    for (const m of MODEL_MATCHERS) {
        if (m.keywords.some(k => modelName.includes(k))) { return MODEL_CONFIGS[m.key]; }
    }
    return PROVIDER_CONFIGS.ollama;
}

const BrandIcon: React.FC<{ config: BrandConfig }> = ({ config }) => {
    const { t } = useTranslation();
    const label = t(config.titleKey);

    return (
        <div className={`w-6 h-6 rounded-md ${config.bgClass} border ${config.borderClass} flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1`} title={label}>
            {config.content(label)}
        </div>
    );
};

export const AssistantIdentity: React.FC<AssistantIdentityProps> = ({ model, provider, backend }) => {
    const modelName = (model ?? '').toLowerCase();
    const inferred = inferProvider(modelName);
    const p = (provider ?? backend ?? (inferred !== '' ? inferred : 'ollama')).toLowerCase();
    const config = findConfig(p, modelName);

    return <BrandIcon config={config} />;
};
