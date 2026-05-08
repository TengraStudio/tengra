/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Monaco, OnChange } from '@monaco-editor/react';
import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionSource,
    InlineSuggestionUsageStats,
} from '@shared/schemas/inline-suggestions.schema';
import { IconLoader2 } from '@tabler/icons-react';
import type { CancellationToken, editor, languages } from 'monaco-editor';
import React, { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCodeEditorDiagnostics } from '@/components/ui/code-editor-diagnostics';
import { useCodeEditorDirtyDecorations } from '@/components/ui/code-editor-dirty-decorations';
import {
    CodeEditorNavigationTarget,
    CodeEditorWorkspaceResultsPayload,
    useWorkspaceEditorIntelligence,
} from '@/components/ui/code-editor-workspace-intelligence';
import { useTheme } from '@/hooks/useTheme';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    recordCodeEditorFailure,
    recordCodeEditorSuccess,
    setCodeEditorUiState,
} from '@/store/code-editor-health.store';
import { useSettingsStore } from '@/store/settings.store';
import type { AppSettings } from '@/types/settings';
import type { Workspace } from '@/types/workspace';
import { normalizeLanguage } from '@/utils/language-map';
import { applyMonacoTheme, ensureMonacoInitialized } from '@/utils/monaco-loader.util';
import { performanceMonitor } from '@/utils/performance';
import { appLogger } from '@/utils/renderer-logger';
import { initTextMateSupport } from '@/utils/textmate-loader';

type UnsafeValue = ReturnType<typeof JSON.parse>;

type MonacoEditorInstance = editor.IStandaloneCodeEditor;

export interface MonacoEditorComponentProps {
    height: string;
    defaultLanguage: string;
    language: string;
    path?: string;
    value: string;
    onChange?: OnChange;
    theme: string;
    onMount: (editorInstance: MonacoEditorInstance, monacoInstance: Monaco) => void;
    loading: React.ReactNode;
    options: editor.IStandaloneEditorConstructionOptions;
    monaco: Monaco;
}

export interface InlineSuggestionConfig {
    enabled?: boolean;
    source: InlineSuggestionSource;
    model?: string;
    provider?: string;
    accountId?: string;
    maxTokens?: number;
}

export const DEFAULT_INLINE_SUGGESTION_CONFIG: InlineSuggestionConfig = {
    enabled: true,
    source: 'custom',
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 128,
};

const INLINE_SUGGESTION_DEBOUNCE_MS = 120;
const INLINE_SUGGESTION_CACHE_TTL_MS = 30_000;
const INLINE_SUGGESTION_CACHE_LIMIT = 40;
const INLINE_SUGGESTION_ACCEPT_COMMAND = 'tengra.inlineSuggestion.accept';

interface InlineSuggestionCacheEntry {
    response: InlineSuggestionResponse;
    createdAt: number;
}

interface ActiveInlineSuggestionSession {
    cacheKey: string;
    source: InlineSuggestionSource;
    provider?: string;
    model?: string;
    language: string;
    accepted: boolean;
}

function resolveInlineSuggestionConfig(
    settingsConfig: Partial<InlineSuggestionConfig>,
    inlineSuggestionConfig: InlineSuggestionConfig | null
): InlineSuggestionConfig {
    const source =
        inlineSuggestionConfig?.source
        ?? settingsConfig.source
        ?? DEFAULT_INLINE_SUGGESTION_CONFIG.source;
    const sourceDefaults: InlineSuggestionConfig =
        source === 'copilot'
            ? {
                enabled: DEFAULT_INLINE_SUGGESTION_CONFIG.enabled,
                source,
                model: 'gpt-4o-copilot',
                maxTokens: DEFAULT_INLINE_SUGGESTION_CONFIG.maxTokens,
            }
            : { ...DEFAULT_INLINE_SUGGESTION_CONFIG, source };

    return {
        ...sourceDefaults,
        ...settingsConfig,
        ...(inlineSuggestionConfig ?? {}),
    };
}

function buildInlineSuggestionCacheKey(request: InlineSuggestionRequest): string {
    const prefixTail = request.prefix.slice(-240);
    const suffixHead = (request.suffix ?? '').slice(0, 120);
    return [
        request.source,
        request.provider ?? '',
        request.model ?? '',
        request.language,
        `${request.cursorLine}:${request.cursorColumn}`,
        prefixTail,
        suffixHead,
    ].join('|');
}

