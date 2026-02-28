import { ProxyService } from '@main/services/proxy/proxy.service';
import { SettingsService } from '@main/services/system/settings.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { JsonObject } from '@shared/types/common';
import { ToolDefinition } from '@shared/types/chat';
import { AuthenticationError } from '@shared/utils/error.util';

/** Route configuration for a provider request. */
export interface RouteConfig {
    model: string;
    tools?: ToolDefinition[];
    baseUrl?: string;
    apiKey?: string;
    provider: string;
    temperature?: number;
    projectRoot?: string;
}

/**
 * Resolves the provider name from a model name or explicit provider.
 */
export function resolveProvider(model: string, provider?: string): string {
    const normalizedProvider = provider?.trim().toLowerCase();
    if (normalizedProvider) {
        if (normalizedProvider === 'claude') { return 'anthropic'; }
        return normalizedProvider;
    }

    const m = model.trim().toLowerCase();
    if (m.includes('codex') || m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3')) {
        return 'codex';
    }
    if (m.startsWith('claude-') || m.startsWith('anthropic/')) { return 'anthropic'; }
    if (m.startsWith('gemini-') || m.startsWith('google/')) { return 'google'; }
    if (m.startsWith('ollama/')) { return 'ollama'; }
    return 'openai';
}

/**
 * Maps user-facing provider names to AMP proxy provider identifiers.
 */
function toAmpProvider(provider: string): string {
    const p = provider.trim().toLowerCase();
    if (p === 'claude') { return 'anthropic'; }
    if (p === 'gemini') { return 'google'; }
    if (p === 'codex' || p === 'openai' || p === 'anthropic' || p === 'google' || p === 'antigravity') { return p; }
    return 'openai';
}

/**
 * Normalizes a model name by stripping provider prefixes.
 */
export function normalizeModelName(model: string, provider?: string): string {
    const lowerProvider = (provider ?? '').toLowerCase();
    let target = model;

    const prefixes: Record<string, string[]> = {
        'ollama': ['ollama/'],
        'anthropic': ['anthropic/', 'claude/'],
        'claude': ['anthropic/', 'claude/'],
        'openai': ['openai/'],
        'codex': ['codex/', 'openai/'],
        'google': ['google/', 'gemini/'],
        'nvidia': ['nvidia/'],
        'gemini': ['google/', 'gemini/'],
    };

    const providerPrefixes = (prefixes as Record<string, string[] | undefined>)[lowerProvider];
    if (providerPrefixes !== undefined) {
        for (const prefix of providerPrefixes) {
            if (target.startsWith(prefix)) {
                target = target.slice(prefix.length);
                break;
            }
        }
    }

    // Antigravity proxy requires prefix
    if (lowerProvider === 'antigravity' && !target.startsWith('antigravity/')) {
        target = `antigravity/${target}`;
    }

    return target;
}

/**
 * Gets OpenAI-compatible settings (base URL and API key).
 */
export function getOpenAISettings(
    baseUrlOverride: string | undefined,
    apiKeyOverride: string | undefined,
    provider: string | undefined,
    defaultBaseUrl: string,
    defaultApiKey: string,
    keyRotationService: KeyRotationService
): { baseUrl: string; apiKey: string } {
    const baseUrl = baseUrlOverride ?? defaultBaseUrl;
    const keyProvider = (provider === 'openai' || !provider) ? 'openai' : provider;
    const apiKey = apiKeyOverride ?? keyRotationService.getCurrentKey(keyProvider) ?? defaultApiKey;

    if (!apiKey && !baseUrl.match(/(localhost|127\.0\.0\.1)/)) {
        throw new AuthenticationError('OpenAI API Key not set');
    }
    return { baseUrl, apiKey };
}

/**
 * Builds route configuration for a given provider.
 */
export async function getRouteConfig(
    provider: string,
    model: string,
    tools: ToolDefinition[] | undefined,
    options: { temperature?: number; projectRoot?: string } | undefined,
    deps: {
        proxyService: ProxyService;
        settingsService: SettingsService;
        getNvidiaKey: () => string;
    }
): Promise<RouteConfig> {
    const p = provider.toLowerCase();
    const temp = options?.temperature;
    const projectRoot = options?.projectRoot;

    if (p.includes('nvidia')) {
        return { model, tools, baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: deps.getNvidiaKey(), provider: 'nvidia', temperature: temp, projectRoot };
    }

    if (p.includes('antigravity')) {
        const proxyUrl = buildProxyBaseUrl('antigravity', deps.proxyService);
        const proxyKey = await deps.proxyService.getProxyKey();
        return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider, temperature: temp, projectRoot };
    }

    if (p.includes('ollama')) {
        const settings = deps.settingsService.getSettings();
        const ollamaUrl = (settings['ollama'] as JsonObject | undefined)?.url ?? 'http://localhost:11434';
        const ollamaBaseUrl = `${(ollamaUrl as string).replace(/\/$/, '')}/v1`;
        return { model, tools, baseUrl: ollamaBaseUrl, apiKey: 'ollama', provider, temperature: temp, projectRoot };
    }

    if (p.includes('codex') || p.includes('openai')) {
        const proxyUrl = buildProxyBaseUrl(toAmpProvider(provider), deps.proxyService);
        const proxyKey = await deps.proxyService.getProxyKey();
        return { model, tools, baseUrl: proxyUrl, apiKey: proxyKey, provider, temperature: temp, projectRoot };
    }

    return { model, tools, provider, temperature: temp, projectRoot, baseUrl: undefined, apiKey: undefined };
}

/** Builds the embedded proxy base URL for a given provider. */
function buildProxyBaseUrl(ampProvider: string, proxyService: ProxyService): string {
    const proxyStatus = proxyService.getEmbeddedProxyStatus();
    const port = proxyStatus.port ?? 8317;
    return `http://localhost:${port}/api/provider/${ampProvider}/v1`;
}
