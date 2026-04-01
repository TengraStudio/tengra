import React from 'react';

import { SettingsSectionProps } from './types';

const inputClassName =
    'w-full rounded-lg border border-border/50 bg-muted/20 px-4 py-2 text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50';

const panelClassName = 'space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4';

export const EditorSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="mb-1 text-lg font-semibold text-foreground">{t('workspace.editor')}</h3>
            <p className="text-sm text-muted-foreground">{t('editor.suggestions.description')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('terminal.fontSize')}</label>
                <input
                    type="number"
                    min={10}
                    max={32}
                    value={formData.editorFontSize}
                    onChange={event => {
                        const nextValue = Number.parseInt(event.target.value, 10);
                        setFormData(prev => ({
                            ...prev,
                            editorFontSize: Number.isNaN(nextValue) ? prev.editorFontSize : nextValue,
                        }));
                    }}
                    className={inputClassName}
                />
            </div>

            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('terminal.lineHeight')}</label>
                <input
                    type="number"
                    min={1}
                    max={3}
                    step={0.1}
                    value={formData.editorLineHeight}
                    onChange={event => {
                        const nextValue = Number.parseFloat(event.target.value);
                        setFormData(prev => ({
                            ...prev,
                            editorLineHeight: Number.isNaN(nextValue) ? prev.editorLineHeight : nextValue,
                        }));
                    }}
                    className={inputClassName}
                />
            </div>

            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('editor.suggestions.title')}</label>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('workspaces.indexing')}</span>
                    <input
                        type="checkbox"
                        checked={formData.editorInlayHints}
                        onChange={event =>
                            setFormData(prev => ({ ...prev, editorInlayHints: event.target.checked }))
                        }
                        className="h-5 w-5 rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                    />
                </div>
            </div>

            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('terminal.fontLigatures')}</label>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('common.preview')}</span>
                    <input
                        type="checkbox"
                        checked={formData.editorFontLigatures}
                        onChange={event =>
                            setFormData(prev => ({ ...prev, editorFontLigatures: event.target.checked }))
                        }
                        className="h-5 w-5 rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                    />
                </div>
            </div>

            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('terminal.cursorBlink')}</label>
                <select
                    value={formData.editorCursorBlinking}
                    onChange={event =>
                        setFormData(prev => ({
                            ...prev,
                            editorCursorBlinking:
                                event.target.value as NonNullable<typeof prev.editorCursorBlinking>,
                        }))
                    }
                    className={`${inputClassName} font-sans`}
                >
                    <option value="blink">blink</option>
                    <option value="smooth">smooth</option>
                    <option value="phase">phase</option>
                    <option value="expand">expand</option>
                    <option value="solid">solid</option>
                </select>
            </div>

            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('terminal.cursorStyle')}</label>
                <select
                    value={formData.editorLineNumbers}
                    onChange={event =>
                        setFormData(prev => ({
                            ...prev,
                            editorLineNumbers:
                                event.target.value as NonNullable<typeof prev.editorLineNumbers>,
                        }))
                    }
                    className={`${inputClassName} font-sans`}
                >
                    <option value="on">on</option>
                    <option value="off">off</option>
                    <option value="relative">relative</option>
                    <option value="interval">interval</option>
                </select>
            </div>

            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('common.layout')}</label>
                <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">minimap</span>
                        <input
                            type="checkbox"
                            checked={formData.editorMinimap}
                            onChange={event =>
                                setFormData(prev => ({ ...prev, editorMinimap: event.target.checked }))
                            }
                            className="h-5 w-5 rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">folding</span>
                        <input
                            type="checkbox"
                            checked={formData.editorFolding}
                            onChange={event =>
                                setFormData(prev => ({ ...prev, editorFolding: event.target.checked }))
                            }
                            className="h-5 w-5 rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">codeLens</span>
                        <input
                            type="checkbox"
                            checked={formData.editorCodeLens}
                            onChange={event =>
                                setFormData(prev => ({ ...prev, editorCodeLens: event.target.checked }))
                            }
                            className="h-5 w-5 rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                        />
                    </div>
                </div>
            </div>

            <div className={panelClassName}>
                <label className="text-sm font-medium text-muted-foreground">{t('common.edit')}</label>
                <div className="grid gap-3">
                    <input
                        type="number"
                        min={1}
                        max={8}
                        value={formData.editorTabSize}
                        onChange={event => {
                            const nextValue = Number.parseInt(event.target.value, 10);
                            setFormData(prev => ({
                                ...prev,
                                editorTabSize: Number.isNaN(nextValue) ? prev.editorTabSize : nextValue,
                            }));
                        }}
                        className={inputClassName}
                    />
                    <select
                        value={formData.editorWordWrap}
                        onChange={event =>
                            setFormData(prev => ({
                                ...prev,
                                editorWordWrap:
                                    event.target.value as NonNullable<typeof prev.editorWordWrap>,
                            }))
                        }
                        className={`${inputClassName} font-sans`}
                    >
                        <option value="off">off</option>
                        <option value="on">on</option>
                        <option value="wordWrapColumn">wordWrapColumn</option>
                        <option value="bounded">bounded</option>
                    </select>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">formatOnPaste</span>
                        <input
                            type="checkbox"
                            checked={formData.editorFormatOnPaste}
                            onChange={event =>
                                setFormData(prev => ({
                                    ...prev,
                                    editorFormatOnPaste: event.target.checked,
                                }))
                            }
                            className="h-5 w-5 rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">smoothScrolling</span>
                        <input
                            type="checkbox"
                            checked={formData.editorSmoothScrolling}
                            onChange={event =>
                                setFormData(prev => ({
                                    ...prev,
                                    editorSmoothScrolling: event.target.checked,
                                }))
                            }
                            className="h-5 w-5 rounded border-border/50 bg-muted/20 text-primary focus:ring-primary"
                        />
                    </div>
                </div>
            </div>
        </div>

        <div className={panelClassName}>
            <label className="text-sm font-medium text-muted-foreground">{t('common.edit')}</label>
            <textarea
                value={formData.editorAdditionalOptions}
                onChange={event =>
                    setFormData(prev => ({ ...prev, editorAdditionalOptions: event.target.value }))
                }
                rows={12}
                spellCheck={false}
                className={`${inputClassName} min-tw-h-240 resize-y font-mono text-sm`}
                placeholder="{}"
            />
        </div>
    </section>
);
