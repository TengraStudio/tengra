import {
    AiEvidenceEntry,
    AiEvidenceRecord,
    AiEvidenceSatisfaction,
    AiEvidenceScope,
    AiEvidenceSourceSurface,
    AiEvidenceStoreSnapshot,
    AiIntentClassification,
    AiIntentType,
    AiPresentationContext,
    AiPresentationMetadata,
    AiRuntimeSystemMode,
    AiToolLoopBudget,
} from '@shared/types/ai-runtime';

import { Message, ToolCall } from '../types/chat';

const LOOKUP_PATTERN = /(how many|count|list|show|find|kaç|say|listele|goster|göster|bul)/i;
const FILESYSTEM_PATTERN = /(desktop|documents|downloads|folder|directory|dosya|klas[oö]r|masa[uü]st|indirilenler)/i;
const CREATIVE_PATTERN = /\b(create|draw|generate|make an image|logo|poster|g[oö]rsel|resim|afis|afiş|tasarla)\b/i;
const AGENTIC_PATTERN = /\b(fix|debug|refactor|implement|analyze the repo|patch|düzelt|hata ayıkla|refactor et|uygula)\b/i;
const IN_PROGRESS_PATTERN = /\b(checking|looking|reviewing|inspecting|one moment|let me|kontrol ediyorum|bakiyorum|bakıyorum|inceliyorum|kontrol edecegim|kontrol edeceğim|dosyalari kontrol|dosyaları kontrol|tool sonucuna ihtiyacim var|tool sonucuna ihtiyacım var)\b/i;

const MAX_REASONING_SUMMARY_LENGTH = 240;
const MAX_EVIDENCE_SUMMARY_LENGTH = 180;

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

function summarizeEvidence(entries: AiEvidenceEntry[]): string | undefined {
    if (entries.length === 0) {
        return undefined;
    }
    const combined = entries
        .slice(0, 3)
        .map(entry => entry.summary.trim())
        .filter(summary => summary.length > 0)
        .join(' | ');
    if (combined.length === 0) {
        return undefined;
    }
    if (combined.length <= MAX_EVIDENCE_SUMMARY_LENGTH) {
        return combined;
    }
    return `${combined.slice(0, MAX_EVIDENCE_SUMMARY_LENGTH).trimEnd()}...`;
}

function getBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isToolResultObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTurkishLanguage(language?: string): boolean {
    return typeof language === 'string' && language.toLowerCase().startsWith('tr');
}

function summarizeToolResult(
    toolResult: NonNullable<AiPresentationContext['toolResults']>[number],
    language?: string
): AiEvidenceEntry | null {
    const isTurkish = isTurkishLanguage(language);
    const reused = isToolResultObject(toolResult.result)
        ? toolResult.result._reused === true
        : false;

    if (toolResult.name === 'list_directory' && isToolResultObject(toolResult.result)) {
        const path = getString(toolResult.result.path);
        const entryCount = getNumber(toolResult.result.entryCount);
        const fileCount = getNumber(toolResult.result.fileCount);
        const directoryCount = getNumber(toolResult.result.directoryCount);
        if (path && entryCount !== undefined && fileCount !== undefined && directoryCount !== undefined) {
            return {
                kind: 'tool_result',
                toolName: toolResult.name,
                reused,
                path,
                summary: isTurkish
                    ? `${path}: ${fileCount} dosya, ${directoryCount} klasor, toplam ${entryCount} oge`
                    : `${path}: ${fileCount} files, ${directoryCount} folders, ${entryCount} total entries`,
            };
        }
    }

    if (toolResult.name === 'file_exists') {
        const exists = getBoolean(toolResult.result);
        if (exists !== undefined) {
            return {
                kind: 'tool_result',
                toolName: toolResult.name,
                reused,
                summary: isTurkish
                    ? (exists ? 'Istenen yol mevcut' : 'Istenen yol mevcut degil')
                    : (exists ? 'Requested path exists' : 'Requested path does not exist'),
            };
        }
    }

    if (toolResult.name === 'get_system_info' && isToolResultObject(toolResult.result)) {
        const userName = getString(toolResult.result.username);
        const os = getString(toolResult.result.platform);
        const summaryParts = [userName, os].filter((value): value is string => Boolean(value));
        if (summaryParts.length > 0) {
            return {
                kind: 'tool_result',
                toolName: toolResult.name,
                reused,
                summary: isTurkish
                    ? `Sistem bilgisi: ${summaryParts.join(' | ')}`
                    : summaryParts.join(' | '),
            };
        }
    }

    if (toolResult.error) {
        return {
            kind: 'tool_result',
            toolName: toolResult.name,
            reused,
            summary: isTurkish
                ? `${toolResult.name} basarisiz: ${toolResult.error}`
                : `${toolResult.name} failed: ${toolResult.error}`,
        };
    }

    return {
        kind: 'tool_result',
        toolName: toolResult.name,
        reused,
        summary: isTurkish
            ? `${toolResult.name} yeni kanit dondurdu`
            : `${toolResult.name} returned new evidence`,
    };
}

