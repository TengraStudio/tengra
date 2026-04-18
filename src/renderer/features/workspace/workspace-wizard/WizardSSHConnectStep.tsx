/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Textarea } from '@renderer/components/ui/textarea';
import { cn } from '@renderer/lib/utils';
import React from 'react';

import { useTranslation } from '@/i18n';

interface SshFormData {
    host: string;
    port: string;
    username: string;
    authType: 'password' | 'key';
    password: string;
    privateKey: string;
    passphrase: string;
}

interface WizardSSHConnectStepProps {
    sshForm: SshFormData;
    setSshForm: React.Dispatch<React.SetStateAction<SshFormData>>;
}

export const WizardSSHConnectStep: React.FC<WizardSSHConnectStepProps> = ({
    sshForm,
    setSshForm,
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-6 flex-1 pt-4">
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                        <Label className="typo-caption font-semibold text-muted-foreground mb-1.5 block">
                            {t('common.host')}
                        </Label>
                        <Input
                            autoFocus
                            value={sshForm.host}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setSshForm(p => ({ ...p, host: e.target.value }))
                            }
                            className="h-12"
                            placeholder={t('workspaceWizard.placeholder.example')}
                        />
                    </div>
                    <div>
                        <Label className="typo-caption font-semibold text-muted-foreground mb-1.5 block">
                            {t('common.port')}
                        </Label>
                        <Input
                            value={sshForm.port}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setSshForm(p => ({ ...p, port: e.target.value }))
                            }
                            className="h-12"
                            placeholder={t('ssh.placeholders.port')}
                        />
                    </div>
                </div>

                <div>
                    <Label className="typo-caption font-semibold text-muted-foreground mb-1.5 block">
                        {t('common.username')}
                    </Label>
                    <Input
                        value={sshForm.username}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSshForm(p => ({ ...p, username: e.target.value }))
                        }
                        className="h-12"
                        placeholder={t('ssh.placeholders.username')}
                    />
                </div>

                <div>
                    <Label className="typo-caption font-semibold text-muted-foreground mb-1.5 block">
                        {t('common.authType')}
                    </Label>
                    <div className="flex bg-muted/10 rounded-lg p-1 border border-border/50">
                        <button
                            onClick={() => setSshForm(p => ({ ...p, authType: 'password' }))}
                            className={cn(
                                'flex-1 py-2 rounded-md typo-caption font-medium transition-all',
                                sshForm.authType === 'password'
                                    ? 'bg-muted/40 text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {t('common.password')}
                        </button>
                        <button
                            onClick={() => setSshForm(p => ({ ...p, authType: 'key' }))}
                            className={cn(
                                'flex-1 py-2 rounded-md typo-caption font-medium transition-all',
                                sshForm.authType === 'key'
                                    ? 'bg-muted/40 text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {t('common.privateKey')}
                        </button>
                    </div>
                </div>

                {sshForm.authType === 'password' ? (
                    <div>
                        <Label className="typo-caption font-semibold text-muted-foreground mb-1.5 block">
                            {t('common.password')}
                        </Label>
                        <Input
                            type="password"
                            value={sshForm.password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setSshForm(p => ({ ...p, password: e.target.value }))
                            }
                            className="h-12"
                            placeholder={t('common.password')}
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <Label className="typo-caption font-semibold text-muted-foreground mb-1.5 block">
                                {t('common.privateKey')}
                            </Label>
                            <Textarea
                                value={sshForm.privateKey}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    setSshForm(p => ({ ...p, privateKey: e.target.value }))
                                }
                                className="h-24 font-mono typo-caption resize-none"
                                placeholder={t('ssh.placeholders.privateKey')}
                            />
                        </div>
                        <div>
                            <Label className="typo-caption font-semibold text-muted-foreground mb-1.5 block">
                                {t('common.passphrase')}{' '}
                                <span className="opacity-60">{t('workspaceWizard.optional')}</span>
                            </Label>
                            <Input
                                type="password"
                                value={sshForm.passphrase}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setSshForm(p => ({ ...p, passphrase: e.target.value }))
                                }
                                className="h-12"
                                placeholder={t('common.passphrase')}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