function pruneInlineSuggestionCache(cache: Map<string, InlineSuggestionCacheEntry>, now: number): void {
    for (const [key, entry] of cache) {
        if (now - entry.createdAt > INLINE_SUGGESTION_CACHE_TTL_MS) {
            cache.delete(key);
        }
    }

    while (cache.size > INLINE_SUGGESTION_CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) {
            break;
        }
        cache.delete(oldestKey);
    }
}

function buildInlineSuggestionConfigFromSettings(
    settings: AppSettings | null
): Partial<InlineSuggestionConfig> {
    const general = settings?.general;
    if (!general) {
        return {};
    }

    const source = general.inlineSuggestionsSource ?? DEFAULT_INLINE_SUGGESTION_CONFIG.source;
    const model = general.inlineSuggestionsModel?.trim() || undefined;
    const accountId = general.inlineSuggestionsCopilotAccountId?.trim() || undefined;
    const provider =
        source === 'custom'
            ? general.inlineSuggestionsProvider?.trim() || DEFAULT_INLINE_SUGGESTION_CONFIG.provider
            : undefined;

    return {
        enabled: general.inlineSuggestionsEnabled ?? DEFAULT_INLINE_SUGGESTION_CONFIG.enabled,
        source,
        model,
        provider,
        accountId,
    };
}

const loadMonaco = async (): Promise<{ Editor: React.ElementType; DiffEditor: React.ElementType; monaco: Monaco }> => {
    const importReactPromise = import('@monaco-editor/react');
    const initMonacoPromise = ensureMonacoInitialized();
    const [{ default: Editor, DiffEditor }, monaco] = await Promise.all([
        importReactPromise,
        initMonacoPromise,
    ]);
    return { Editor, DiffEditor, monaco };
};
export function toError(error: Error | null | undefined): Error {
    if (error instanceof Error) {
        return error;
    }

    return new Error('Unknown error');
}


function buildWorkspaceEditorOverrides(
    settings?: Workspace['editor']
): editor.IStandaloneEditorConstructionOptions {
    if (!settings) {
        return {};
    }

    const options: editor.IStandaloneEditorConstructionOptions = {
        ...settings.additionalOptions,
    };

    type EditorKey = keyof editor.IStandaloneEditorConstructionOptions;
    type WorkspaceKey = keyof NonNullable<Workspace['editor']>;

    const directMappings: Array<[WorkspaceKey, EditorKey, ((v: never) => unknown)?]> = [
        ['fontSize', 'fontSize'],
        ['fontFamily', 'fontFamily'],
        ['fontWeight', 'fontWeight'],
        ['letterSpacing', 'letterSpacing'],
        ['fontLigatures', 'fontLigatures'],
        ['lineHeight', 'lineHeight', ((v: number) => Math.round(v * 18)) as (v: never) => unknown],
        ['smoothScrolling', 'smoothScrolling'],
        ['cursorBlinking', 'cursorBlinking'],
        ['cursorStyle', 'cursorStyle'],
        ['cursorWidth', 'cursorWidth'],
        ['formatOnPaste', 'formatOnPaste'],
        ['formatOnType', 'formatOnType'],
        ['tabSize', 'tabSize'],
        ['lineNumbers', 'lineNumbers'],
        ['folding', 'folding'],
        ['showFoldingControls', 'showFoldingControls'],
        ['wordWrap', 'wordWrap'],
        ['codeLens', 'codeLens'],
        ['renderWhitespace', 'renderWhitespace'],
        ['renderLineHighlight', 'renderLineHighlight'],
        ['renderControlCharacters', 'renderControlCharacters'],
        ['roundedSelection', 'roundedSelection'],
        ['scrollBeyondLastLine', 'scrollBeyondLastLine'],
        ['cursorSmoothCaretAnimation', 'cursorSmoothCaretAnimation'],
        ['wordBasedSuggestions', 'wordBasedSuggestions'],
        ['acceptSuggestionOnEnter', 'acceptSuggestionOnEnter'],
        ['suggestFontSize', 'suggestFontSize'],
        ['suggestLineHeight', 'suggestLineHeight'],
        ['mouseWheelZoom', 'mouseWheelZoom'],
        ['multiCursorModifier', 'multiCursorModifier'],
        ['selectionHighlight', 'selectionHighlight'],
        ['renderFinalNewline', 'renderFinalNewline'],
    ];

    for (const [settingsKey, editorKey, transform] of directMappings) {
        const val = settings[settingsKey];
        if (val !== undefined && val !== null) {
            const finalValue = transform ? transform(val as never) : val;
            Object.assign(options, { [editorKey]: finalValue });
        }
    }

    // Special cases
    if (typeof settings.minimap === 'boolean') {
        options.minimap = {
            enabled: settings.minimap,
            side: settings.minimapSide ?? 'right',
            showSlider: 'always',
            renderCharacters: settings.minimapRenderCharacters ?? false,
        };
    }

    if (typeof settings.inlayHints === 'boolean') {
        options.inlayHints = { enabled: settings.inlayHints ? 'on' : 'off' };
    }

    if (typeof settings.stickyScroll === 'boolean') {
        options.stickyScroll = { enabled: settings.stickyScroll };
    }

    if (typeof settings.bracketPairColorization === 'boolean') {
        options.bracketPairColorization = { enabled: settings.bracketPairColorization };
    }

    if (typeof settings.guidesIndentation === 'boolean') {
        options.guides = { ...options.guides, indentation: settings.guidesIndentation };
    }

    return options;
}


