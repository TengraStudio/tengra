import type { Monaco, OnChange } from '@monaco-editor/react';
import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionSource,
    InlineSuggestionTelemetry,
} from '@shared/schemas/inline-suggestions.schema';
import { Loader2 } from 'lucide-react';
import type { editor } from 'monaco-editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { Language, useTranslation } from '@/i18n';
import { useSettingsStore } from '@/store/settings.store';
import type { AppSettings } from '@/types/settings';
import { normalizeLanguage } from '@/utils/language-map';
import { ensureMonacoInitialized } from '@/utils/monaco-loader.util';
import { initTextMateSupport } from '@/utils/textmate-loader';

type MonacoEditorInstance = editor.IStandaloneCodeEditor;

export interface MonacoEditorComponentProps {
    height: string;
    defaultLanguage: string;
    language: string;
    value: string;
    onChange?: OnChange;
    theme: string;
    onMount: (editorInstance: MonacoEditorInstance, monacoInstance: Monaco) => void;
    loading: React.ReactNode;
    options: editor.IStandaloneEditorConstructionOptions;
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

const loadMonaco = async () => {
    const [{ default: Editor }, monaco] = await Promise.all([
        import('@monaco-editor/react'),
        ensureMonacoInitialized(),
    ]);
    return { Editor, monaco };
};

function rgbChannelToHex(channel: number): string {
    return channel.toString(16).padStart(2, '0');
}

export function toError(error: Error | null | undefined): Error {
    if (error instanceof Error) {
        return error;
    }

    return new Error('Unknown error');
}

function toHexColorFromComputedColor(colorValue: string): string | null {
    const rgbMatch = colorValue.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!rgbMatch) {
        return null;
    }
    const red = Number(rgbMatch[1]);
    const green = Number(rgbMatch[2]);
    const blue = Number(rgbMatch[3]);
    return `#${rgbChannelToHex(red)}${rgbChannelToHex(green)}${rgbChannelToHex(blue)}`;
}

function readCssVariableAsHex(name: string, fallbackVariableName?: string): string {
    const styles = getComputedStyle(document.documentElement);
    const primaryToken = styles.getPropertyValue(name).trim();
    const fallbackToken = fallbackVariableName ? styles.getPropertyValue(fallbackVariableName).trim() : '';
    const cssToken = primaryToken || fallbackToken;

    if (!cssToken) {
        const bodyColor = getComputedStyle(document.body).color;
        const rootColor = getComputedStyle(document.documentElement).color;
        const fallback =
            toHexColorFromComputedColor(bodyColor) ??
            toHexColorFromComputedColor(rootColor) ??
            toHexColorFromComputedColor(getComputedStyle(document.body).backgroundColor);
        if (!fallback) {
            throw new Error(`Unable to resolve Monaco color token: ${name}`);
        }
        return fallback;
    }

    const probe = document.createElement('span');
    probe.style.color = `hsl(${cssToken})`;
    probe.style.position = 'fixed';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
    const resolvedColor = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const resolved =
        toHexColorFromComputedColor(resolvedColor) ??
        toHexColorFromComputedColor(getComputedStyle(document.body).color);
    if (!resolved) {
        throw new Error(`Unable to resolve Monaco color token: ${name}`);
    }
    return resolved;
}

function applyMonacoTheme(monaco: Monaco, isLight: boolean): string {
    const background = readCssVariableAsHex('--editor-background', '--background');
    const foreground = readCssVariableAsHex('--editor-foreground', '--foreground');
    const gutterBackground = readCssVariableAsHex('--editor-gutter-background', '--background');
    const widgetBackground = readCssVariableAsHex('--editor-widget-background', '--card');
    const widgetBorder = readCssVariableAsHex('--editor-widget-border', '--border');
    const lineNumber = readCssVariableAsHex('--editor-line-number', '--muted-foreground');
    const lineNumberActive = readCssVariableAsHex('--editor-line-number-active', '--foreground');
    const cursor = readCssVariableAsHex('--editor-cursor', '--primary');
    const selection = readCssVariableAsHex('--editor-selection', '--primary');
    const selectionInactive = readCssVariableAsHex('--editor-selection-inactive', '--accent');
    const lineHighlight = readCssVariableAsHex('--editor-line-highlight', '--card');
    const indentGuide = readCssVariableAsHex('--editor-indent-guide', '--border');
    const indentGuideActive = readCssVariableAsHex('--editor-indent-guide-active', '--ring');
    const tokenComment = readCssVariableAsHex('--editor-token-comment', '--code-comment');
    const tokenKeyword = readCssVariableAsHex('--editor-token-keyword', '--code-keyword');
    const tokenString = readCssVariableAsHex('--editor-token-string', '--code-string');
    const tokenNumber = readCssVariableAsHex('--editor-token-number', '--code-number');
    const tokenType = readCssVariableAsHex('--editor-token-type', '--code-function');
    const tokenInvalid = readCssVariableAsHex('--editor-token-invalid', '--destructive');

    const themeName = isLight ? 'tengra-light' : 'tengra-dark';
    monaco.editor.defineTheme(themeName, {
        base: isLight ? 'vs' : 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: tokenComment.replace('#', ''), fontStyle: 'italic' },
            { token: 'keyword', foreground: tokenKeyword.replace('#', '') },
            { token: 'string', foreground: tokenString.replace('#', '') },
            { token: 'number', foreground: tokenNumber.replace('#', '') },
            { token: 'type', foreground: tokenType.replace('#', '') },
            { token: 'invalid', foreground: tokenInvalid.replace('#', '') },
        ],
        colors: {
            'editor.background': background,
            'editor.foreground': foreground,
            'editorLineNumber.foreground': lineNumber,
            'editorLineNumber.activeForeground': lineNumberActive,
            'editorCursor.foreground': cursor,
            'editor.selectionBackground': `${selection}33`,
            'editor.inactiveSelectionBackground': `${selectionInactive}1f`,
            'editor.lineHighlightBackground': `${lineHighlight}80`,
            'editorIndentGuide.background1': `${indentGuide}80`,
            'editorIndentGuide.activeBackground1': indentGuideActive,
            'editorWidget.background': widgetBackground,
            'editorWidget.border': widgetBorder,
            'editorGutter.background': gutterBackground,
        },
    });
    monaco.editor.setTheme(themeName);
    return themeName;
}

