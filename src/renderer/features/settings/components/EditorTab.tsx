/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconAlignLeft, IconBolt,IconCode, IconEye, IconLayersLinked, IconPointer, IconSettings2, IconSparkles, IconTypography } from '@tabler/icons-react';
import React, { useMemo, useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { CodeEditor } from '@/components/ui/CodeEditor';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { JsonValue } from '@/types';

import type { SettingsSharedProps } from '../types';

import { SettingsField, SettingsPanel } from './SettingsPrimitives';

type EditorTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'updateEditor' | 't'
>;

const LINE_NUMBER_OPTIONS = ['on', 'off', 'relative', 'interval'] as const;
const CURSOR_BLINK_OPTIONS = ['blink', 'smooth', 'phase', 'expand', 'solid'] as const;
const CURSOR_STYLE_OPTIONS = ['block', 'line', 'underline', 'line-thin', 'block-outline', 'underline-thin'] as const;
const RENDER_WHITESPACE_OPTIONS = ['none', 'boundary', 'selection', 'trailing', 'all'] as const;
const RENDER_LINE_HIGHLIGHT_OPTIONS = ['none', 'gutter', 'line', 'all'] as const;
const MINIMAP_SIDE_OPTIONS = ['left', 'right'] as const;
const FOLDING_CONTROLS_OPTIONS = ['always', 'mouseover'] as const;
const ACCEPT_SUGGESTION_OPTIONS = ['on', 'off', 'smart'] as const;
const MULTI_CURSOR_MODIFIER_OPTIONS = ['ctrlCmd', 'alt'] as const;
const FINAL_NEWLINE_OPTIONS = ['on', 'off', 'dimmed'] as const;

const PREVIEW_CODE = `/**
 * Tengra AI - Live Editor Preview
 * Change the settings on the left to see how the editor adjusts.
 */
function calculateAura(intensity: number): string {
    const symbols = ["✨", "🚀", "🔥"];
    
    // Bracket pair colorization test
    if (intensity > 9000) {
        return symbols.map(s => s.repeat(3)).join(" ");
    }
    
    return "Charging...";
}

const result = calculateAura(9001);
console.log(result); // It's over 9000!`;

function parseAdditionalOptions(value: string): Record<string, JsonValue> | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(trimmed) as Record<string, JsonValue>;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function MonacoToggleRow({
    label,
    description,
    checked,
    icon: Icon,
    onCheckedChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    icon?: React.ElementType;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div 
            className={cn(
                "group relative flex items-center justify-between rounded-2xl border border-border/20 bg-background/40 p-4 transition-all duration-300 hover:bg-background/60",
                checked && "border-primary/20 bg-primary/5"
            )}
        >
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground transition-colors group-hover:bg-muted/60",
                        checked && "bg-primary/10 text-primary"
                    )}>
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                <div className="flex flex-col gap-0.5">
                    <span className="typo-body font-semibold text-foreground">{label}</span>
                    {description && <span className="typo-caption text-muted-foreground/60">{description}</span>}
                </div>
            </div>
            <Checkbox
                checked={checked}
                onCheckedChange={value => {
                    onCheckedChange(value === true);
                }}
                className="h-5 w-5 rounded-md border-border/40 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
        </div>
    );
}