export interface CodeEditorProps {
    value?: string;
    language?: string;
    onChange?: (value: string | undefined, modelPath?: string) => void;
    readOnly?: boolean;
    className?: string;
    showMinimap?: boolean;
    savedValue?: string;
    fontSize?: number;
    initialLine?: number;
    appLanguage?: Language;
    enableInlayHints?: boolean;
    enableCodeLens?: boolean;
    performanceMode?: boolean;
    aiSafetyFilterEnabled?: boolean;
    aiContextLimit?: number;
    inlineSuggestionConfig?: InlineSuggestionConfig | null;
    initialPosition?: { lineNumber: number; column: number } | null;
    initialScrollTop?: number | null;
    onCursorPositionChange?: (position: { lineNumber: number; column: number }) => void;
    onScrollPositionChange?: (scrollTop: number) => void;
    performanceMarkPrefix?: string;
    workspacePath?: string;
    filePath?: string;
    workspaceEditorSettings?: Workspace['editor'];
    contentBottomPaddingPx?: number;
    onNavigateToLocation?: (target: CodeEditorNavigationTarget) => void;
    onShowWorkspaceResults?: (payload: CodeEditorWorkspaceResultsPayload) => void;
    originalValue?: string;
    diffMode?: boolean;
    diff?: {
        oldValue: string;
        newValue: string;
    };
}

let textMateInitialized = false;
let textMateInitializing = false;

const useMonacoLoader = (performanceMarkPrefix?: string): { monacoComponents: { Editor: ComponentType<MonacoEditorComponentProps>; DiffEditor: ComponentType<UnsafeValue>; monaco: Monaco } | null; loading: boolean } => {
    const [monacoComponents, setMonacoComponents] = useState<{
        Editor: ComponentType<MonacoEditorComponentProps>;
        DiffEditor: ComponentType<UnsafeValue>;
        monaco: Monaco;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const startedAt = performance.now();
        setCodeEditorUiState('loading');
        loadMonaco()
            .then(({ Editor, DiffEditor, monaco }) => {
                setMonacoComponents({
                    Editor: Editor as ComponentType<MonacoEditorComponentProps>,
                    DiffEditor: DiffEditor as ComponentType<UnsafeValue>,
                    monaco,
                });
                if (performanceMarkPrefix) {
                    performanceMonitor.mark(`${performanceMarkPrefix}:runtime-loaded`);
                }
                setCodeEditorUiState('ready');
                recordCodeEditorSuccess(performance.now() - startedAt);
                setLoading(false);
            })
            .catch(e => {
                appLogger.error('CodeEditor', 'Failed to load Monaco', toError(e instanceof Error ? e : undefined));
                setCodeEditorUiState('failure');
                recordCodeEditorFailure(
                    'CODE_EDITOR_INIT_FAILED',
                    performance.now() - startedAt
                );
                setLoading(false);
            });
    }, [performanceMarkPrefix]);
    return { monacoComponents, loading };
};