export interface CodeEditorProps {
    value?: string;
    language?: string;
    onChange?: OnChange;
    readOnly?: boolean;
    className?: string;
    showMinimap?: boolean;
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
}

let textMateInitialized = false;
let textMateInitializing = false;

const useMonacoLoader = () => {
    const [monacoComponents, setMonacoComponents] = useState<{
        Editor: React.ComponentType<MonacoEditorComponentProps>;
        monaco: Monaco;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadMonaco()
            .then(({ Editor, monaco }) => {
                setMonacoComponents({
                    Editor: Editor as React.ComponentType<MonacoEditorComponentProps>,
                    monaco,
                });
                setLoading(false);
            })
            .catch(e => {
                window.electron.log.error('Failed to load Monaco', toError(e instanceof Error ? e : undefined));
                setLoading(false);
            });
    }, []);
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

const useEditorDecorations = (monaco: Monaco | null, t: (key: string) => string) => {
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
                            glyphMarginHoverMessage: { value: t('ssh.editor.aiRefactor') },
                        },
                    });
                }
            }
            decorationRef.current = editor.deltaDecorations(decorationRef.current, newDecorations);
        },
        [monaco, t]
    );
};

const useInlineCompletions = (
    monacoRef: React.MutableRefObject<Monaco | null>,
    normalizedLanguage: string,
    hasMonaco: boolean,
    aiSafetyFilterEnabled: boolean,
    aiContextLimit: number,
    inlineSuggestionConfig: InlineSuggestionConfig,
    readOnly: boolean
) => {
    const cacheRef = useRef<Map<string, InlineSuggestionCacheEntry>>(new Map());
    const latestRequestIdRef = useRef(0);
    const activeSessionRef = useRef<ActiveInlineSuggestionSession | null>(null);

    useEffect(() => {
        if (!monacoRef.current || !hasMonaco || !inlineSuggestionConfig.enabled || readOnly) {
            return;
        }
        const monaco = monacoRef.current;
        const trackTelemetry = (event: InlineSuggestionTelemetry) => {
            void window.electron.workspace.trackInlineSuggestionTelemetry(event).catch(() => {});
        };
        const commandDisposable = monaco.editor.registerCommand(
            INLINE_SUGGESTION_ACCEPT_COMMAND,
            (_accessor: unknown, payload: ActiveInlineSuggestionSession | undefined) => {
                if (!payload) {
                    return;
                }
                activeSessionRef.current = {
                    ...payload,
                    accepted: true,
                };
                trackTelemetry({
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
                pos: { lineNumber: number; column: number }
            ) => {
                const requestId = latestRequestIdRef.current + 1;
                latestRequestIdRef.current = requestId;
                await new Promise(resolve => {
                    setTimeout(resolve, INLINE_SUGGESTION_DEBOUNCE_MS);
                });
                if (requestId !== latestRequestIdRef.current) {
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
                    trackTelemetry({
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

                trackTelemetry({
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
                    if (requestId !== latestRequestIdRef.current) {
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
                        trackTelemetry({
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
            freeInlineCompletions: () => {
                const activeSession = activeSessionRef.current;
                if (!activeSession || activeSession.accepted) {
                    activeSessionRef.current = null;
                    return;
                }
                trackTelemetry({
                    event: 'reject',
                    source: activeSession.source,
                    provider: activeSession.provider,
                    model: activeSession.model,
                    language: activeSession.language,
                    cacheKey: activeSession.cacheKey,
                });
                activeSessionRef.current = null;
            },
            handleItemDidShow: (_completions: unknown, item: unknown) => {
                const commandCandidate =
                    item && typeof item === 'object' && 'command' in item
                        ? (item as { command?: { arguments?: unknown[] } }).command
                        : undefined;
                const session = commandCandidate?.arguments?.[0] as
                    | ActiveInlineSuggestionSession
                    | undefined;
                if (!session) {
                    return;
                }
                activeSessionRef.current = session;
                trackTelemetry({
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
    onScrollPositionChange?: (scrollTop: number) => void
) => {
    return useCallback(
        async (editor: MonacoEditorInstance, monaco: Monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            if (!textMateInitialized && !textMateInitializing) {
                textMateInitializing = true;
                try {
                    await initTextMateSupport(monaco);
                    textMateInitialized = true;
                } catch (e) {
                    window.electron.log.warn(
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
        },
        [
            initialPosition,
            initialScrollTop,
            onCursorPositionChange,
            onScrollPositionChange,
            updateDecorations,
            editorRef,
            monacoRef,
        ]
    );
};

const LoadingOverlay = ({ className, t }: { className?: string; t: (k: string) => string }) => (
    <div
        className={`relative w-full h-full overflow-hidden ${className} flex items-center justify-center`}
    >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
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

const EditorContainer: React.FC<{
    Editor: React.ComponentType<MonacoEditorComponentProps>;
    normalizedLanguage: string;
    value: string;
    onChange?: OnChange;
    theme: string;
    onMount: (e: MonacoEditorInstance, m: Monaco) => void;
    loading: React.ReactNode;
    options: editor.IStandaloneEditorConstructionOptions;
    className?: string;
}> = ({
    Editor,
    normalizedLanguage,
    value,
    onChange,
    theme,
    onMount,
    loading,
    options,
    className,
}) => (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            <Editor
                height="100%"
                defaultLanguage={normalizedLanguage}
                language={normalizedLanguage}
                value={value}
                onChange={onChange}
                theme={theme}
                onMount={onMount}
                loading={loading}
                options={options}
            />
        </div>
    );

export const CodeEditor: React.FC<CodeEditorProps> = ({
    value,
    language = 'typescript',
    onChange,
    readOnly = false,
    className,
    showMinimap = true,
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
}) => {
    const { isLight } = useTheme();
    const { t } = useTranslation(appLanguage);
    const editorRef = useRef<MonacoEditorInstance | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const settings = useSettingsStore(snapshot => snapshot.settings);
    const { monacoComponents, loading } = useMonacoLoader();
    const updateDecorations = useEditorDecorations(monacoComponents?.monaco ?? null, t);
    const normalizedLanguage = normalizeLanguage(language);
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
        aiSafetyFilterEnabled,
        aiContextLimit,
        resolvedInlineSuggestionConfig,
        readOnly
    );
    useEditorInitialLine(editorRef, initialLine);

    const handleEditorDidMount = useEditorLifecycle(
        editorRef,
        monacoRef,
        updateDecorations,
        initialPosition,
        initialScrollTop,
        onCursorPositionChange,
        onScrollPositionChange
    );

    const monacoTheme = useMemo(() => {
        if (!monacoComponents?.monaco) {
            return isLight ? 'vs' : 'vs-dark';
        }
        return applyMonacoTheme(monacoComponents.monaco, isLight);
    }, [monacoComponents, isLight]);

    const editorOptions = useMemo(
        (): editor.IStandaloneEditorConstructionOptions => ({
            minimap: { enabled: showMinimap },
            fontSize: fontSize ?? 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            scrollBeyondLastLine: false,
            readOnly,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
            tabSize: 4,
            glyphMargin: enableCodeLens && !performanceMode,
            lineNumbers: 'on',
            folding: true,
            lineDecorationsWidth: 10,
            fixedOverflowWidgets: true,
            codeLens: enableCodeLens && !performanceMode,
            inlayHints: { enabled: enableInlayHints && !performanceMode ? 'on' : 'off' },
            inlineSuggest: {
                enabled: resolvedInlineSuggestionConfig.enabled && !readOnly,
            },
        }),
        [
            showMinimap,
            fontSize,
            readOnly,
            enableCodeLens,
            performanceMode,
            enableInlayHints,
            resolvedInlineSuggestionConfig.enabled,
        ]
    );

    if (loading || !monacoComponents) {
        return <LoadingOverlay className={className} t={t} />;
    }

    return (
        <EditorContainer
            Editor={monacoComponents.Editor}
            normalizedLanguage={normalizedLanguage}
            value={value ?? ''}
            onChange={onChange}
            theme={monacoTheme}
            onMount={(e: MonacoEditorInstance, m: Monaco) => {
                void handleEditorDidMount(e, m);
            }}
            loading={
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t('ssh.editor.initializing')}
                </div>
            }
            options={editorOptions}
            className={className}
        />
    );
};

