/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    AiEvidenceEntry,
    AiEvidenceRecord,
    AiEvidenceSatisfaction,
    AiEvidenceScope,
    AiEvidenceSourceSurface,
    AiIntentClassification,
    AiIntentType,
    AiPresentationContext,
    AiPresentationMetadata,
    AiRuntimeSystemMode,
    AiToolLoopBudget,
} from '@shared/types/ai-runtime';

import { Message, ToolCall } from '../types/chat';

const MAX_REASONING_SUMMARY_LENGTH = 240;

function getIntentValue(intent: AiIntentClassification | AiIntentType): AiIntentType {
    return typeof intent === 'string' ? intent : intent.intent;
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function summarizeReasoning(reasoning?: string): string | undefined {
    if (!reasoning) {
        return undefined;
    }
    const normalized = normalizeWhitespace(reasoning);
    if (normalized.length === 0) {
        return undefined;
    }
    if (normalized.length <= MAX_REASONING_SUMMARY_LENGTH) {
        return normalized;
    }
    return `${normalized.slice(0, MAX_REASONING_SUMMARY_LENGTH).trimEnd()}...`;
}

function getToolNames(toolCalls?: ToolCall[]): string[] | undefined {
    if (!toolCalls || toolCalls.length === 0) {
        return undefined;
    }
    const names = Array.from(new Set(
        toolCalls
            .map(toolCall => toolCall.function?.name)
            .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    ));
    return names.length > 0 ? names : undefined;
}

function getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function isToolResultObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTurkishLanguage(language?: string): boolean {
    const normalized = (language ?? '').trim().toLowerCase();
    return normalized === 'tr' || normalized.startsWith('tr-');
}

export function buildAiEvidenceEntries(context: AiPresentationContext): AiEvidenceEntry[] {
    const entries: AiEvidenceEntry[] = [];

    // Tool results
    for (const toolResult of context.toolResults ?? []) {
        const resultObject = isToolResultObject(toolResult.result) ? toolResult.result : undefined;
        const reused = resultObject
            ? resultObject._reused === true
            : false;

        const path = resultObject ? getString(resultObject.path) : undefined;
        const displaySummary = resultObject ? getString(resultObject.displaySummary) : undefined;
        const errorSummary = toolResult.error
            ? `${toolResult.name} failed: ${toolResult.error}`
            : undefined;

        entries.push({
            kind: 'tool_result',
            toolName: toolResult.name,
            reused,
            path,
            summary: displaySummary ?? errorSummary,
        });
    }

    // Sources
    for (const source of context.sources ?? []) {
        entries.push({
            kind: 'source',
            summary: source // We keep the raw source path/url as summary since it's the identifier
        });
    }

    // Images
    for (const image of context.images ?? []) {
        entries.push({
            kind: 'image',
            summary: image
        });
    }

    const normalizedContent = context.content.trim();
    if (normalizedContent.length > 0) {
        entries.push({
            kind: 'content'
        });
    }

    return entries;
}

function getFileExistsValue(result: NonNullable<AiPresentationContext['toolResults']>[number]['result']): boolean | undefined {
    if (typeof result === 'boolean') {
        return result;
    }
    if (!isToolResultObject(result)) {
        return undefined;
    }
    return getBoolean(result.exists) ?? getBoolean(result.pathExists);
}

function summarizeToolDisplayResults(context: AiPresentationContext): string[] {
    const summaries: string[] = [];
    for (const toolResult of context.toolResults ?? []) {
        if (!isToolResultObject(toolResult.result)) {
            continue;
        }
        const summary = getString(toolResult.result.displaySummary);
        if (!summary) {
            continue;
        }
        summaries.push(summary);
    }
    return summaries;
}

function truncateCommandOutput(value: string): string {
    const normalized = value.trim();
    if (normalized.length <= 1200) {
        return normalized;
    }
    return `${normalized.slice(0, 1200).trimEnd()}...`;
}

export function composeDeterministicAnswer(context: AiPresentationContext): string | undefined {
    const toolResults = context.toolResults ?? [];
    if (toolResults.length === 0) {
        return undefined;
    }

    const isTurkish = isTurkishLanguage(context.language);
    const intent = getIntentValue(context.intent);

    for (const toolResult of toolResults) {
        if (toolResult.name !== 'list_directory' || !isToolResultObject(toolResult.result)) {
            continue;
        }
        const path = getString(toolResult.result.path);
        const entryCount = getNumber(toolResult.result.entryCount);
        const fileCount = getNumber(toolResult.result.fileCount);
        const directoryCount = getNumber(toolResult.result.directoryCount);
        if (path && entryCount !== undefined && fileCount !== undefined && directoryCount !== undefined) {
            return isTurkish
                ? `\`${path}\` konumunda ${fileCount} dosya ve ${directoryCount} klasor var. Toplam ${entryCount} oge listelendi.`
                : `\`${path}\` contains ${fileCount} files and ${directoryCount} folders. ${entryCount} total entries were listed.`;
        }
    }

    for (const toolResult of toolResults) {
        if (toolResult.name !== 'resolve_path' || !isToolResultObject(toolResult.result)) {
            continue;
        }
        const path = getString(toolResult.result.path);
        const pathExists = getBoolean(toolResult.result.pathExists);
        const parentExists = getBoolean(toolResult.result.parentExists);
        if (!path) {
            continue;
        }
        if (pathExists === true) {
            return isTurkish
                ? `\`${path}\` yolu mevcut.`
                : `The resolved path exists: \`${path}\`.`;
        }
        if (pathExists === false && parentExists === true) {
            return isTurkish
                ? `\`${path}\` yolu henuz mevcut degil ama ust dizin erisilebilir.`
                : `The resolved path does not exist yet, but its parent directory is accessible: \`${path}\`.`;
        }
    }

    for (const toolResult of toolResults) {
        if (toolResult.name !== 'file_exists') {
            continue;
        }
        const exists = getFileExistsValue(toolResult.result);
        if (exists !== undefined) {
            return isTurkish
                ? (exists ? 'Istenen yol mevcut.' : 'Istenen yol mevcut degil.')
                : (exists ? 'The requested path exists.' : 'The requested path does not exist.');
        }
    }

    const displaySummaries = summarizeToolDisplayResults(context);
    if (displaySummaries.length > 0) {
        const relevantSummaries = displaySummaries.slice(-3);
        if (intent === 'agentic_workflow') {
            return isTurkish
                ? `Tamamlanan arac islemleri: ${relevantSummaries.join(' | ')}`
                : `Completed tool work: ${relevantSummaries.join(' | ')}`;
        }
        return relevantSummaries[relevantSummaries.length - 1];
    }

    for (const toolResult of [...toolResults].reverse()) {
        if (toolResult.name !== 'execute_command' || !isToolResultObject(toolResult.result)) {
            continue;
        }
        const stdout = getString(toolResult.result.stdout);
        const stderr = getString(toolResult.result.stderr);
        if (stdout) {
            const output = truncateCommandOutput(stdout);
            return isTurkish
                ? `Komut tamamlandi. Cikti:\n\n\`\`\`text\n${output}\n\`\`\``
                : `The command completed. Output:\n\n\`\`\`text\n${output}\n\`\`\``;
        }
        if (stderr) {
            const output = truncateCommandOutput(stderr);
            return isTurkish
                ? `Komut hata ciktisi uretmis:\n\n\`\`\`text\n${output}\n\`\`\``
                : `The command produced error output:\n\n\`\`\`text\n${output}\n\`\`\``;
        }
    }

    const latestError = [...toolResults].reverse().find(result =>
        typeof result.error === 'string' && result.error.trim().length > 0
    );
    if (latestError?.error) {
        return isTurkish
            ? `Arac calismadi: ${latestError.error}`
            : `The tool failed: ${latestError.error}`;
    }

    return undefined;
}

function getMessageText(message: Message): string {
    if (typeof message.content === 'string') {
        return normalizeWhitespace(message.content).toLowerCase();
    }

    return normalizeWhitespace(
        message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join(' ')
    ).toLowerCase();
}

function isLikelySingleLookupPrompt(message: Message): boolean {
    const text = getMessageText(message);
    if (!text) {
        return false;
    }

    const lookupSignals = [
        'masaüst', 'masaustu', 'desktop', 'dosya', 'file', 'folder', 'klasor', 'klasör', 'directory', 'dizin', '%userprofile%',
    ];
    const actionSignals = [
        'kaç', 'kac', 'how many', 'liste', 'list', 'show', 'goster', 'göster', 'count', 'var mi', 'var mı', 'exist',
    ];

    const hasLookupSignal = lookupSignals.some(signal => text.includes(signal));
    const hasActionSignal = actionSignals.some(signal => text.includes(signal));
    return hasLookupSignal && hasActionSignal;
}

function isLikelyAgenticWorkPrompt(message: Message): boolean {
    const text = getMessageText(message);
    if (!text) {
        return false;
    }

    const imageSignals = ['görsel', 'gorsel', 'resim', 'image', 'photo', 'logo', 'poster'];
    const actionSignals = [
        'oluştur', 'olustur', 'yarat', 'kur', 'yap', 'hazırla', 'hazirla', 'create', 'build', 'implement', 'scaffold', 'write',
    ];
    const codeOrProjectSignals = [
        'nextjs', 'next.js', 'react', 'vite', 'todo app', 'uygulama', 'application', 'component', 'proje', 'project', 'web app', 'site',
    ];
    const filesystemSignals = [
        'projects', 'desktop', 'masaüst', 'masaustu', 'klasör', 'klasor', 'folder', 'dosya', 'file', 'kaydet', 'koy',
    ];

    const isImageRequest = imageSignals.some(signal => text.includes(signal));
    if (isImageRequest) {
        return false;
    }

    const hasAction = actionSignals.some(signal => text.includes(signal));
    const hasCodeOrProject = codeOrProjectSignals.some(signal => text.includes(signal));
    const hasFilesystemTarget = filesystemSignals.some(signal => text.includes(signal));
    return hasAction && (hasCodeOrProject || hasFilesystemTarget);
}

export function classifyAiIntent(message: Message, systemMode: AiRuntimeSystemMode): AiIntentClassification {
    const isAgent = systemMode === 'agent';
    const isThinking = systemMode === 'thinking' || systemMode === 'architect';
    const isSingleLookup = isLikelySingleLookupPrompt(message);
    const isAgenticWork = isLikelyAgenticWorkPrompt(message);

    if (isAgenticWork) {
        return {
            intent: 'agentic_workflow',
            confidence: 'high',
            systemMode,
            requiresTooling: true,
            preferredMaxModelTurns: isAgent ? 999 : 24,
            preferredMaxToolTurns: isAgent ? 999 : 16,
        };
    }

    if (isSingleLookup) {
        return {
            intent: 'single_lookup',
            confidence: 'high',
            systemMode,
            requiresTooling: true,
            preferredMaxModelTurns: isAgent ? 12 : 4,
            preferredMaxToolTurns: isAgent ? 6 : 2,
        };
    }

    if (isThinking) {
        return {
            intent: 'direct_answer',
            confidence: 'medium',
            systemMode,
            requiresTooling: false,
            preferredMaxModelTurns: 16,
            preferredMaxToolTurns: 0,
        };
    }

    return {
        intent: 'direct_answer',
        confidence: 'high',
        systemMode,
        requiresTooling: false,
        preferredMaxModelTurns: 999,
        preferredMaxToolTurns: 0,
    };
}

export function getAiToolLoopBudget(classification: AiIntentClassification): AiToolLoopBudget {
    const noProgressThreshold = classification.intent === 'agentic_workflow'
        ? 5
        : classification.intent === 'multi_lookup'
            ? 3
            : 2;
    const maxModelTurnCap = classification.intent === 'agentic_workflow'
        ? 96
        : classification.intent === 'multi_lookup'
            ? 48
            : 32;
    const maxToolTurnCap = classification.intent === 'agentic_workflow'
        ? 64
        : classification.intent === 'multi_lookup'
            ? 24
            : 16;
    const maxModelTurns = Math.max(1, Math.min(classification.preferredMaxModelTurns, maxModelTurnCap));
    const maxExecutedToolTurns = Math.max(0, Math.min(classification.preferredMaxToolTurns, maxToolTurnCap));
    return {
        maxModelTurns,
        maxExecutedToolTurns,
        noProgressThreshold,
    };
}

export function normalizeToolSignatureValue(value: unknown, parentKey?: string): unknown {
    if (typeof value === 'string') {
        const normalizeEnvSyntax = (input: string): string => input
            .replace(/^~(?=[\\/]|$)/u, '%USERPROFILE%')
            .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/gu, (_match, envName: string) => `%${envName.toUpperCase()}%`)
            .replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gu, (_match, envName: string) => `%${envName.toUpperCase()}%`);
        if (parentKey === 'command') {
            return normalizeWhitespace(normalizeEnvSyntax(value))
                .replace(/\\/g, '/')
                .replace(/!\s*\(/gu, '-not (')
                .trim();
        }
        const normalized = parentKey && /(path|cwd|source|destination)$/i.test(parentKey)
            ? normalizeEnvSyntax(value).replace(/\\/g, '/').replace(/\/+/g, '/')
            : value;
        return normalized.trim();
    }
    if (Array.isArray(value)) {
        return value.map(entry => normalizeToolSignatureValue(entry, parentKey));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }
    const objectValue = value as Record<string, unknown>;
    const sortedKeys = Object.keys(objectValue).sort((left, right) => left.localeCompare(right));
    const normalizedObject: Record<string, unknown> = {};
    for (const key of sortedKeys) {
        normalizedObject[key] = normalizeToolSignatureValue(objectValue[key], key);
    }
    return normalizedObject;
}

