import { CheckedState } from '@radix-ui/react-checkbox';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Play } from 'lucide-react';
import React from 'react';

import { SettingsSectionProps } from './types';

export const DevServerSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{t('workspaces.devServer')}</h3>
            <p className="text-sm text-muted-foreground">{t('workspaces.devServerDesc')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                    {t('workspaces.startCommand')}
                </Label>
                <div className="relative">
                    <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                        type="text"
                        value={formData.devCommand}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({ ...prev, devCommand: e.target.value }))
                        }
                        className="pl-9 font-mono"
                        placeholder={t('placeholder.devCommand')}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                        {t('workspaces.port')}
                    </Label>
                    <Input
                        type="number"
                        value={formData.devPort}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData(prev => ({
                                ...prev,
                                devPort: parseInt(e.target.value, 10) || 3000,
                            }))
                        }
                        className="font-mono"
                        placeholder={t('placeholder.portNumber')}
                    />
                </div>
                <div className="space-y-2 flex items-center pt-8">
                    <Label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                            checked={formData.devAutoStart}
                            onCheckedChange={(checked: CheckedState) =>
                                setFormData(prev => ({ ...prev, devAutoStart: checked === true }))
                            }
                        />
                        <span className="text-sm text-foreground">{t('workspaces.autoStart')}</span>
                    </Label>
                </div>
            </div>
        </div>
    </div>
);


