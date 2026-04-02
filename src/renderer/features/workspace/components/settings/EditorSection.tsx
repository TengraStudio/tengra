import { CheckedState } from '@radix-ui/react-checkbox';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Textarea } from '@renderer/components/ui/textarea';
import React from 'react';

import { SettingsSectionProps } from './types';

const panelClassName =
    'space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4';

const EditorAppearanceFields: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <>
        <div className={panelClassName}>
            <Label className="mb-2 block text-muted-foreground">{t('terminal.fontSize')}</Label>
            <Input
                type="number"
                min={10}
                max={32}
                value={formData.editorFontSize}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = Number.parseInt(event.target.value, 10);
                    setFormData(prev => ({
                        ...prev,
                        editorFontSize: Number.isNaN(nextValue) ? prev.editorFontSize : nextValue,
                    }));
                }}
            />
        </div>

        <div className={panelClassName}>
            <Label className="mb-2 block text-muted-foreground">{t('terminal.lineHeight')}</Label>
            <Input
                type="number"
                min={1}
                max={3}
                step={0.1}
                value={formData.editorLineHeight}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = Number.parseFloat(event.target.value);
                    setFormData(prev => ({
                        ...prev,
                        editorLineHeight: Number.isNaN(nextValue) ? prev.editorLineHeight : nextValue,
                    }));
                }}
            />
        </div>
    </>
);

const EditorBehaviorFields: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <>
        <div className={panelClassName}>
            <Label className="mb-2 block text-muted-foreground">
                {t('editor.suggestions.title')}
            </Label>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('workspaces.indexing')}</span>
                <Checkbox
                    checked={formData.editorInlayHints}
                    onCheckedChange={(checked: CheckedState) =>
                        setFormData(prev => ({ ...prev, editorInlayHints: checked === true }))
                    }
                />
            </div>
        </div>

        <div className={panelClassName}>
            <Label className="mb-2 block text-muted-foreground">{t('terminal.fontLigatures')}</Label>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('common.preview')}</span>
                <Checkbox
                    checked={formData.editorFontLigatures}
                    onCheckedChange={(checked: CheckedState) =>
                        setFormData(prev => ({ ...prev, editorFontLigatures: checked === true }))
                    }
                />
            </div>
        </div>

        <div className={panelClassName}>
            <Label className="mb-2 block text-muted-foreground">{t('terminal.cursorBlink')}</Label>
            <Select
                value={formData.editorCursorBlinking}
                onValueChange={(val: string) =>
                    setFormData(prev => ({
                        ...prev,
                        editorCursorBlinking: val as NonNullable<typeof prev.editorCursorBlinking>,
                    }))
                }
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="blink">blink</SelectItem>
                    <SelectItem value="smooth">smooth</SelectItem>
                    <SelectItem value="phase">phase</SelectItem>
                    <SelectItem value="expand">expand</SelectItem>
                    <SelectItem value="solid">solid</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div className={panelClassName}>
            <Label className="mb-2 block text-muted-foreground">{t('terminal.cursorStyle')}</Label>
            <Select
                value={formData.editorLineNumbers}
                onValueChange={(val: string) =>
                    setFormData(prev => ({
                        ...prev,
                        editorLineNumbers: val as NonNullable<typeof prev.editorLineNumbers>,
                    }))
                }
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="on">on</SelectItem>
                    <SelectItem value="off">off</SelectItem>
                    <SelectItem value="relative">relative</SelectItem>
                    <SelectItem value="interval">interval</SelectItem>
                </SelectContent>
            </Select>
        </div>
    </>
);

const EditorLayoutFields: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <div className={panelClassName}>
        <Label className="mb-2 block text-muted-foreground">{t('common.layout')}</Label>
        <div className="grid gap-3">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">minimap</span>
                <Checkbox
                    checked={formData.editorMinimap}
                    onCheckedChange={(checked: CheckedState) =>
                        setFormData(prev => ({ ...prev, editorMinimap: checked === true }))
                    }
                />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">folding</span>
                <Checkbox
                    checked={formData.editorFolding}
                    onCheckedChange={(checked: CheckedState) =>
                        setFormData(prev => ({ ...prev, editorFolding: checked === true }))
                    }
                />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">codeLens</span>
                <Checkbox
                    checked={formData.editorCodeLens}
                    onCheckedChange={(checked: CheckedState) =>
                        setFormData(prev => ({ ...prev, editorCodeLens: checked === true }))
                    }
                />
            </div>
        </div>
    </div>
);

const EditorFormattingFields: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <div className={panelClassName}>
        <Label className="mb-2 block text-muted-foreground">{t('common.edit')}</Label>
        <div className="grid gap-3">
            <Input
                type="number"
                min={1}
                max={8}
                value={formData.editorTabSize}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    const nextValue = Number.parseInt(event.target.value, 10);
                    setFormData(prev => ({
                        ...prev,
                        editorTabSize: Number.isNaN(nextValue) ? prev.editorTabSize : nextValue,
                    }));
                }}
            />
            <Select
                value={formData.editorWordWrap}
                onValueChange={(val: string) =>
                    setFormData(prev => ({
                        ...prev,
                        editorWordWrap: val as NonNullable<typeof prev.editorWordWrap>,
                    }))
                }
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="off">off</SelectItem>
                    <SelectItem value="on">on</SelectItem>
                    <SelectItem value="wordWrapColumn">wordWrapColumn</SelectItem>
                    <SelectItem value="bounded">bounded</SelectItem>
                </SelectContent>
            </Select>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">formatOnPaste</span>
                <Checkbox
                    checked={formData.editorFormatOnPaste}
                    onCheckedChange={(checked: CheckedState) =>
                        setFormData(prev => ({ ...prev, editorFormatOnPaste: checked === true }))
                    }
                />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">smoothScrolling</span>
                <Checkbox
                    checked={formData.editorSmoothScrolling}
                    onCheckedChange={(checked: CheckedState) =>
                        setFormData(prev => ({ ...prev, editorSmoothScrolling: checked === true }))
                    }
                />
            </div>
        </div>
    </div>
);

export const EditorSection: React.FC<SettingsSectionProps> = props => {
    const { formData, setFormData, t } = props;

    return (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">
                    {t('workspace.editor')}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t('editor.suggestions.description')}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <EditorAppearanceFields {...props} />
                <EditorBehaviorFields {...props} />
                <EditorLayoutFields {...props} />
                <EditorFormattingFields {...props} />
            </div>

            <div className={panelClassName}>
                <Label className="mb-2 block text-muted-foreground">{t('common.edit')}</Label>
                <Textarea
                    value={formData.editorAdditionalOptions}
                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFormData(prev => ({
                            ...prev,
                            editorAdditionalOptions: event.target.value,
                        }))
                    }
                    rows={12}
                    spellCheck={false}
                    className="min-h-[240px] resize-y font-mono text-sm"
                    placeholder="{}"
                />
            </div>
        </section>
    );
};