function buildInlineSuggestionRequest(
    model: editor.ITextModel,
    position: { lineNumber: number; column: number },
    language: string,
    aiSafetyFilterEnabled: boolean,
    aiContextLimit: number,
    inlineSuggestionConfig: InlineSuggestionConfig
): InlineSuggestionRequest | null {
    const prefix = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
    });

    if (prefix.trim().length === 0 || prefix.length > aiContextLimit) {
        return null;
    }

    if (
        aiSafetyFilterEnabled
        && /api[_-]?key|private[_-]?key|token\s*=|password\s*=/i.test(prefix)
    ) {
        return null;
    }

    const lastSuffixLine = Math.min(model.getLineCount(), position.lineNumber + 20);
    const suffix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: lastSuffixLine,
        endColumn: model.getLineMaxColumn(lastSuffixLine),
    });

    return {
        prefix,
        suffix: suffix.slice(0, Math.min(aiContextLimit, 4000)),
        language,
        cursorLine: position.lineNumber,
        cursorColumn: position.column,
        source: inlineSuggestionConfig.source,
        model: inlineSuggestionConfig.model,
        provider: inlineSuggestionConfig.provider,
        accountId: inlineSuggestionConfig.accountId,
        maxTokens: inlineSuggestionConfig.maxTokens,
    };
}

function toMonacoModelPath(filePath?: string): string | undefined {
    if (!filePath) {
        return undefined;
    }

    const normalizedPath = filePath.trim();
    if (!normalizedPath) {
        return undefined;
    }

    const slashPath = normalizedPath.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (/^[a-zA-Z]+:\/\//.test(slashPath)) {
        return slashPath;
    }
    if (/^[A-Za-z]:\//.test(slashPath)) {
        return `file:///${slashPath}`;
    }
    if (slashPath.startsWith('//')) {
        return `file:${slashPath}`;
    }
    if (slashPath.startsWith('/')) {
        return `file://${slashPath}`;
    }

    return `inmemory://model/${encodeURIComponent(slashPath)}`;
}

const useEditorDecorations = (monaco: Monaco | null, _t: (key: string) => string) => {
    const decorationRef = useRef<string[]>([]);
    return useCallback(
        (editor: MonacoEditorInstance) => {
            if (!monaco) {
                return;
            }
            const model = editor.getModel();
            if (!model) {
                return;
            }
            const lineCount = model.getLineCount();
            const newDecorations: editor.IModelDeltaDecoration[] = [];
            for (let i = 1; i <= lineCount; i++) {
                const content = model.getLineContent(i).trim();
                if (content.length > 5 && !content.startsWith('//') && !content.startsWith('*')) {
                    newDecorations.push({
                        range: {
                            startLineNumber: i,
                            startColumn: 1,
                            endLineNumber: i,
                            endColumn: 1,
                        },
                        options: {
                            isWholeLine: false,
                            glyphMarginClassName: 'ai-gutter-sparkle',
                        },
                    });
                }
            }
            decorationRef.current = editor.deltaDecorations(decorationRef.current, newDecorations);
        },
        [monaco]
    );
};

