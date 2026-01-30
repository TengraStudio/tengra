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

/**
 * AssistantIdentity Component
 * 
 * Renders the appropriate branding icon based on the model or provider.
 */
export const AssistantIdentity: React.FC<AssistantIdentityProps> = ({ model, provider, backend }) => {
    const modelName = (model ?? '').toString().toLowerCase();
    const inferredProvider = modelName.startsWith('gpt-') || modelName.startsWith('o1-')
        ? 'openai'
        : modelName.startsWith('claude-')
            ? 'anthropic'

            : modelName.startsWith('grok-')
                ? 'groq'
                : modelName.startsWith('antigravity-')
                    ? 'antigravity'
                    : '';

    const p = (provider ?? backend ?? inferredProvider ?? 'ollama').toLowerCase();

    // OpenAI / ChatGPT / Codex
    if (p.includes('openai') || p.includes('codex') || p.includes('gpt')) {
        return (
            <div className="w-6 h-6 rounded-md bg-success/10 border border-success/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="OpenAI">
                <img src={LogoOpenAI} className="w-full h-full opacity-70" alt="OpenAI" />
            </div>
        );
    }

    // Anthropic / Claude
    if (p.includes('anthropic') || p.includes('claude')) {
        return (
            <div className="w-6 h-6 rounded-md bg-orange/10 border border-orange/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Claude">
                <img src={LogoClaude} className="w-full h-full opacity-70" alt="Claude" />
            </div>
        );
    }



    // Local Model Families
    if (modelName.includes('llama')) {
        return (
            <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Llama Family">
                <span className="font-black text-primary text-[10px]">LL</span>
            </div>
        );
    }
    if (modelName.includes('mistral') || modelName.includes('mixtral')) {
        return (
            <div className="w-6 h-6 rounded-md bg-orange/20 border border-orange/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Mistral Family">
                <span className="font-black text-orange text-[10px]">M</span>
            </div>
        );
    }
    if (modelName.includes('deepseek')) {
        return (
            <div className="w-6 h-6 rounded-md bg-indigo/20 border border-indigo/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="DeepSeek">
                <span className="font-black text-indigo text-[10px]">DS</span>
            </div>
        );
    }
    if (modelName.includes('qwen')) {
        return (
            <div className="w-6 h-6 rounded-md bg-purple/20 border border-purple/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Qwen">
                <span className="font-black text-purple text-[10px]">Q</span>
            </div>
        );
    }
    if (modelName.includes('phi')) {
        return (
            <div className="w-6 h-6 rounded-md bg-cyan/20 border border-cyan/20 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Phi">
                <span className="font-black text-cyan text-[10px]">Î¦</span>
            </div>
        );
    }

    // Specialized Providers
    if (p.includes('antigravity')) {
        return (
            <div className="w-6 h-6 rounded-md bg-yellow/10 border border-yellow/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Antigravity">
                <img src={LogoAntigravity} className="w-full h-full opacity-70" alt="Antigravity" />
            </div>
        );
    }
    if (p.includes('github') || p.includes('copilot')) {
        return (
            <div className="w-6 h-6 rounded-md bg-background border border-white/5 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1">
                <img src={LogoCopilot} className="w-full h-full object-cover opacity-70" alt="Copilot" />
            </div>
        );
    }
    if (p.includes('groq')) {
        return (
            <div className="w-6 h-6 rounded-md bg-orange/10 border border-orange/10 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1">
                <span className="font-bold text-orange text-[10px]">G</span>
            </div>
        );
    }

    // Default Fallback (Ollama)
    return (
        <div className="w-6 h-6 rounded-md bg-muted/30 border border-border/50 flex items-center justify-center shrink-0 mt-1.5 overflow-hidden p-1" title="Ollama/Local">
            <img src={LogoOllama} className="w-full h-full opacity-50" alt="Ollama" />
        </div>
    );
};
