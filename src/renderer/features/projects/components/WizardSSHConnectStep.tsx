import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface SshFormData {
    host: string;
    port: string;
    username: string;
    authType: 'password' | 'key';
    password?: string;
    privateKey?: string;
    passphrase?: string;
}

interface WizardSSHConnectStepProps {
    sshForm: SshFormData;
    setSshForm: React.Dispatch<React.SetStateAction<SshFormData>>;
}

export const WizardSSHConnectStep: React.FC<WizardSSHConnectStepProps> = ({
    sshForm,
    setSshForm
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-6 flex-1 pt-4">
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.host')}</label>
                        <input
                            autoFocus
                            value={sshForm.host}
                            onChange={e => setSshForm(p => ({ ...p, host: e.target.value }))}
                            className="w-full bg-muted/10 border border-border/50 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-foreground"
                            placeholder={t('projectWizard.placeholder.example')}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.port')}</label>
                        <input
                            value={sshForm.port}
                            onChange={e => setSshForm(p => ({ ...p, port: e.target.value }))}
                            className="w-full bg-muted/10 border border-border/50 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-foreground"
                            placeholder={t('ssh.placeholders.port')}
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.username')}</label>
                    <input
                        value={sshForm.username}
                        onChange={e => setSshForm(p => ({ ...p, username: e.target.value }))}
                        className="w-full bg-muted/10 border border-border/50 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-foreground"
                        placeholder={t('ssh.placeholders.username')}
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.authType')}</label>
                    <div className="flex bg-muted/10 rounded-lg p-1 border border-border/50">
                        <button
                            onClick={() => setSshForm(p => ({ ...p, authType: 'password' }))}
                            className={cn(
                                "flex-1 py-2 rounded-md text-xs font-medium transition-all",
                                sshForm.authType === 'password' ? "bg-muted/40 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Password
                        </button>
                        <button
                            onClick={() => setSshForm(p => ({ ...p, authType: 'key' }))}
                            className={cn(
                                "flex-1 py-2 rounded-md text-xs font-medium transition-all",
                                sshForm.authType === 'key' ? "bg-muted/40 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Private Key
                        </button>
                    </div>
                </div>

                {sshForm.authType === 'password' ? (
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.password')}</label>
                        <input
                            type="password"
                            value={sshForm.password}
                            onChange={e => setSshForm(p => ({ ...p, password: e.target.value }))}
                            className="w-full bg-muted/10 border border-border/50 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-foreground"
                            placeholder="••••••••"
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.privateKey')}</label>
                            <textarea
                                value={sshForm.privateKey}
                                onChange={e => setSshForm(p => ({ ...p, privateKey: e.target.value }))}
                                className="w-full h-24 bg-muted/10 border border-border/50 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-foreground font-mono text-xs resize-none"
                                placeholder={t('ssh.placeholders.privateKey')}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">{t('common.passphrase')} (Optional)</label>
                            <input
                                type="password"
                                value={sshForm.passphrase}
                                onChange={e => setSshForm(p => ({ ...p, passphrase: e.target.value }))}
                                className="w-full bg-muted/10 border border-border/50 rounded-lg px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors text-foreground"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