const useInlineCompletions = (
    monacoRef: React.MutableRefObject<Monaco | null>,
    normalizedLanguage: string,
    hasMonaco: boolean,
    editorMounted: boolean,
    aiSafetyFilterEnabled: boolean,
    aiContextLimit: number,
    inlineSuggestionConfig: InlineSuggestionConfig,
    readOnly: boolean
) => {
    const cacheRef = useRef<Map<string, InlineSuggestionCacheEntry>>(new Map());
    const latestRequestIdRef = useRef(0);
    const activeSessionRef = useRef<ActiveInlineSuggestionSession | null>(null);

    useEffect(() => {
        if (!editorMounted || !monacoRef.current || !hasMonaco || !inlineSuggestionConfig.enabled || readOnly) {
            return;
        }
        const monaco = monacoRef.current;
        const trackUsageStats = (event: InlineSuggestionUsageStats) => {
            void window.electron.workspace.trackInlineSuggestionUsageStats(event).catch(() => { });
        };
        const commandDisposable = monaco.editor.registerCommand(
            INLINE_SUGGESTION_ACCEPT_COMMAND,
            (_accessor: RendererDataValue, payload: ActiveInlineSuggestionSession | undefined) => {
                if (!payload) {
                    return;
                }
                activeSessionRef.current = {
                    ...payload,
                    accepted: true,
                };
                trackUsageStats({
                    event: 'accept',
                    source: payload.source,
                    provider: payload.provider,
                    model: payload.model,
                    language: payload.language,
                    cacheKey: payload.cacheKey,
                });
            }
        );
        const prov = monaco.languages.registerInlineCompletionsProvider(normalizedLanguage, {
            provideInlineCompletions: async (
                model: editor.ITextModel,
                pos: { lineNumber: number; column: number },
                context: languages.InlineCompletionContext,
                token: CancellationToken
            ) => {
                const requestId = latestRequestIdRef.current + 1;
                latestRequestIdRef.current = requestId;
                await new Promise(resolve => {
                    setTimeout(resolve, INLINE_SUGGESTION_DEBOUNCE_MS);
                });
                if (requestId !== latestRequestIdRef.current || token.isCancellationRequested || model.isDisposed()) {
                    return { items: [] };
                }

                const request = buildInlineSuggestionRequest(
                    model,
                    pos,
                    normalizedLanguage,
                    aiSafetyFilterEnabled,
                    aiContextLimit,
                    inlineSuggestionConfig
                );
                if (!request) {
                    return { items: [] };
                }

                const startedAt = Date.now();
                const cacheKey = buildInlineSuggestionCacheKey(request);
                pruneInlineSuggestionCache(cacheRef.current, startedAt);
                const cached = cacheRef.current.get(cacheKey);
                if (cached && startedAt - cached.createdAt <= INLINE_SUGGESTION_CACHE_TTL_MS) {
                    trackUsageStats({
                        event: 'cache_hit',
                        source: cached.response.source,
                        provider: cached.response.provider,
                        model: cached.response.model,
                        language: request.language,
                        cacheKey,
                    });
                    if (!cached.response.suggestion) {
                        return { items: [] };
                    }
                    const session: ActiveInlineSuggestionSession = {
                        cacheKey,
                        source: cached.response.source,
                        provider: cached.response.provider,
                        model: cached.response.model,
                        language: request.language,
                        accepted: false,
                    };
                    return {
                        items: [
                            {
                                insertText: cached.response.suggestion,
                                range: {
                                    startLineNumber: pos.lineNumber,
                                    startColumn: pos.column,
                                    endLineNumber: pos.lineNumber,
                                    endColumn: pos.column,
                                },
                                command: {
                                    id: INLINE_SUGGESTION_ACCEPT_COMMAND,
                                    title: 'Track inline suggestion accept',
                                    arguments: [session],
                                },
                            },
                        ],
                    };
                }

                trackUsageStats({
                    event: 'request',
                    source: request.source,
                    provider: request.provider,
                    model: request.model,
                    language: request.language,
                    cacheKey,
                });

                try {
                    const response = await window.electron.workspace.getInlineSuggestion(request);
                    cacheRef.current.set(cacheKey, {
                        response,
                        createdAt: Date.now(),
                    });
                    pruneInlineSuggestionCache(cacheRef.current, Date.now());
                    if (requestId !== latestRequestIdRef.current || token.isCancellationRequested || model.isDisposed()) {
                        return { items: [] };
                    }
                    if (!response.suggestion) {
                        return { items: [] };
                    }
                    const session: ActiveInlineSuggestionSession = {
                        cacheKey,
                        source: response.source,
                        provider: response.provider,
                        model: response.model,
                        language: request.language,
                        accepted: false,
                    };
                    return {
                        items: [
                            {
                                insertText: response.suggestion,
                                range: {
                                    startLineNumber: pos.lineNumber,
                                    startColumn: pos.column,
                                    endLineNumber: pos.lineNumber,
                                    endColumn: pos.column,
                                },
                                command: {
                                    id: INLINE_SUGGESTION_ACCEPT_COMMAND,
                                    title: 'Track inline suggestion accept',
                                    arguments: [session],
                                },
                            },
                        ],
                    };
                } catch {
                    if (requestId === latestRequestIdRef.current) {
                        trackUsageStats({
                            event: 'error',
                            source: request.source,
                            provider: request.provider,
                            model: request.model,
                            language: request.language,
                            cacheKey,
                            latencyMs: Date.now() - startedAt,
                            reason: 'request_failed',
                        });
                    }
                    return { items: [] };
                }
            },
            disposeInlineCompletions: () => {
                const activeSession = activeSessionRef.current;
                if (!activeSession || activeSession.accepted) {
                    activeSessionRef.current = null;
                    return;
                }
                trackUsageStats({
                    event: 'reject',
                    source: activeSession.source,
                    provider: activeSession.provider,
                    model: activeSession.model,
                    language: activeSession.language,
                    cacheKey: activeSession.cacheKey,
                });
                activeSessionRef.current = null;
            },
            handleItemDidShow: (_completions: RendererDataValue, item: RendererDataValue) => {
                const commandCandidate =
                    item && typeof item === 'object' && 'command' in item
                        ? (item as { command?: { arguments?: RendererDataValue[] } }).command
                        : undefined;
                const session = commandCandidate?.arguments?.[0] as
                    | ActiveInlineSuggestionSession
                    | undefined;
                if (!session) {
                    return;
                }
                activeSessionRef.current = session;
                trackUsageStats({
                    event: 'show',
                    source: session.source,
                    provider: session.provider,
                    model: session.model,
                    language: session.language,
                    cacheKey: session.cacheKey,
                });
            },
        });
        return () => {
            commandDisposable.dispose();
            prov.dispose();
        };
    }, [
        aiContextLimit,
        aiSafetyFilterEnabled,
        editorMounted,
        hasMonaco,
        inlineSuggestionConfig,
        monacoRef,
        normalizedLanguage,
        readOnly,
    ]);
};

