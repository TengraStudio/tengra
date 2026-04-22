/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { Textarea } from '@renderer/components/ui/textarea';
import { Braces, FileCode2, Layout, MousePointer2, Settings2,Type } from 'lucide-react';
import React from 'react';

import { WorkspaceSettingsFormData, SettingsSectionProps } from './types';

export const EditorSection: React.FC<SettingsSectionProps> = (props) => {
    const { formData, setFormData, t } = props;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FileCode2 className="w-6 h-6 text-primary" />
                    {t('workspace.editorTitle')}
                </h2>
                <p className="text-muted-foreground">
                    {t('workspace.editorDescription')}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                    <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                        <div className="flex items-center gap-2">
                            <Type className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base font-semibold">{t('workspace.editorTypography')}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">{t('appearance.fontSize')}</Label>
                            <Input
                                type="number"
                                min={10}
                                max={32}
                                className="bg-background/50"
                                value={formData.editorFontSize}
                                onChange={(e) => setFormData(prev => ({ ...prev, editorFontSize: parseInt(e.target.value) || 14 }))}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                    <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                        <div className="flex items-center gap-2">
                            <MousePointer2 className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base font-semibold">{t('workspace.editorInteraction')}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">{t('workspace.editor.lineNumbers')}</Label>
                            <Select 
                                value={formData.editorLineNumbers} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, editorLineNumbers: val as WorkspaceSettingsFormData['editorLineNumbers'] }))}
                            >
                                <SelectTrigger className="bg-background/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="on">{t('settings.editor.lineNumbers.on')}</SelectItem>
                                    <SelectItem value="off">{t('settings.editor.lineNumbers.off')}</SelectItem>
                                    <SelectItem value="relative">{t('settings.editor.lineNumbers.relative')}</SelectItem>
                                    <SelectItem value="interval">{t('settings.editor.lineNumbers.interval')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-border/20">
                            <Label className="text-sm font-medium">{t('workspace.editor.smoothScrolling')}</Label>
                            <Switch
                                checked={formData.editorSmoothScrolling}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, editorSmoothScrolling: checked }))}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                    <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                        <div className="flex items-center gap-2">
                            <Layout className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base font-semibold">{t('common.layout')}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-border/20">
                            <Label className="text-sm font-medium">{t('workspace.editor.minimap')}</Label>
                            <Switch
                                checked={formData.editorMinimap}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, editorMinimap: checked }))}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-border/20">
                            <Label className="text-sm font-medium">{t('workspace.editor.folding')}</Label>
                            <Switch
                                checked={formData.editorFolding}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, editorFolding: checked }))}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-border/20">
                            <Label className="text-sm font-medium">{t('workspace.editor.inlayHints')}</Label>
                            <Switch
                                checked={formData.editorInlayHints}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, editorInlayHints: checked }))}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                    <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                        <div className="flex items-center gap-2">
                            <Braces className="w-4 h-4 text-primary" />
                            <CardTitle className="text-base font-semibold">{t('workspace.editor.editingAndTabs')}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">{t('workspace.editor.tabSize')}</Label>
                            <Input
                                type="number"
                                min={1}
                                max={8}
                                className="bg-background/50"
                                value={formData.editorTabSize}
                                onChange={(e) => setFormData(prev => ({ ...prev, editorTabSize: parseInt(e.target.value) || 4 }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">{t('workspace.editor.wordWrap')}</Label>
                            <Select 
                                value={formData.editorWordWrap} 
                                onValueChange={(val) => setFormData(prev => ({ ...prev, editorWordWrap: val as WorkspaceSettingsFormData['editorWordWrap'] }))}
                            >
                                <SelectTrigger className="bg-background/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="off">{t('settings.editor.wordWrap.off')}</SelectItem>
                                    <SelectItem value="on">{t('settings.editor.wordWrap.on')}</SelectItem>
                                    <SelectItem value="wordWrapColumn">{t('settings.editor.wordWrap.wordWrapColumn')}</SelectItem>
                                    <SelectItem value="bounded">{t('settings.editor.wordWrap.bounded')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-background/40 rounded-xl border border-border/20">
                            <Label className="text-sm font-medium">{t('workspace.editor.formatOnPaste')}</Label>
                            <Switch
                                checked={formData.editorFormatOnPaste}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, editorFormatOnPaste: checked }))}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden border-2 shadow-xl shadow-primary/5">
                <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-primary" />
                        <CardTitle className="text-base font-semibold">{t('workspace.editor.additionalOptions')}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <Textarea
                        value={formData.editorAdditionalOptions}
                        onChange={(e) => setFormData(prev => ({ ...prev, editorAdditionalOptions: e.target.value }))}
                        className="min-h-48 font-mono text-xs bg-background/50"
                        placeholder="{}"
                    />
                </CardContent>
            </Card>
        </div>
    );
};