export function buildAiEvidenceEntries(context: AiPresentationContext): AiEvidenceEntry[] {
    const entries: AiEvidenceEntry[] = [];
    const isTurkish = isTurkishLanguage(context.language);

    for (const toolResult of context.toolResults ?? []) {
        const summarized = summarizeToolResult(toolResult, context.language);
        if (summarized) {
            entries.push(summarized);
        }
    }

    for (const source of context.sources ?? []) {
        entries.push({
            kind: 'source',
            summary: isTurkish ? `Kaynak: ${source}` : `Source: ${source}`,
        });
    }

    for (const image of context.images ?? []) {
        entries.push({
            kind: 'image',
            summary: isTurkish ? `Gorsel sonucu: ${image}` : `Image result: ${image}`,
        });
    }

    const normalizedContent = context.content.trim();
    if (normalizedContent.length > 0) {
        entries.push({
            kind: 'content',
            summary: normalizedContent.length > 80
                ? `${normalizedContent.slice(0, 80).trimEnd()}...`
                : normalizedContent,
        });
    }

    return entries;
}

export function composeDeterministicAnswer(context: AiPresentationContext): string | undefined {
    const isTurkish = isTurkishLanguage(context.language);
    const toolResults = context.toolResults ?? [];

    if (getIntentValue(context.intent) === 'single_lookup') {
        for (const toolResult of toolResults) {
            // Priority 1: Directory listing
            if (toolResult.name === 'list_directory' && isToolResultObject(toolResult.result)) {
                const path = getString(toolResult.result.path);
                const entryCount = getNumber(toolResult.result.entryCount);
                const fileCount = getNumber(toolResult.result.fileCount);
                const directoryCount = getNumber(toolResult.result.directoryCount);

                if (path && entryCount !== undefined && fileCount !== undefined && directoryCount !== undefined) {
                    if (isTurkish) {
                        return `\`${path}\` konumunda ${fileCount} dosya ve ${directoryCount} klasor var. Toplam ${entryCount} oge listelendi.`;
                    }
                    return `\`${path}\` contains ${fileCount} files and ${directoryCount} folders. ${entryCount} total entries were listed.`;
                }
            }

            // Priority 2: File existence
            if (toolResult.name === 'file_exists') {
                const exists = getBoolean(toolResult.result);
                if (exists !== undefined) {
                    if (isTurkish) {
                        return exists ? 'Istenen yol mevcut.' : 'Istenen yol mevcut degil.';
                    }
                    return exists ? 'The requested path exists.' : 'The requested path does not exist.';
                }
            }

            // Priority 3: System info
            if (toolResult.name === 'get_system_info' && isToolResultObject(toolResult.result)) {
                const username = getString(toolResult.result.username);
                const platform = getString(toolResult.result.platform);
                if (username || platform) {
                    if (isTurkish) {
                        return `Sistem bilgisi: Kullanici: ${username ?? 'bilinmiyor'}, Platform: ${platform ?? 'bilinmiyor'}.`;
                    }
                    return `System information: User: ${username ?? 'unknown'}, Platform: ${platform ?? 'unknown'}.`;
                }
            }

            // Priority 4: File Content
            if (toolResult.name === 'read_file' && typeof toolResult.result === 'string') {
                const content = toolResult.result.trim();
                const lineCount = content.split('\n').length;
                if (isTurkish) {
                    return `Dosya icerigi okundu (${lineCount} satir).`;
                }
                return `File content read (${lineCount} lines).`;
            }

            // Priority 5: Search Results
            if (toolResult.name === 'grep_search' && Array.isArray(toolResult.result)) {
                const matchCount = toolResult.result.length;
                if (isTurkish) {
                    return `Arama tamamlandi, ${matchCount} eşleşme bulundu.`;
                }
                return `Search complete, found ${matchCount} matches.`;
            }
        }
    }

    return undefined;
}

export function classifyAiIntent(message: Message, systemMode: AiRuntimeSystemMode): AiIntentClassification {
    const content = typeof message.content === 'string'
        ? message.content
        : message.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n');
    const normalized = normalizeWhitespace(content);
    const agentMode = systemMode === 'agent';

    if (agentMode || AGENTIC_PATTERN.test(normalized)) {
        return {
            intent: 'agentic_workflow',
            confidence: 'high',
            systemMode,
            requiresTooling: true,
            preferredMaxModelTurns: 15,
            preferredMaxToolTurns: 8,
        };
    }

    if (CREATIVE_PATTERN.test(normalized)) {
        return {
            intent: 'creative_generation',
            confidence: 'medium',
            systemMode,
            requiresTooling: agentMode,
            preferredMaxModelTurns: 6,
            preferredMaxToolTurns: agentMode ? 3 : 0,
        };
    }

    if (LOOKUP_PATTERN.test(normalized) && FILESYSTEM_PATTERN.test(normalized)) {
        return {
            intent: 'single_lookup',
            confidence: 'high',
            systemMode,
            requiresTooling: true,
            preferredMaxModelTurns: 4,
            preferredMaxToolTurns: 2,
        };
    }

    if (LOOKUP_PATTERN.test(normalized)) {
        return {
            intent: 'multi_lookup',
            confidence: 'medium',
            systemMode,
            requiresTooling: true,
            preferredMaxModelTurns: 6,
            preferredMaxToolTurns: 3,
        };
    }

    return {
        intent: 'direct_answer',
        confidence: 'medium',
        systemMode,
        requiresTooling: agentMode,
        preferredMaxModelTurns: agentMode ? 6 : 4,
        preferredMaxToolTurns: agentMode ? 2 : 0,
    };
}