const useEditorLifecycle = (
    editorRef: React.MutableRefObject<MonacoEditorInstance | null>,
    monacoRef: React.MutableRefObject<Monaco | null>,
    updateDecorations: (editor: MonacoEditorInstance) => void,
    initialPosition?: { lineNumber: number; column: number } | null,
    initialScrollTop?: number | null,
    onCursorPositionChange?: (position: { lineNumber: number; column: number }) => void,
    onScrollPositionChange?: (scrollTop: number) => void,
    performanceMarkPrefix?: string,
    setEditorMounted?: React.Dispatch<React.SetStateAction<boolean>>
) => {
    return useCallback(
        async (editor: MonacoEditorInstance, monaco: Monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            if (performanceMarkPrefix) {
                performanceMonitor.mark(`${performanceMarkPrefix}:ready`);
            }
            if (!textMateInitialized && !textMateInitializing) {
                textMateInitializing = true;
                try {
                    await initTextMateSupport(monaco);
                    textMateInitialized = true;
                } catch (e) {
                    appLogger.warn('CodeEditor',
                        '[CodeEditor] TextMate initialization failed',
                        toError(e instanceof Error ? e : undefined)
                    );
                } finally {
                    textMateInitializing = false;
                }
            }
            updateDecorations(editor);
            editor.onMouseDown(e => {
                if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                    const line = e.target.position?.lineNumber;
                    if (line) {
                        document.dispatchEvent(
                            new CustomEvent('ai-refactor-request', {
                                detail: { line, content: editor.getModel()?.getLineContent(line) },
                            })
                        );
                    }
                }
            });
            editor.onDidChangeModelContent(() => {
                setTimeout(() => {
                    updateDecorations(editor);
                }, 500);
            });
            if (initialPosition) {
                editor.setPosition(initialPosition);
            }
            if (typeof initialScrollTop === 'number') {
                editor.setScrollTop(initialScrollTop);
            }
            editor.onDidChangeCursorPosition(event => {
                onCursorPositionChange?.({
                    lineNumber: event.position.lineNumber,
                    column: event.position.column,
                });
            });
            editor.onDidScrollChange(event => {
                onScrollPositionChange?.(event.scrollTop);
            });
            setEditorMounted?.(true);
        },
        [
            initialPosition,
            initialScrollTop,
            onCursorPositionChange,
            onScrollPositionChange,
            performanceMarkPrefix,
            setEditorMounted,
            updateDecorations,
            editorRef,
            monacoRef,
        ]
    );
};

const LoadingOverlay = ({ className, t }: { className?: string; t: (k: string) => string }) => (
    <div
        className={cn('relative w-full h-full overflow-hidden flex items-center justify-center', className)}
    >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <IconLoader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">{t('common.loading')}</span>
        </div>
    </div>
);

const useEditorInitialLine = (
    editorRef: React.MutableRefObject<MonacoEditorInstance | null>,
    initialLine?: number
) => {
    useEffect(() => {
        if (editorRef.current && initialLine) {
            const ed = editorRef.current;
            setTimeout(() => {
                ed.revealLineInCenter(initialLine);
                ed.setPosition({ lineNumber: initialLine, column: 1 });
                ed.focus();
            }, 100);
        }
    }, [initialLine, editorRef]);
};

