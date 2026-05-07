import { IconBolt, IconDatabase, IconEyeOff, IconFileSearch, IconInfoCircle } from '@tabler/icons-react';
import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Workspace } from '@/types';

import { SettingsSectionProps } from './types';

export const GeneralSection: React.FC<SettingsSectionProps> = ({
    formData,
    setFormData,
    t,
}) => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Basic Information */}
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/5 text-primary border border-primary/10">
                    <IconInfoCircle className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground ">
                        {t('frontend.workspaces.basicInfo')}
                    </h2>
                    <p className="text-sm text-muted-foreground/60">
                        {t('frontend.workspaces.basicInfoDesc')}
                    </p>
                </div>
            </div>

            <div className="space-y-6 pl-11">
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground/50 uppercase ">
                        {t('frontend.workspaces.workspaceTitle')}
                    </Label>
                    <Input
                        type="text"
                        value={formData.title}
                        className="bg-muted/5 border-border/10 focus:border-primary/20 transition-all"
                        placeholder={t('frontend.workspaces.namePlaceholder')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, title: e.target.value }))
                        }
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground/50 uppercase ">
                        {t('frontend.workspaces.description')}
                    </Label>
                    <Textarea
                        value={formData.description}
                        className="min-h-24 bg-muted/5 border-border/10 focus:border-primary/20 transition-all resize-none"
                        placeholder={t('frontend.workspaces.descPlaceholder')}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setFormData(prev => ({ ...prev, description: e.target.value }))
                        }
                        rows={3}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground/50 uppercase ">
                        {t('frontend.workspaces.status')}
                    </Label>
                    <Select
                        value={formData.status}
                        onValueChange={(val: string) =>
                            setFormData(prev => ({ ...prev, status: val as Workspace['status'] }))
                        }
                    >
                        <SelectTrigger className="bg-muted/5 border-border/10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">{t('frontend.workspaces.statusActive')}</SelectItem>
                            <SelectItem value="archived">{t('frontend.workspaces.statusArchived')}</SelectItem>
                            <SelectItem value="draft">{t('frontend.workspaces.statusDraft')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>

        <div className="h-px bg-border/5 ml-11" />

        {/* Indexing Engine */}
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/5 text-primary border border-primary/10">
                    <IconDatabase className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground ">
                        {t('frontend.workspaces.advancedEngine')}
                    </h2>
                    <p className="text-sm text-muted-foreground/60">
                        {t('frontend.workspaces.advancedEngineDesc')}
                    </p>
                </div>
            </div>

            <div className="space-y-8 pl-11">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/5 bg-muted/5 group hover:bg-muted/10 transition-all">
                    <div className="space-y-0.5">
                        <Label className="text-sm font-medium text-foreground">
                            {t('frontend.workspaces.semanticIndexing')}
                        </Label>
                        <p className="text-sm text-muted-foreground/60">
                            {t('frontend.workspaces.semanticIndexingDesc')}
                        </p>
                    </div>
                    <Switch
                        checked={formData.indexingEnabled}
                        onCheckedChange={checked =>
                            setFormData(prev => ({ ...prev, indexingEnabled: checked }))
                        }
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground/50 uppercase ">
                            {t('frontend.workspaces.maxFileSize')} (bytes)
                        </Label>
                        <Input
                            type="number"
                            value={formData.indexingMaxFileSize}
                            className="bg-muted/5 border-border/10 font-mono"
                            onChange={e =>
                                setFormData(prev => ({ ...prev, indexingMaxFileSize: parseInt(e.target.value) || 0 }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground/50 uppercase ">
                            {t('frontend.workspaces.maxConcurrency')}
                        </Label>
                        <Input
                            type="number"
                            min={1}
                            max={16}
                            value={formData.indexingMaxConcurrency}
                            className="bg-muted/5 border-border/10 font-mono"
                            onChange={e =>
                                setFormData(prev => ({ ...prev, indexingMaxConcurrency: parseInt(e.target.value) || 4 }))
                            }
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground/50 uppercase  flex items-center gap-2">
                        <IconEyeOff className="w-3.5 h-3.5" />
                        {t('frontend.workspaces.exclusionPatterns')}
                    </Label>
                    <Textarea
                        placeholder={t('frontend.workspaces.exclusionPatternsPlaceholder')}
                        value={formData.indexingExclude}
                        className="min-h-20 bg-muted/5 border-border/10 font-mono text-sm resize-none"
                        onChange={e =>
                            setFormData(prev => ({ ...prev, indexingExclude: e.target.value }))
                        }
                    />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/5 bg-muted/5 group hover:bg-muted/10 transition-all">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <IconFileSearch className="w-3.5 h-3.5 text-primary/60" />
                                <Label className="text-sm font-medium text-foreground">
                                    {t('frontend.workspaces.fileWatcher')}
                                </Label>
                            </div>
                            <p className="text-sm text-muted-foreground/60">{t('frontend.workspaces.fileWatcherDesc')}</p>
                        </div>
                        <Switch
                            checked={formData.fileWatchEnabled}
                            onCheckedChange={checked =>
                                setFormData(prev => ({ ...prev, fileWatchEnabled: checked }))
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/5 bg-muted/5 group hover:bg-muted/10 transition-all">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <IconBolt className="w-3.5 h-3.5 text-warning/60" />
                                <Label className="text-sm font-medium text-foreground">
                                    {t('frontend.workspaces.autoSaveLabel')}
                                </Label>
                            </div>
                            <p className="text-sm text-muted-foreground/60">{t('frontend.workspaces.autoSaveDesc')}</p>
                        </div>
                        <Switch
                            checked={formData.autoSave}
                            onCheckedChange={checked =>
                                setFormData(prev => ({ ...prev, autoSave: checked }))
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

