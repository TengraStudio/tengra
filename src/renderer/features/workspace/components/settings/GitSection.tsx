import { IconGitBranch, IconRefresh, IconTypography } from '@tabler/icons-react';
import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { SettingsSectionProps } from './types';

export const GitSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Git Workflow */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/5 text-primary border border-primary/10">
                        <IconGitBranch className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground ">
                            {t('frontend.workspaces.gitConfig')}
                        </h2>
                        <p className="text-sm text-muted-foreground/60">
                            {t('frontend.workspaces.gitConfigDesc')}
                        </p>
                    </div>
                </div>

                <div className="space-y-6 pl-11">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground/50 uppercase  flex items-center gap-2">
                                <IconTypography className="w-3.5 h-3.5" />
                                {t('frontend.workspaces.commitPrefix')}
                            </Label>
                            <Input
                                placeholder="e.g. [FEAT]"
                                className="bg-muted/5 border-border/10 font-mono"
                                value={formData.gitCommitPrefix}
                                onChange={(e) => setFormData(prev => ({ ...prev, gitCommitPrefix: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground/50 uppercase ">
                                {t('frontend.workspaces.branchPrefix')}
                            </Label>
                            <Input
                                placeholder="e.g. feature/"
                                className="bg-muted/5 border-border/10 font-mono"
                                value={formData.gitBranchPrefix}
                                onChange={(e) => setFormData(prev => ({ ...prev, gitBranchPrefix: e.target.value }))}
                            />
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground/40 italic">
                        {t('frontend.workspaces.gitHint')}
                    </p>
                </div>
            </div>

            <div className="h-px bg-border/5 ml-11" />

            {/* Automation */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/5 text-success border border-success/10">
                        <IconRefresh className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground ">
                            {t('frontend.workspaces.automation')}
                        </h2>
                        <p className="text-sm text-muted-foreground/60">
                            {t('frontend.workspaces.automationDesc')}
                        </p>
                    </div>
                </div>

                <div className="pl-11">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/5 bg-muted/5 group hover:bg-muted/10 transition-all">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-medium text-foreground">{t('frontend.workspaces.autoFetch')}</Label>
                            <p className="text-sm text-muted-foreground/60">
                                {t('frontend.workspaces.autoFetchDesc')}
                            </p>
                        </div>
                        <Switch
                            checked={formData.gitAutoFetch}
                            onCheckedChange={(val) => setFormData(prev => ({ ...prev, gitAutoFetch: val }))}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
