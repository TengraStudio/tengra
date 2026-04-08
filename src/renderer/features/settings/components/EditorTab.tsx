import { Checkbox } from '@renderer/components/ui/checkbox';
import { Input } from '@renderer/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import { Code, LayoutPanelLeft, MousePointer2, Type } from 'lucide-react';
import React from 'react';

import type { JsonValue } from '@/types';

import type { SettingsSharedProps } from '../types';

import { SettingsField, SettingsInputClassName, SettingsPanel } from './SettingsPrimitives';

type EditorTabProps = Pick<
    SettingsSharedProps,
    'settings' | 'updateEditor' | 't'
>;

const WORD_WRAP_OPTIONS = ['off', 'on', 'wordWrapColumn', 'bounded'] as const;
const LINE_NUMBER_OPTIONS = ['on', 'off', 'relative', 'interval'] as const;
const CURSOR_BLINK_OPTIONS = ['blink', 'smooth', 'phase', 'expand', 'solid'] as const;
const RENDER_WHITESPACE_OPTIONS = ['none', 'boundary', 'selection', 'trailing', 'all'] as const;
const CARET_ANIMATION_OPTIONS = ['on', 'off', 'explicit'] as const;
const WORD_BASED_SUGGESTION_OPTIONS = ['off', 'currentDocument', 'matchingDocuments', 'allDocuments'] as const;

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
    checked,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-border/20 bg-background/60 px-4 py-3">
            <span className="text-xs text-foreground">{label}</span>
            <Checkbox
                checked={checked}
                onCheckedChange={value => {
                    onCheckedChange(value === true);
                }}
            />
        </div>
    );
}

