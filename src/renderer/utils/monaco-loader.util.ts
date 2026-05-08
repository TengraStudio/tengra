/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { loader } from '@monaco-editor/react';
import * as monacoCore from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import { appLogger } from './renderer-logger';

import 'monaco-editor/esm/vs/editor/editor.all.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/monaco.contribution';

type MonacoModule = typeof monacoCore;
type MonacoWorkerFactory = new () => Worker;
interface MonacoTypeScriptDefaults {
    setEagerModelSync(value: boolean): void;
    setCompilerOptions(options: Record<string, boolean | number>): void;
    setDiagnosticsOptions(options: {
        noSemanticValidation: boolean;
        noSyntaxValidation: boolean;
        noSuggestionDiagnostics: boolean;
    }): void;
}

interface MonacoTypeScriptApi {
    JsxEmit: { ReactJSX: number };
    ModuleResolutionKind: { NodeJs: number };
    ModuleKind: { ESNext: number };
    ScriptTarget: { ES2022: number };
    javascriptDefaults: MonacoTypeScriptDefaults;
    typescriptDefaults: MonacoTypeScriptDefaults;
}

let monacoInitPromise: Promise<MonacoModule> | null = null;
let monacoEnvironmentConfigured = false;
let monacoDefaultsConfigured = false;

function getMonacoWorker(label: string): Worker {
    const workerFactory: MonacoWorkerFactory =
        label === 'json'
            ? jsonWorker
            : label === 'css' || label === 'scss' || label === 'less'
                ? cssWorker
                : label === 'html' || label === 'handlebars' || label === 'razor'
                    ? htmlWorker
                    : label === 'typescript' || label === 'javascript'
                        ? tsWorker
                        : editorWorker;
    return new workerFactory();
}

function ensureMonacoEnvironment(): void {
    if (monacoEnvironmentConfigured) {
        return;
    }
    Object.assign(globalThis, {
        MonacoEnvironment: {
            getWorker: (_workerId: string, label: string) => getMonacoWorker(label),
        },
    });
    monacoEnvironmentConfigured = true;
}

function configureMonacoLanguageDefaults(monaco: MonacoModule): void {
    if (monacoDefaultsConfigured) {
        return;
    }

    const typeScriptApi = monaco.languages.typescript as never as MonacoTypeScriptApi;
    if (!typeScriptApi?.JsxEmit) {
        console.warn('[MonacoLoader] TypeScript API or JsxEmit not available, skipping compiler options configuration');
        return;
    }

    const compilerOptions: Record<string, boolean | number> = {
        allowJs: true,
        allowNonTsExtensions: true,
        jsx: typeScriptApi.JsxEmit.ReactJSX,
        moduleResolution: typeScriptApi.ModuleResolutionKind.NodeJs,
        module: typeScriptApi.ModuleKind.ESNext,
        target: typeScriptApi.ScriptTarget.ES2022,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        isolatedModules: true,
    };

    typeScriptApi.javascriptDefaults.setEagerModelSync(true);
    typeScriptApi.typescriptDefaults.setEagerModelSync(true);
    typeScriptApi.javascriptDefaults.setCompilerOptions(compilerOptions);
    typeScriptApi.typescriptDefaults.setCompilerOptions(compilerOptions);
    typeScriptApi.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
    });
    typeScriptApi.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
    });

    monacoDefaultsConfigured = true;
}

/**
 * Configure Monaco loader to use local bundled Monaco.
 */
export async function ensureMonacoInitialized(): Promise<MonacoModule> {
    if (monacoInitPromise) {
        return monacoInitPromise;
    }

    monacoInitPromise = (async () => {
        try {
            ensureMonacoEnvironment();

            // Config loader to use our statically imported monaco instance
            loader.config({
                monaco: monacoCore
            });

            const monaco = await loader.init();
            configureMonacoLanguageDefaults(monaco);

            return monaco;
        } catch (error) {
            appLogger.error('MonacoLoader', 'Initialization failed', error as Error);
            throw error;
        }
    })();

    return monacoInitPromise;
}