export function calculateToolCallSignature(toolCalls: NonNullable<Message['toolCalls']>): string {
    return toolCalls
        .map(toolCall => {
            const name = toolCall.function.name;
            let args = toolCall.function.arguments;
            try {
                const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
                args = JSON.stringify(normalizeToolSignatureValue(parsedArgs));
            } catch {
                args = typeof args === 'string' ? args : JSON.stringify(args);
            }
            return `${name}:${args}`;
        })
        .sort()
        .join('|');
}

export function isLowSignalProgressContent(content: string): boolean {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return false;
    }

    const normalized = normalizeWhitespace(trimmed).toLowerCase();
    const lowSignalProgressPatterns = [
        /\bkontrol ediyorum\b/,
        /\binceliyorum\b/,
        /\bbakiyorum\b/,
        /\bbakıyorum\b/,
        /\bchecking\b/,
        /\binspecting\b/,
        /\bto verify or determine\b/,
        /\bi'?ll use the .* folder by default\b/,
        /\bwhere to place the project\b/,
        /\bworking on it\b/,
        /\bprocessing\b/,
        /\bone moment\b/,
        /\bjust a second\b/,
    ];

    const matchesPattern = lowSignalProgressPatterns.some(pattern => pattern.test(normalized));
    if (matchesPattern) {
        return true;
    }

    return trimmed.length < 10;
}