export const EditorTab: React.FC<EditorTabProps> = ({
    settings,
    updateEditor,
    t,
}) => {
    if (!settings) {
        return null;
    }

    const editorSettings = {
        fontSize: settings.editor?.fontSize ?? 14,
        lineHeight: settings.editor?.lineHeight ?? 1.6,
        minimap: settings.editor?.minimap ?? true,
        wordWrap: settings.editor?.wordWrap ?? 'off',
        lineNumbers: settings.editor?.lineNumbers ?? 'on',
        tabSize: settings.editor?.tabSize ?? 4,
        cursorBlinking: settings.editor?.cursorBlinking ?? 'smooth',
        fontLigatures: settings.editor?.fontLigatures ?? true,
        formatOnPaste: settings.editor?.formatOnPaste ?? true,
        formatOnType: settings.editor?.formatOnType ?? true,
        smoothScrolling: settings.editor?.smoothScrolling ?? true,
        folding: settings.editor?.folding ?? true,
        codeLens: settings.editor?.codeLens ?? true,
        inlayHints: settings.editor?.inlayHints ?? true,
        renderWhitespace: settings.editor?.renderWhitespace ?? 'selection',
        cursorSmoothCaretAnimation:
            settings.editor?.cursorSmoothCaretAnimation ?? 'on',
        wordBasedSuggestions:
            settings.editor?.wordBasedSuggestions ?? 'matchingDocuments',
        stickyScroll: settings.editor?.stickyScroll ?? true,
        bracketPairColorization:
            settings.editor?.bracketPairColorization ?? true,
        guidesIndentation: settings.editor?.guidesIndentation ?? true,
        mouseWheelZoom: settings.editor?.mouseWheelZoom ?? false,
        minimapRenderCharacters:
            settings.editor?.minimapRenderCharacters ?? false,
        additionalOptions: settings.editor?.additionalOptions
            ? JSON.stringify(settings.editor.additionalOptions, null, 2)
            : '',
    };

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
            <SettingsPanel
                title={t('settings.editorTitle')}
                description={t('settings.editorDescription')}
                icon={Code}
            >
                <div className="grid gap-5 md:grid-cols-2">
                    <SettingsField label={t('settings.editor.option.fontSize')}>
                        <Input
                            type="number"
                            min={10}
                            max={32}
                            value={editorSettings.fontSize}
                            onChange={event => {
                                const nextValue = Number.parseInt(event.target.value, 10);
                                void updateEditor({
                                    fontSize: Number.isNaN(nextValue) ? 14 : nextValue,
                                });
                            }}
                            className={SettingsInputClassName}
                        />
                    </SettingsField>

                    <SettingsField label={t('settings.editor.option.lineHeight')}>
                        <Input
                            type="number"
                            min={1}
                            max={3}
                            step={0.1}
                            value={editorSettings.lineHeight}
                            onChange={event => {
                                const nextValue = Number.parseFloat(event.target.value);
                                void updateEditor({
                                    lineHeight: Number.isNaN(nextValue) ? 1.6 : nextValue,
                                });
                            }}
                            className={SettingsInputClassName}
                        />
                    </SettingsField>

                    <SettingsField label={t('settings.editor.option.tabSize')}>
                        <Input
                            type="number"
                            min={1}
                            max={8}
                            value={editorSettings.tabSize}
                            onChange={event => {
                                const nextValue = Number.parseInt(event.target.value, 10);
                                void updateEditor({
                                    tabSize: Number.isNaN(nextValue) ? 4 : nextValue,
                                });
                            }}
                            className={SettingsInputClassName}
                        />
                    </SettingsField>

                    <SettingsField label={t('settings.editor.option.wordWrap')}>
                        <Select
                            value={editorSettings.wordWrap}
                            onValueChange={value => {
                                if (WORD_WRAP_OPTIONS.includes(value as typeof WORD_WRAP_OPTIONS[number])) {
                                    void updateEditor({
                                        wordWrap: value as typeof WORD_WRAP_OPTIONS[number],
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/30">
                                {WORD_WRAP_OPTIONS.map(option => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsField>

                    <SettingsField label={t('settings.editor.option.lineNumbers')}>
                        <Select
                            value={editorSettings.lineNumbers}
                            onValueChange={value => {
                                if (LINE_NUMBER_OPTIONS.includes(value as typeof LINE_NUMBER_OPTIONS[number])) {
                                    void updateEditor({
                                        lineNumbers: value as typeof LINE_NUMBER_OPTIONS[number],
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/30">
                                {LINE_NUMBER_OPTIONS.map(option => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsField>

                    <SettingsField label={t('settings.editor.option.cursorBlinking')}>
                        <Select
                            value={editorSettings.cursorBlinking}
                            onValueChange={value => {
                                if (CURSOR_BLINK_OPTIONS.includes(value as typeof CURSOR_BLINK_OPTIONS[number])) {
                                    void updateEditor({
                                        cursorBlinking: value as typeof CURSOR_BLINK_OPTIONS[number],
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
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
                            onValueChange={value => {
                                if (RENDER_WHITESPACE_OPTIONS.includes(value as typeof RENDER_WHITESPACE_OPTIONS[number])) {
                                    void updateEditor({
                                        renderWhitespace:
                                            value as typeof RENDER_WHITESPACE_OPTIONS[number],
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
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

                    <SettingsField label={t('settings.editor.option.cursorSmoothCaretAnimation')}>
                        <Select
                            value={editorSettings.cursorSmoothCaretAnimation}
                            onValueChange={value => {
                                if (CARET_ANIMATION_OPTIONS.includes(value as typeof CARET_ANIMATION_OPTIONS[number])) {
                                    void updateEditor({
                                        cursorSmoothCaretAnimation:
                                            value as typeof CARET_ANIMATION_OPTIONS[number],
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/30">
                                {CARET_ANIMATION_OPTIONS.map(option => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsField>

                    <SettingsField label={t('settings.editor.option.wordBasedSuggestions')}>
                        <Select
                            value={editorSettings.wordBasedSuggestions}
                            onValueChange={value => {
                                if (WORD_BASED_SUGGESTION_OPTIONS.includes(value as typeof WORD_BASED_SUGGESTION_OPTIONS[number])) {
                                    void updateEditor({
                                        wordBasedSuggestions:
                                            value as typeof WORD_BASED_SUGGESTION_OPTIONS[number],
                                    });
                                }
                            }}
                        >
                            <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/30">
                                {WORD_BASED_SUGGESTION_OPTIONS.map(option => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsField>
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('settings.editor.layoutTitle')}
                description={t('settings.editor.layoutDescription')}
                icon={LayoutPanelLeft}
            >
                <div className="grid gap-3 md:grid-cols-2">
                    <MonacoToggleRow
                        label={t('settings.editor.option.minimap')}
                        checked={editorSettings.minimap}
                        onCheckedChange={checked => {
                            void updateEditor({ minimap: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.minimapRenderCharacters')}
                        checked={editorSettings.minimapRenderCharacters}
                        onCheckedChange={checked => {
                            void updateEditor({ minimapRenderCharacters: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.folding')}
                        checked={editorSettings.folding}
                        onCheckedChange={checked => {
                            void updateEditor({ folding: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.lineNumbers')}
                        checked={editorSettings.lineNumbers !== 'off'}
                        onCheckedChange={checked => {
                            void updateEditor({ lineNumbers: checked ? 'on' : 'off' });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.stickyScroll')}
                        checked={editorSettings.stickyScroll}
                        onCheckedChange={checked => {
                            void updateEditor({ stickyScroll: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.guidesIndentation')}
                        checked={editorSettings.guidesIndentation}
                        onCheckedChange={checked => {
                            void updateEditor({ guidesIndentation: checked });
                        }}
                    />
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('settings.editor.behaviorTitle')}
                description={t('settings.editor.behaviorDescription')}
                icon={MousePointer2}
            >
                <div className="grid gap-3 md:grid-cols-2">
                    <MonacoToggleRow
                        label={t('settings.editor.option.fontLigatures')}
                        checked={editorSettings.fontLigatures}
                        onCheckedChange={checked => {
                            void updateEditor({ fontLigatures: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.smoothScrolling')}
                        checked={editorSettings.smoothScrolling}
                        onCheckedChange={checked => {
                            void updateEditor({ smoothScrolling: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.formatOnPaste')}
                        checked={editorSettings.formatOnPaste}
                        onCheckedChange={checked => {
                            void updateEditor({ formatOnPaste: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.formatOnType')}
                        checked={editorSettings.formatOnType}
                        onCheckedChange={checked => {
                            void updateEditor({ formatOnType: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.codeLens')}
                        checked={editorSettings.codeLens}
                        onCheckedChange={checked => {
                            void updateEditor({ codeLens: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.inlayHints')}
                        checked={editorSettings.inlayHints}
                        onCheckedChange={checked => {
                            void updateEditor({ inlayHints: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.bracketPairColorization')}
                        checked={editorSettings.bracketPairColorization}
                        onCheckedChange={checked => {
                            void updateEditor({ bracketPairColorization: checked });
                        }}
                    />
                    <MonacoToggleRow
                        label={t('settings.editor.option.mouseWheelZoom')}
                        checked={editorSettings.mouseWheelZoom}
                        onCheckedChange={checked => {
                            void updateEditor({ mouseWheelZoom: checked });
                        }}
                    />
                </div>
            </SettingsPanel>

            <SettingsPanel
                title={t('settings.editor.additionalOptionsTitle')}
                description={t('settings.editor.additionalOptionsDescription')}
                icon={Type}
            >
                <SettingsField label={t('settings.editor.option.additionalOptions')}>
                    <Textarea
                        key={editorSettings.additionalOptions}
                        defaultValue={editorSettings.additionalOptions}
                        onBlur={event => {
                            void updateEditor({
                                additionalOptions: parseAdditionalOptions(event.target.value),
                            });
                        }}
                        rows={12}
                        spellCheck={false}
                        className="min-h-[240px] resize-y rounded-2xl border border-border/20 bg-background px-4 py-3 font-mono text-xs leading-6"
                        placeholder={t('settings.editor.additionalOptionsPlaceholder')}
                    />
                </SettingsField>
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/20 bg-background/60 px-4 py-4">
                        <div className="typo-body font-medium text-foreground">{t('settings.editor.option.fontSize')}</div>
                        <div className="mt-2 text-xs text-muted-foreground">{editorSettings.fontSize}</div>
                    </div>
                    <div className="rounded-2xl border border-border/20 bg-background/60 px-4 py-4">
                        <div className="typo-body font-medium text-foreground">{t('settings.editor.option.wordWrap')}</div>
                        <div className="mt-2 text-xs text-muted-foreground">{editorSettings.wordWrap}</div>
                    </div>
                    <div className="rounded-2xl border border-border/20 bg-background/60 px-4 py-4">
                        <div className="typo-body font-medium text-foreground">{t('settings.editor.option.cursorBlinking')}</div>
                        <div className="mt-2 text-xs text-muted-foreground">{editorSettings.cursorBlinking}</div>
                    </div>
                </div>
            </SettingsPanel>
        </div>
    );
};