function rgbChannelToHex(channel: number): string {
    return channel.toString(16).padStart(2, '0');
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

class MonacoColorResolver {
    private static cache = new Map<string, string>();
    private static lastComputedStyle: CSSStyleDeclaration | null = null;
    private static probe: HTMLSpanElement | null = null;

    static clearCache() {
        this.cache.clear();
        this.lastComputedStyle = null;
    }

    static resolve(name: string, fallbackName?: string): string {
        const cacheKey = `${name}:${fallbackName}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        if (!this.lastComputedStyle) {
            this.lastComputedStyle = getComputedStyle(document.documentElement);
        }

        const primaryToken = this.lastComputedStyle.getPropertyValue(name).trim();
        const fallbackToken = fallbackName ? this.lastComputedStyle.getPropertyValue(fallbackName).trim() : '';
        const cssToken = primaryToken || fallbackToken;

        if (!cssToken) {
            const bodyStyle = getComputedStyle(document.body);
            const fallback =
                toHexColorFromComputedColor(bodyStyle.color) ??
                toHexColorFromComputedColor(this.lastComputedStyle.color) ??
                toHexColorFromComputedColor(bodyStyle.backgroundColor);
            
            if (!fallback) {
                return '#888888'; // Safe fallback
            }
            this.cache.set(cacheKey, fallback);
            return fallback;
        }

        if (!this.probe) {
            this.probe = document.createElement('span');
            this.probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;';
            document.body.appendChild(this.probe);
        }

        this.probe.style.color = cssToken.includes('%') ? `hsl(${cssToken})` : cssToken;
        const resolvedColor = getComputedStyle(this.probe).color;
        const resolved =
            toHexColorFromComputedColor(resolvedColor) ??
            toHexColorFromComputedColor(getComputedStyle(document.body).color) ?? '#888888';

        this.cache.set(cacheKey, resolved);
        return resolved;
    }
}

let lastThemeConfig: string | null = null;

export function applyMonacoTheme(monaco: typeof monacoCore, isLight: boolean): string {
    MonacoColorResolver.clearCache();
    
    const colors = {
        background: MonacoColorResolver.resolve('--editor-background', '--background'),
        foreground: MonacoColorResolver.resolve('--editor-foreground', '--foreground'),
        gutterBackground: MonacoColorResolver.resolve('--editor-gutter-background', '--background'),
        widgetBackground: MonacoColorResolver.resolve('--editor-widget-background', '--card'),
        widgetBorder: MonacoColorResolver.resolve('--editor-widget-border', '--border'),
        lineNumber: MonacoColorResolver.resolve('--editor-line-number', '--muted-foreground'),
        lineNumberActive: MonacoColorResolver.resolve('--editor-line-number-active', '--foreground'),
        cursor: MonacoColorResolver.resolve('--editor-cursor', '--primary'),
        selection: MonacoColorResolver.resolve('--editor-selection', '--primary'),
        selectionInactive: MonacoColorResolver.resolve('--editor-selection-inactive', '--accent'),
        lineHighlight: MonacoColorResolver.resolve('--editor-line-highlight', '--card'),
        indentGuide: MonacoColorResolver.resolve('--editor-indent-guide', '--border'),
        indentGuideActive: MonacoColorResolver.resolve('--editor-indent-guide-active', '--ring'),
        tokenComment: MonacoColorResolver.resolve('--editor-token-comment', '--code-comment'),
        tokenKeyword: MonacoColorResolver.resolve('--editor-token-keyword', '--code-keyword'),
        tokenString: MonacoColorResolver.resolve('--editor-token-string', '--code-string'),
        tokenNumber: MonacoColorResolver.resolve('--editor-token-number', '--code-number'),
        tokenType: MonacoColorResolver.resolve('--editor-token-type', '--code-function'),
        tokenInvalid: MonacoColorResolver.resolve('--editor-token-invalid', '--destructive'),
    };

    const themeConfig = JSON.stringify({ isLight, ...colors });
    const themeName = isLight ? 'tengra-light' : 'tengra-dark';

    if (lastThemeConfig !== themeConfig) {
        monaco.editor.defineTheme(themeName, {
            base: isLight ? 'vs' : 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: colors.tokenComment.replace('#', '') },
                { token: 'keyword', foreground: colors.tokenKeyword.replace('#', '') },
                { token: 'string', foreground: colors.tokenString.replace('#', '') },
                { token: 'number', foreground: colors.tokenNumber.replace('#', '') },
                { token: 'type', foreground: colors.tokenType.replace('#', '') },
                { token: 'invalid', foreground: colors.tokenInvalid.replace('#', '') },
            ],
            colors: {
                'editor.background': colors.background,
                'editor.foreground': colors.foreground,
                'editorLineNumber.foreground': colors.lineNumber,
                'editorLineNumber.activeForeground': colors.lineNumberActive,
                'editorCursor.foreground': colors.cursor,
                'editor.selectionBackground': `${colors.selection}33`,
                'editor.inactiveSelectionBackground': `${colors.selectionInactive}1f`,
                'editor.lineHighlightBackground': `${colors.lineHighlight}80`,
                'editorIndentGuide.background1': `${colors.indentGuide}80`,
                'editorIndentGuide.activeBackground1': colors.indentGuideActive,
                'editorWidget.background': colors.widgetBackground,
                'editorWidget.border': colors.widgetBorder,
                'editorGutter.background': colors.gutterBackground,
                'editorWhitespace.foreground': `${colors.indentGuide}66`,
                'editorBracketHighlight.foreground1': colors.tokenType,
                'editorBracketHighlight.foreground2': colors.tokenString,
                'editorBracketHighlight.foreground3': colors.tokenKeyword,
            },
        });
        lastThemeConfig = themeConfig;
    }

    monaco.editor.setTheme(themeName);
    return themeName;
}