const MonacoEditorInternal: React.FC<{
    Editor: ComponentType<MonacoEditorComponentProps>;
    DiffEditor: ComponentType<UnsafeValue>;
    language: string;
    modelPath?: string;
    value: string;
    onChange?: (value: string | undefined, modelPath?: string) => void;
    theme: string;
    onMount: (e: MonacoEditorInstance, m: Monaco) => void;
    loading: React.ReactNode;
    options: editor.IStandaloneEditorConstructionOptions;
    monaco: Monaco;
    className?: string;
    diffMode?: boolean;
    originalValue?: string;
}> = ({
    Editor,
    DiffEditor,
    language,
    modelPath,
    value,
    onChange,
    theme,
    onMount,
    loading,
    options,
    monaco,
    className,
    diffMode,
    originalValue,
}) => {
        const diffEditorRef = useRef<editor.IDiffEditor | null>(null);

        useEffect(() => {
            return () => {
                if (diffEditorRef.current) {
                    try {
                        const models = diffEditorRef.current.getModel();
                        if (models) {
                            diffEditorRef.current.setModel(null);
                        }
                    } catch (e) {
                        appLogger.warn('CodeEditor', 'Error during diff editor cleanup', e as Error);
                    }
                }
            };
        }, []);

        return (
            <div className={cn('relative w-full h-full overflow-hidden', className)}>
                {diffMode ? (
                    <DiffEditor
                        height="100%"
                        original={originalValue ?? ''}
                        modified={value}
                        language={language}
                        theme={theme}
                        onMount={(editor: UnsafeValue, m: UnsafeValue) => {
                            diffEditorRef.current = editor;
                            onMount(editor.getModifiedEditor(), m);
                        }}
                        loading={loading}
                        options={{
                            ...options,
                            renderSideBySide: true,
                        }}
                    />
                ) : (
                    <Editor
                        height="100%"
                        defaultLanguage={language}
                        language={language}
                        path={modelPath}
                        value={value}
                        onChange={onChange ? (val) => onChange(val, modelPath) : undefined}
                        theme={theme}
                        onMount={onMount}
                        loading={loading}
                        options={options}
                        monaco={monaco}
                    />
                )}
            </div>
        );
    };