export function inferAiIntentFromAssistantState(context: Pick<
    AiPresentationContext,
    'content' | 'toolCalls' | 'toolResults' | 'images' | 'sources'
>): AiIntentType {
    if ((context.images?.length ?? 0) > 0) {
        return 'creative_generation';
    }

    if ((context.toolCalls?.length ?? 0) > 0 || (context.toolResults?.length ?? 0) > 0) {
        const hasFilesystemEvidence = (context.toolResults ?? []).some(toolResult =>
            toolResult.name === 'list_directory'
            || toolResult.name === 'file_exists'
            || toolResult.name === 'resolve_path'
        );
        return hasFilesystemEvidence ? 'single_lookup' : 'multi_lookup';
    }

    if ((context.sources?.length ?? 0) > 0) {
        return 'multi_lookup';
    }

    return 'direct_answer';
}

export function createEvidenceRecord(
    entry: AiEvidenceEntry,
    scope: AiEvidenceScope = 'turn',
    surface: AiEvidenceSourceSurface = 'chat',
    rawContent?: string
): AiEvidenceRecord {
    return {
        ...entry,
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        scope,
        isReusable: entry.reused !== true,
        sourceSurface: surface,
        satisfactionScore: 0.7,
        rawContent,
    };
}

export function dedupeEvidenceRecords(records: AiEvidenceRecord[]): AiEvidenceRecord[] {
    const seen = new Set<string>();
    return records.filter(record => {
        const key = `${record.kind}:${record.toolName ?? ''}:${record.path ?? ''}:${record.summary ?? ''}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

export function mergeEvidenceRecords(
    existing: AiEvidenceRecord[],
    newRecords: AiEvidenceRecord[]
): AiEvidenceRecord[] {
    return dedupeEvidenceRecords([...existing, ...newRecords]);
}

export function doesEvidenceSatisfyIntent(
    intent: AiIntentType,
    records: AiEvidenceRecord[]
): AiEvidenceSatisfaction {
    if (records.length === 0) {
        return 'none';
    }

    const totalScore = records.reduce((acc, r) => acc + (r.satisfactionScore ?? 0.5), 0);

    if (intent === 'single_lookup') {
        const hasSolidEvidence = records.some(r =>
            (
                r.toolName === 'list_directory'
                || r.toolName === 'file_exists'
                || r.toolName === 'resolve_path'
                || r.toolName === 'get_system_info'
                || r.toolName === 'read_file'
                || r.toolName === 'grep_search'
            ) &&
            (r.satisfactionScore ?? 0.5) >= 0.7
        );
        return hasSolidEvidence || totalScore >= 0.7 ? 'complete' : 'partial';
    }

    if (intent === 'multi_lookup') {
        if (totalScore >= 1.5) { return 'complete'; }
        if (totalScore >= 0.5) { return 'partial'; }
        return 'none';
    }

    if (intent === 'agentic_workflow') {
        if (totalScore >= 2.5) { return 'complete'; }
        if (totalScore >= 1.0) { return 'partial'; }
        return 'none';
    }

    const satisfies = totalScore >= 1.0;
    return satisfies ? 'complete' : 'partial';
}

export function buildAiPresentationMetadata(context: AiPresentationContext): AiPresentationMetadata {
    const {
        content,
        reasoning,
        reasonings = [],
        toolCalls,
        toolResults,
        sources,
        images,
        isStreaming = false,
    } = context;
    const normalizedContent = content.trim();

    // Accumulate reasoning segments: existing ones + current Turn's reasoning
    const reasoningSegments = [...reasonings];
    if (reasoning && reasoning.trim().length > 0 && !reasoningSegments.includes(reasoning)) {
        reasoningSegments.push(reasoning);
    }

    const normalizedReasoning = reasoningSegments.length > 0
        ? summarizeReasoning(reasoningSegments[reasoningSegments.length - 1])
        : summarizeReasoning(reasoning);

    const toolCallCount = toolCalls?.length ?? 0;
    const toolResultCount = toolResults?.length ?? 0;
    const evidenceEntries = buildAiEvidenceEntries(context);
    const deterministicAnswer = composeDeterministicAnswer(context);

    const reusedToolResultCount = toolResults?.filter(result => {
        if (!result.result || typeof result.result !== 'object' || Array.isArray(result.result)) {
            return false;
        }
        return (result.result as Record<string, unknown>)._reused === true;
    }).length ?? 0;

    let stage: AiPresentationMetadata['stage'] = 'collecting_context';
    if (toolCallCount > 0 && normalizedContent.length === 0) {
        stage = 'running_tools';
    } else if (toolResultCount > 0 && normalizedContent.length === 0) {
        stage = 'tool_results_ready';
    } else if (normalizedContent.length > 0) {
        stage = 'answer_ready';
    }
    if (deterministicAnswer && normalizedContent.length === 0) {
        stage = 'answer_ready';
    }

    const evidenceRecords: AiEvidenceRecord[] = [
        ...evidenceEntries.map((entry, index): AiEvidenceRecord => ({
            ...entry,
            id: `presentation-${index}`,
            timestamp: 0,
            scope: 'turn',
            isReusable: entry.reused !== true,
            sourceSurface: 'chat',
            satisfactionScore: entry.summary?.toLowerCase().includes('failed') ? 0.2 : 0.7,
        })),
        ...(context.evidenceSnapshot?.records ?? []),
    ];

    return {
        version: 1,
        intent: getIntentValue(context.intent),
        stage,
        answerMode: normalizedContent.length > 0
            ? 'model'
            : deterministicAnswer
                ? 'deterministic'
                : 'fallback',
        isStreaming,
        hasReasoning: reasoningSegments.length > 0,
        reasoningSummary: normalizedReasoning,
        reasoningSegments: reasoningSegments.length > 0 ? reasoningSegments : undefined,
        toolCallCount,
        toolResultCount,
        reusedToolResultCount,
        sourceCount: sources?.length ?? 0,
        imageCount: images?.length ?? 0,
        evidenceCount: evidenceEntries.length + (context.evidenceSnapshot?.records.length ?? 0),
        activeToolNames: getToolNames(toolCalls),
        deterministicAnswerAvailable: Boolean(deterministicAnswer),
        satisfiedByEvidence: doesEvidenceSatisfyIntent(
            getIntentValue(context.intent),
            evidenceRecords
        ) === 'complete',
    };
}

