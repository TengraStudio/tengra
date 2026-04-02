import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Code, Search, Shield } from 'lucide-react';
import React from 'react';

import { SettingsSectionProps } from './types';

export const BuildSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('workspaces.build')}</h3>
            <p className="text-sm text-muted-foreground">{t('workspaces.buildDesc')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                    {t('workspaces.buildCommand')}
                </Label>
                <div className="relative">
                    <Code className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                        type="text"
                        value={formData.buildCommand}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, buildCommand: e.target.value }))
                        }
                        className="pl-9 font-mono"
                        placeholder={t('placeholder.buildCommand')}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                    {t('workspaces.testCommand')}
                </Label>
                <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                        type="text"
                        value={formData.testCommand}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, testCommand: e.target.value }))
                        }
                        className="pl-9 font-mono"
                        placeholder={t('placeholder.testCommand')}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                    {t('workspaces.lintCommand')}
                </Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                        type="text"
                        value={formData.lintCommand}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, lintCommand: e.target.value }))
                        }
                        className="pl-9 font-mono"
                        placeholder={t('placeholder.lintCommand')}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                        {t('workspaces.outputDir')}
                    </Label>
                    <Input
                        type="text"
                        value={formData.outputDir}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, outputDir: e.target.value }))
                        }
                        className="font-mono"
                        placeholder={t('placeholder.outputDir')}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                        {t('workspaces.envFile')}
                    </Label>
                    <Input
                        type="text"
                        value={formData.envFile}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, envFile: e.target.value }))
                        }
                        className="font-mono"
                        placeholder={t('placeholder.envFile')}
                    />
                </div>
            </div>
        </div>
    </div>
);