export const EditorTab: React.FC<EditorTabProps> = ({
    settings,
    updateEditor,
    t,
}) => {
    const [previewLanguage, setPreviewLanguage] = useState<'typescript' | 'python' | 'javascript'>('typescript');

    const editorSettings = useMemo(() => {
        if (!settings) {return null;}
        return {
            fontSize: settings.editor?.fontSize ?? 14,
        fontFamily: settings.editor?.fontFamily ?? '',
        fontWeight: settings.editor?.fontWeight ?? 'normal',
        letterSpacing: settings.editor?.letterSpacing ?? 0,
        lineHeight: settings.editor?.lineHeight ?? 1.6,
        minimap: settings.editor?.minimap ?? true,
        minimapSide: settings.editor?.minimapSide ?? 'right',
        wordWrap: settings.editor?.wordWrap ?? 'off',
        lineNumbers: settings.editor?.lineNumbers ?? 'on',
        tabSize: settings.editor?.tabSize ?? 4,
        cursorBlinking: settings.editor?.cursorBlinking ?? 'smooth',
        cursorStyle: settings.editor?.cursorStyle ?? 'line',
        cursorWidth: settings.editor?.cursorWidth ?? 2,
        fontLigatures: settings.editor?.fontLigatures ?? true,
        formatOnPaste: settings.editor?.formatOnPaste ?? true,
        formatOnType: settings.editor?.formatOnType ?? true,
        smoothScrolling: settings.editor?.smoothScrolling ?? true,
        folding: settings.editor?.folding ?? true,
        showFoldingControls: settings.editor?.showFoldingControls ?? 'mouseover',
        codeLens: settings.editor?.codeLens ?? true,
        inlayHints: settings.editor?.inlayHints ?? true,
        renderWhitespace: settings.editor?.renderWhitespace ?? 'selection',
        renderLineHighlight: settings.editor?.renderLineHighlight ?? 'line',
        renderControlCharacters: settings.editor?.renderControlCharacters ?? false,
        roundedSelection: settings.editor?.roundedSelection ?? true,
        scrollBeyondLastLine: settings.editor?.scrollBeyondLastLine ?? true,
        cursorSmoothCaretAnimation:
            settings.editor?.cursorSmoothCaretAnimation ?? 'on',
        wordBasedSuggestions:
            settings.editor?.wordBasedSuggestions ?? 'matchingDocuments',
        acceptSuggestionOnEnter: settings.editor?.acceptSuggestionOnEnter ?? 'on',
        suggestFontSize: settings.editor?.suggestFontSize ?? 0,
        suggestLineHeight: settings.editor?.suggestLineHeight ?? 0,
        stickyScroll: settings.editor?.stickyScroll ?? true,
        bracketPairColorization:
            settings.editor?.bracketPairColorization ?? true,
        guidesIndentation: settings.editor?.guidesIndentation ?? true,
        mouseWheelZoom: settings.editor?.mouseWheelZoom ?? false,
        multiCursorModifier: settings.editor?.multiCursorModifier ?? 'alt',
        occurrenceHighlight: settings.editor?.occurrenceHighlight ?? true,
        selectionHighlight: settings.editor?.selectionHighlight ?? true,
        renderFinalNewline: settings.editor?.renderFinalNewline ?? 'on',
        minimapRenderCharacters:
            settings.editor?.minimapRenderCharacters ?? false,
        additionalOptionsString: settings.editor?.additionalOptions
            ? JSON.stringify(settings.editor.additionalOptions, null, 2)
            : '',
        additionalOptions: settings.editor?.additionalOptions ?? {},
        };
    }, [settings]);

    if (!settings || !editorSettings) {
        return null;
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-20">
            {/* Split Layout Header */}
            <div className="flex flex-col gap-4 px-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                        <IconCode className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t('settings.editorTitle')}</h2>
                        <p className="typo-body text-muted-foreground/60">{t('settings.editorDescription')}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-editor-split">
                {/* Left Column: Settings */}
                <div className="flex flex-col gap-10">
                    
                    {/* Typography */}
                    <SettingsPanel
                        title={t('settings.editor.typographyTitle') || "Typography"}
                        description="Font settings and character spacing."
                        icon={IconTypography}
                        className="border-none bg-transparent p-0 shadow-none space-y-6"
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <SettingsField 
                                label={t('settings.editor.option.fontSize')} 
                                description="Adjust the editor font size."
                            >
                                <div className="flex items-center gap-4">
                                    <Slider 
                                        value={[editorSettings.fontSize]} 
                                        min={10} 
                                        max={32} 
                                        step={1}
                                        onValueChange={([val]) => updateEditor({ fontSize: val })}
                                        className="flex-1"
                                    />
                                    <span className="w-10 text-center typo-body font-mono font-bold text-primary">
                                        {editorSettings.fontSize}
                                    </span>
                                </div>
                            </SettingsField>

                            <SettingsField 
                                label={t('settings.editor.option.lineHeight')}
                                description="Fine-tune text vertical spacing."
                            >
                                <div className="flex items-center gap-4">
                                    <Slider 
                                        value={[editorSettings.lineHeight]} 
                                        min={1} 
                                        max={3} 
                                        step={0.1}
                                        onValueChange={([val]) => updateEditor({ lineHeight: val })}
                                        className="flex-1"
                                    />
                                    <span className="w-10 text-center typo-body font-mono font-bold text-primary">
                                        {editorSettings.lineHeight.toFixed(1)}
                                    </span>
                                </div>
                            </SettingsField>

                             <SettingsField label={t('settings.editor.option.fontFamily')}>
                                <Select
                                    value={editorSettings.fontFamily || 'default'}
                                    onValueChange={val => updateEditor({ fontFamily: val === 'default' ? '' : val })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        <SelectItem value="default">System Default</SelectItem>
                                        <SelectItem value="'JetBrains Mono', monospace">JetBrains Mono</SelectItem>
                                        <SelectItem value="'Fira Code', monospace">Fira Code</SelectItem>
                                        <SelectItem value="'Roboto Mono', monospace">Roboto Mono</SelectItem>
                                        <SelectItem value="'Source Code Pro', monospace">Source Code Pro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </SettingsField>

                            <SettingsField label={t('settings.editor.option.fontWeight')}>
                                <Select
                                    value={editorSettings.fontWeight}
                                    onValueChange={val => updateEditor({ fontWeight: val })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        {['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map(w => (
                                            <SelectItem key={w} value={w}>{w}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsField>
                        </div>
                    </SettingsPanel>

                    {/* Interface Layout */}
                    <SettingsPanel
                        title={t('settings.editor.layoutTitle')}
                        description="Visual appearance and geometry."
                        icon={IconLayersLinked}
                        className="border-none bg-transparent p-0 shadow-none space-y-6"
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <SettingsField label={t('settings.editor.option.tabSize')}>
                                <Select
                                    value={editorSettings.tabSize.toString()}
                                    onValueChange={val => updateEditor({ tabSize: parseInt(val, 10) })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        {[2, 4, 8].map(size => (
                                            <SelectItem key={size} value={size.toString()}>
                                                {size} spaces
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsField>

                            <SettingsField label={t('settings.editor.option.lineNumbers')}>
                                <Select
                                    value={editorSettings.lineNumbers}
                                    onValueChange={value => updateEditor({ lineNumbers: value as typeof LINE_NUMBER_OPTIONS[number] })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        {LINE_NUMBER_OPTIONS.map(option => (
                                            <SelectItem key={option} value={option}>
                                                {t(`settings.editor.lineNumbers.${option}`) || option}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsField>

                             <SettingsField label={t('settings.editor.option.minimapSide')}>
                                <Select
                                    value={editorSettings.minimapSide}
                                    onValueChange={value => updateEditor({ minimapSide: value as typeof MINIMAP_SIDE_OPTIONS[number] })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        {MINIMAP_SIDE_OPTIONS.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsField>

                             <SettingsField label={t('settings.editor.option.renderLineHighlight')}>
                                <Select
                                    value={editorSettings.renderLineHighlight}
                                    onValueChange={value => updateEditor({ renderLineHighlight: value as typeof RENDER_LINE_HIGHLIGHT_OPTIONS[number] })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        {RENDER_LINE_HIGHLIGHT_OPTIONS.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsField>

                             <SettingsField label={t('settings.editor.option.showFoldingControls')}>
                                <Select
                                    value={editorSettings.showFoldingControls}
                                    onValueChange={value => updateEditor({ showFoldingControls: value as typeof FOLDING_CONTROLS_OPTIONS[number] })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        {FOLDING_CONTROLS_OPTIONS.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsField>

                             <SettingsField label={t('settings.editor.option.renderFinalNewline')}>
                                <Select
                                    value={editorSettings.renderFinalNewline}
                                    onValueChange={value => updateEditor({ renderFinalNewline: value as typeof FINAL_NEWLINE_OPTIONS[number] })}
                                >
                                    <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border/30">
                                        {FINAL_NEWLINE_OPTIONS.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsField>
                        </div>
                    </SettingsPanel>

                    {/* Features & Behavior */}
                    <SettingsPanel
                        title={t('settings.editor.behaviorTitle')}
                        description="Intelligent features and interactions."
                        icon={IconBolt}
                        className="border-none bg-transparent p-0 shadow-none space-y-6"
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                             <MonacoToggleRow
                                label={t('settings.editor.option.minimap')}
                                description="High-level code overview"
                                checked={editorSettings.minimap}
                                icon={IconEye}
                                onCheckedChange={checked => updateEditor({ minimap: checked })}
                            />
                            <MonacoToggleRow
                                label={t('settings.editor.option.wordWrap')}
                                description="Wrap long lines automatically"
                                checked={editorSettings.wordWrap !== 'off'}
                                icon={IconAlignLeft}
                                onCheckedChange={checked => updateEditor({ wordWrap: checked ? 'on' : 'off' })}
                            />
                            <MonacoToggleRow
                                label={t('settings.editor.option.bracketPairColorization')}
                                description="Highlight matching brackets"
                                checked={editorSettings.bracketPairColorization}
                                icon={IconSparkles}
                                onCheckedChange={checked => updateEditor({ bracketPairColorization: checked })}
                            />
                            <MonacoToggleRow
                                label={t('settings.editor.option.stickyScroll')}
                                description="Pin scope headers during scroll"
                                checked={editorSettings.stickyScroll}
                                icon={IconLayersLinked}
                                onCheckedChange={checked => updateEditor({ stickyScroll: checked })}
                            />
                             <MonacoToggleRow
                                label={t('settings.editor.option.scrollBeyondLastLine')}
                                description="Scroll past final line"
                                checked={editorSettings.scrollBeyondLastLine}
                                icon={IconPointer}
                                onCheckedChange={checked => updateEditor({ scrollBeyondLastLine: checked })}
                            />
                             <MonacoToggleRow
                                label={t('settings.editor.option.smoothScrolling')}
                                description="Fluid editor movement"
                                checked={editorSettings.smoothScrolling}
                                icon={IconActivity}
                                onCheckedChange={checked => updateEditor({ smoothScrolling: checked })}
                            />
                             <MonacoToggleRow
                                label={t('settings.editor.option.fontLigatures')}
                                description="Combine characters into symbols"
                                checked={editorSettings.fontLigatures}
                                icon={IconSettings2}
                                onCheckedChange={checked => updateEditor({ fontLigatures: checked })}
                            />
                             <MonacoToggleRow
                                label={t('settings.editor.option.renderControlCharacters')}
                                description="Show non-printable symbols"
                                checked={editorSettings.renderControlCharacters}
                                icon={IconCode}
                                onCheckedChange={checked => updateEditor({ renderControlCharacters: checked })}
                            />
                             <MonacoToggleRow
                                label={t('settings.editor.option.roundedSelection')}
                                description="Use rounded selection corners"
                                checked={editorSettings.roundedSelection}
                                icon={IconSparkles}
                                onCheckedChange={checked => updateEditor({ roundedSelection: checked })}
                            />
                             <MonacoToggleRow
                                label={t('settings.editor.option.occurrenceHighlight')}
                                description="Highlight occurrences of symbols"
                                checked={editorSettings.occurrenceHighlight}
                                icon={IconActivity}
                                onCheckedChange={checked => updateEditor({ occurrenceHighlight: checked })}
                            />
                        </div>
                    </SettingsPanel>

                    {/* Advanced Controls */}
                    <SettingsPanel
                        title="Advanced Customization"
                        description="Deep hooks into the Monaco engine."
                        icon={IconSettings2}
                        className="border-none bg-transparent p-0 shadow-none space-y-6"
                    >
                        <div className="grid gap-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                <SettingsField label={t('settings.editor.option.cursorStyle')}>
                                    <Select
                                        value={editorSettings.cursorStyle}
                                        onValueChange={value => updateEditor({ cursorStyle: value as typeof CURSOR_STYLE_OPTIONS[number] })}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border/30">
                                            {CURSOR_STYLE_OPTIONS.map(option => (
                                                <SelectItem key={option} value={option}>{option}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SettingsField>

                                <SettingsField label={t('settings.editor.option.cursorBlinking')}>
                                    <Select
                                        value={editorSettings.cursorBlinking}
                                        onValueChange={value => updateEditor({ cursorBlinking: value as typeof CURSOR_BLINK_OPTIONS[number] })}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border/30">
                                            {CURSOR_BLINK_OPTIONS.map(option => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SettingsField>

                                <SettingsField label={t('settings.editor.option.renderWhitespace')}>
                                    <Select
                                        value={editorSettings.renderWhitespace}
                                        onValueChange={value => updateEditor({ renderWhitespace: value as typeof RENDER_WHITESPACE_OPTIONS[number] })}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border/30">
                                            {RENDER_WHITESPACE_OPTIONS.map(option => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SettingsField>

                                <SettingsField label={t('settings.editor.option.acceptSuggestionOnEnter')}>
                                    <Select
                                        value={editorSettings.acceptSuggestionOnEnter}
                                        onValueChange={value => updateEditor({ acceptSuggestionOnEnter: value as typeof ACCEPT_SUGGESTION_OPTIONS[number] })}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border/30">
                                            {ACCEPT_SUGGESTION_OPTIONS.map(option => (
                                                <SelectItem key={option} value={option}>{option}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SettingsField>

                                 <SettingsField label={t('settings.editor.option.multiCursorModifier')}>
                                    <Select
                                        value={editorSettings.multiCursorModifier}
                                        onValueChange={value => updateEditor({ multiCursorModifier: value as typeof MULTI_CURSOR_MODIFIER_OPTIONS[number] })}
                                    >
                                        <SelectTrigger className="h-11 w-full rounded-2xl bg-background/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-border/30">
                                            {MULTI_CURSOR_MODIFIER_OPTIONS.map(option => (
                                                <SelectItem key={option} value={option}>{option}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SettingsField>
                            </div>

                             <SettingsField 
                                label={t('settings.editor.option.additionalOptions')}
                                description="JSON configuration overrides."
                            >
                                <div className="group relative">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-transparent rounded-2xl blur opacity-0 transition group-hover:opacity-100" />
                                    <Textarea
                                        key={editorSettings.additionalOptionsString}
                                        defaultValue={editorSettings.additionalOptionsString}
                                        onBlur={event => {
                                            void updateEditor({
                                                additionalOptions: parseAdditionalOptions(event.target.value),
                                            });
                                        }}
                                        rows={8}
                                        spellCheck={false}
                                        className="relative min-h-160 resize-none rounded-2xl border border-border/20 bg-background/60 p-5 font-mono typo-caption shadow-inner focus:ring-primary/20"
                                        placeholder={t('settings.editor.additionalOptionsPlaceholder')}
                                    />
                                </div>
                            </SettingsField>
                        </div>
                    </SettingsPanel>
                </div>

                {/* Right Column: Sticky Preview */}
                <div className="hidden lg:block">
                    <div className="sticky top-10 flex flex-col gap-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-success" />
                                <span className="typo-caption font-bold text-foreground">LIVE PREVIEW</span>
                            </div>
                            <div className="flex gap-1 rounded-lg bg-muted/20 p-1">
                                {(['typescript', 'python'] as const).map(lang => (
                                    <button
                                        key={lang}
                                        onClick={() => setPreviewLanguage(lang)}
                                        className={cn(
                                            "rounded-md px-2 py-1 typo-caption font-bold transition-all",
                                            previewLanguage === lang 
                                                ? "bg-background text-primary shadow-sm" 
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {lang.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="group relative">
                            {/* Glass decoration */}
                            <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/30 to-transparent rounded-card-xl blur opacity-50 transition duration-1000 group-hover:opacity-80" />
                            
                            <div className="relative overflow-hidden rounded-card-lg border border-border/30 bg-card/40 shadow-2xl backdrop-blur-xl">
                                {/* Editor Header */}
                                <div className="flex h-10 items-center gap-2 border-b border-border/20 bg-muted/10 px-4">
                                    <div className="flex gap-1.5">
                                        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                                        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                                        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
                                    </div>
                                    <span className="mx-auto typo-caption font-mono text-muted-foreground/60">preview.{previewLanguage === 'typescript' ? 'ts' : 'py'}</span>
                                </div>

                                <div className="h-500">
                                    <CodeEditor
                                        value={PREVIEW_CODE}
                                        language={previewLanguage}
                                        workspaceEditorSettings={{
                                            ...editorSettings,
                                            minimapRenderCharacters: true, // Specific for preview
                                        }}
                                        readOnly
                                        className="h-full"
                                    />
                                </div>
                            </div>

                            {/* Floating hint */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-xl transition-all duration-500 group-hover:-translate-y-2">
                                <div className="flex items-center gap-2 typo-caption font-bold">
                                    <IconActivity className="h-3.5 w-3.5" />
                                    UPDATED IN REAL-TIME
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
