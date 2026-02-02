import React from 'react';

import LogoAntigravity from '@/assets/antigravity.svg';
import LogoOpenAI from '@/assets/chatgpt.svg';
import LogoClaude from '@/assets/claude.svg';
import LogoCopilot from '@/assets/copilot.png';
import LogoOllama from '@/assets/ollama.svg';

interface AssistantIdentityProps {
    model?: string
    provider?: string
    backend?: string
}

interface BrandConfig {
    bgClass: string
    borderClass: string
    title: string
    content: React.ReactNode
    extraImgClass?: string
}

type ProviderKey = 'openai' | 'anthropic' | 'antigravity' | 'copilot' | 'groq' | 'ollama';
type ModelKey = 'llama' | 'mistral' | 'deepseek' | 'qwen' | 'phi';

const PROVIDER_CONFIGS: Record<ProviderKey, BrandConfig> = {
    openai: { bgClass: 'bg-success/10', borderClass: 'border-success/10', title: 'OpenAI', content: <img src={LogoOpenAI} className="w-full h-full opacity-70" alt="OpenAI" /> },
    anthropic: { bgClass: 'bg-orange/10', borderClass: 'border-orange/10', title: 'Claude', content: <img src={LogoClaude} className="w-full h-full opacity-70" alt="Claude" /> },
    antigravity: { bgClass: 'bg-yellow/10', borderClass: 'border-yellow/10', title: 'Antigravity', content: <img src={LogoAntigravity} className="w-full h-full opacity-70" alt="Antigravity" /> },
    copilot: { bgClass: 'bg-background', borderClass: 'border-white/5', title: 'Copilot', content: <img src={LogoCopilot} className="w-full h-full object-cover opacity-70" alt="Copilot" /> },
    groq: { bgClass: 'bg-orange/10', borderClass: 'border-orange/10', title: 'Groq', content: <span className="font-bold text-orange text-[10px]">G</span> },
    ollama: { bgClass: 'bg-muted/30', borderClass: 'border-border/50', title: 'Ollama/Local', content: <img src={LogoOllama} className="w-full h-full opacity-50" alt="Ollama" /> },
};

const MODEL_CONFIGS: Record<ModelKey, BrandConfig> = {
    llama: { bgClass: 'bg-primary/10', borderClass: 'border-primary/10', title: 'Llama Family', content: <span className="font-black text-primary text-[10px]">LL</span> },
    mistral: { bgClass: 'bg-orange/20', borderClass: 'border-orange/20', title: 'Mistral Family', content: <span className="font-black text-orange text-[10px]">M</span> },
    deepseek: { bgClass: 'bg-indigo/20', borderClass: 'border-indigo/20', title: 'DeepSeek', content: <span className="font-black text-indigo text-[10px]">DS</span> },
    qwen: { bgClass: 'bg-purple/20', borderClass: 'border-purple/20', title: 'Qwen', content: <span className="font-black text-purple text-[10px]">Q</span> },
    phi: { bgClass: 'bg-cyan/20', borderClass: 'border-cyan/20', title: 'Phi', content: <span className="font-black text-cyan text-[10px]">Φ</span> },
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

const BrandIcon: React.FC<{ config: BrandConfig }> = ({ config }) => (
    <div className={`w-6 h-6 rounded-md ${config.bgClass} border ${config.borderClass} flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1`} title={config.title}>
        {config.content}
    </div>
);

export const AssistantIdentity: React.FC<AssistantIdentityProps> = ({ model, provider, backend }) => {
    const modelName = (model ?? '').toLowerCase();
    const inferred = inferProvider(modelName);
    const p = (provider ?? backend ?? (inferred !== '' ? inferred : 'ollama')).toLowerCase();
    const config = findConfig(p, modelName);

    return <BrandIcon config={config} />;
};