export const CodeEditor: React.FC<CodeEditorProps> = ({
    value,
    language = 'typescript',
    onChange,
    readOnly = false,
    className,
    showMinimap = true,
    savedValue,
    fontSize,
    initialLine,
    appLanguage,
    enableInlayHints = true,
    enableCodeLens = true,
    performanceMode = false,
    aiSafetyFilterEnabled = true,
    aiContextLimit = 8000,
    inlineSuggestionConfig = null,
    initialPosition = null,
    initialScrollTop = null,
    onCursorPositionChange,
    onScrollPositionChange,
    performanceMarkPrefix,
    workspacePath,
    filePath,
    workspaceEditorSettings,
    contentBottomPaddingPx = 12,
    onNavigateToLocation,
    onShowWorkspaceResults,
    originalValue,
    diffMode = false,
    diff,
}) => {
    const { isLight } = useTheme();
    const { t } = useTranslation(appLanguage);
    const editorRef = useRef<MonacoEditorInstance | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const [editorMounted, setEditorMounted] = useState(false);
    const settings = useSettingsStore(snapshot => snapshot.settings);
    const { monacoComponents, loading } = useMonacoLoader(performanceMarkPrefix);
    const updateDecorations = useEditorDecorations(monacoComponents?.monaco ?? null, t);
    const normalizedLanguage = normalizeLanguage(language);
    const modelPath = useMemo(() => toMonacoModelPath(filePath), [filePath]);
    const settingsInlineSuggestionConfig = useMemo(
        () => buildInlineSuggestionConfigFromSettings(settings),
        [settings]
    );
    const resolvedInlineSuggestionConfig = useMemo(
        (): InlineSuggestionConfig =>
            resolveInlineSuggestionConfig(settingsInlineSuggestionConfig, inlineSuggestionConfig),
        [inlineSuggestionConfig, settingsInlineSuggestionConfig]
    );

    useInlineCompletions(
        monacoRef,
        normalizedLanguage,
        !!monacoComponents,
        editorMounted,
        aiSafetyFilterEnabled,
        aiContextLimit,
        resolvedInlineSuggestionConfig,
        readOnly
    );
    const workspaceIntelligenceLabels = useMemo(
        () => ({
            open: t('frontend.gallery.open'),
            history: t('frontend.agent.history'),
            related: t('frontend.memory.graphEdgeRelated'),
        }),
        [t]
    );
    useWorkspaceEditorIntelligence({
        editorRef,
        monacoRef,
        editorMounted,
        workspacePath,
        filePath,
        language: normalizedLanguage,
        labels: workspaceIntelligenceLabels,
        onNavigateToLocation,
        onShowWorkspaceResults,
    });
    useCodeEditorDiagnostics({
        editorRef,
        monacoRef,
        editorMounted,
        workspaceId: workspacePath,
        filePath,
    });
    useCodeEditorDirtyDecorations({
        editorRef,
        monacoRef,
        editorMounted,
        savedValue,
    });
    useEditorInitialLine(editorRef, initialLine);

    const handleEditorDidMount = useEditorLifecycle(
        editorRef,
        monacoRef,
        updateDecorations,
        initialPosition,
        initialScrollTop,
        onCursorPositionChange,
        onScrollPositionChange,
        performanceMarkPrefix,
        setEditorMounted
    );

    const monacoTheme = useMemo(() => {
        if (!monacoComponents?.monaco) {
            return isLight ? 'vs' : 'vs-dark';
        }
        return applyMonacoTheme(monacoComponents.monaco, isLight);
    }, [monacoComponents, isLight]);

    const editorOptions = useMemo(
        (): editor.IStandaloneEditorConstructionOptions => {
            const effectiveEditorSettings = {
                ...(settings?.editor ?? {}),
                ...(workspaceEditorSettings ?? {}),
            };
            const workspaceOverrides = buildWorkspaceEditorOverrides(effectiveEditorSettings);
            const codeLensEnabled =
                (effectiveEditorSettings.codeLens ?? enableCodeLens) && !performanceMode;
            const inlayHintsEnabled =
                (effectiveEditorSettings.inlayHints ?? enableInlayHints) && !performanceMode;

            return {
                minimap: {
                    enabled: showMinimap,
                    side: 'right',
                    showSlider: 'always',
                    renderCharacters: false,
                },
                fontSize: fontSize ?? effectiveEditorSettings.fontSize ?? 14,
                fontFamily: "var(--font-mono)",
                fontLigatures: false,
                scrollBeyondLastLine: false,
                readOnly,
                automaticLayout: true,
                padding: { top: 12, bottom: Math.max(12, Math.floor(contentBottomPaddingPx)) },
                smoothScrolling: true,
                cursorBlinking: 'blink',
                cursorSmoothCaretAnimation: 'off',
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 4,
                glyphMargin: codeLensEnabled,
                lineNumbers: 'on',
                folding: true,
                lineDecorationsWidth: 10,
                overviewRulerLanes: 3,
                renderLineHighlight: 'line',
                fixedOverflowWidgets: true,
                codeLens: codeLensEnabled,
                inlayHints: { enabled: inlayHintsEnabled ? 'on' : 'off' },
                inlineSuggest: {
                    enabled: resolvedInlineSuggestionConfig.enabled && !readOnly,
                },
                ...workspaceOverrides,
            };
        },
        [
            showMinimap,
            fontSize,
            readOnly,
            enableCodeLens,
            performanceMode,
            enableInlayHints,
            resolvedInlineSuggestionConfig.enabled,
            settings?.editor,
            workspaceEditorSettings,
            contentBottomPaddingPx,
        ]
    );

    if (loading || !monacoComponents) {
        return <LoadingOverlay className={className} t={t} />;
    }
    return (
        <MonacoEditorInternal
            Editor={monacoComponents.Editor}
            DiffEditor={monacoComponents.DiffEditor}
            value={value ?? ''}
            language={normalizedLanguage}
            modelPath={modelPath || undefined}
            onChange={onChange}
            theme={monacoTheme}
            onMount={(editorInstance, monacoInstance) => {
                void handleEditorDidMount(editorInstance, monacoInstance);
            }}
            loading={<LoadingOverlay className={className} t={t} />}
            options={editorOptions}
            monaco={monacoComponents.monaco}
            className={className}
            diffMode={diffMode || !!diff}
            originalValue={diff?.oldValue ?? originalValue}
        />
    );
};