export function getAiToolLoopBudget(classification: AiIntentClassification): AiToolLoopBudget {
    const noProgressThreshold = classification.intent === 'agentic_workflow' ? 3 : 2;
    return {
        maxModelTurns: classification.preferredMaxModelTurns,
        maxExecutedToolTurns: classification.preferredMaxToolTurns,
        noProgressThreshold,
    };
}

export function normalizeToolSignatureValue(value: unknown, parentKey?: string): unknown {
    if (typeof value === 'string') {
        const normalized = parentKey && /(path|cwd|source|destination)$/i.test(parentKey)
            ? value.replace(/\\/g, '/').replace(/\/+/g, '/')
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
    return IN_PROGRESS_PATTERN.test(content.trim());
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
            toolResult.name === 'list_directory' || toolResult.name === 'file_exists'
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
        const key = `${record.kind}:${record.toolName ?? ''}:${record.path ?? ''}:${record.summary}`;
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
            (r.toolName === 'list_directory' || r.toolName === 'file_exists' || r.toolName === 'get_system_info' || r.toolName === 'read_file' || r.toolName === 'grep_search') &&
            (r.satisfactionScore ?? 0.5) >= 0.7 &&
            !r.summary.toLowerCase().includes('failed') &&
            !r.summary.toLowerCase().includes('basarisiz')
        );
        return hasSolidEvidence || totalScore >= 0.7 ? 'complete' : 'partial';
    }

    if (intent === 'multi_lookup') {
        if (totalScore >= 1.5) {return 'complete';}
        if (totalScore >= 0.5) {return 'partial';}
        return 'none';
    }

    if (intent === 'agentic_workflow') {
        if (totalScore >= 2.5) {return 'complete';}
        if (totalScore >= 1.0) {return 'partial';}
        return 'none';
    }

    const satisfies = totalScore >= 1.0;
    return satisfies ? 'complete' : 'partial';
}

export function summarizeEvidenceStore(snapshot: AiEvidenceStoreSnapshot): string {
    if (snapshot.records.length === 0) {
        return '';
    }
    const entries = snapshot.records.slice(-3).map(r => r.summary);
    const combined = entries.join(' | ');

    if (combined.length <= MAX_EVIDENCE_SUMMARY_LENGTH) {
        return combined;
    }
    return `${combined.slice(0, MAX_EVIDENCE_SUMMARY_LENGTH).trimEnd()}...`;
}

export function buildAiPresentationMetadata(context: AiPresentationContext): AiPresentationMetadata {
    const {
        content,
        reasoning,
        toolCalls,
        toolResults,
        sources,
        images,
        isStreaming = false,
    } = context;
    const normalizedContent = content.trim();
    const normalizedReasoning = summarizeReasoning(reasoning);
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
    if (deterministicAnswer) {
        stage = 'answer_ready';
    }

    return {
        version: 1,
        intent: getIntentValue(context.intent),
        stage,
        answerMode: deterministicAnswer
            ? 'deterministic'
            : normalizedContent.length > 0
                ? 'model'
                : 'fallback',
        isStreaming,
        hasReasoning: typeof normalizedReasoning === 'string' && normalizedReasoning.length > 0,
        reasoningSummary: normalizedReasoning,
        toolCallCount,
        toolResultCount,
        reusedToolResultCount,
        sourceCount: sources?.length ?? 0,
        imageCount: images?.length ?? 0,
        evidenceCount: evidenceEntries.length + (context.evidenceSnapshot?.records.length ?? 0),
        evidenceSummary: summarizeEvidence(evidenceEntries) || (context.evidenceSnapshot ? summarizeEvidenceStore(context.evidenceSnapshot) : undefined),
        activeToolNames: getToolNames(toolCalls),
        // New fields
        deterministicAnswerAvailable: !!deterministicAnswer,
        satisfiedByEvidence: doesEvidenceSatisfyIntent(
            getIntentValue(context.intent), 
            [
                ...evidenceEntries.map(e => ({ 
                    ...e, 
                    id: '', 
                    timestamp: 0, 
                    scope: 'turn', 
                    isReusable: true, 
                    sourceSurface: 'chat', 
                    satisfactionScore: 0.7 
                } as AiEvidenceRecord)), 
                ...(context.evidenceSnapshot?.records ?? [])
            ]
        ) === 'complete',
    };
}
