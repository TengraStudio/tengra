/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


/** SSH connection form data shape */
export interface SSHFormData {
    host: string;
    port: string;
    username: string;
    authType: 'password' | 'key';
    password: string;
    privateKey: string;
    passphrase: string;
}

interface SSHConnectionFormProps {
    sshForm: SSHFormData;
    setSshForm: React.Dispatch<React.SetStateAction<SSHFormData>>;
    /** Additional CSS class for the root container */
    className?: string;
}

/** Reusable SSH connection form with host, port, username, and auth fields */
export const SSHConnectionForm: React.FC<SSHConnectionFormProps> = ({
    sshForm,
    setSshForm,
    className,
}) => {
    const { t } = useTranslation();

    return (
        <div className={cn('flex flex-col gap-4 font-sans', className)}>
            <div className="grid grid-cols-2fr-1fr gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-foreground/80 uppercase ">
                        {t('common.host')}
                    </label>
                    <input
                        autoFocus
                        value={sshForm.host}
                        onChange={e => setSshForm(p => ({ ...p, host: e.target.value }))}
                        className="w-full h-9 px-3 text-sm bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                        placeholder={t('workspaceWizard.placeholder.example')}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-foreground/80 uppercase ">
                        {t('common.port')}
                    </label>
                    <input
                        value={sshForm.port}
                        onChange={e => setSshForm(p => ({ ...p, port: e.target.value }))}
                        className="w-full h-9 px-3 text-sm bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                        placeholder={t('ssh.placeholders.port')}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground/80 uppercase ">
                    {t('common.username')}
                </label>
                <input
                    value={sshForm.username}
                    onChange={e => setSshForm(p => ({ ...p, username: e.target.value }))}
                    className="w-full h-9 px-3 text-sm bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                    placeholder={t('ssh.placeholders.username')}
                />
            </div>

            <div className="flex flex-col gap-1.5 mb-2">
                <label className="text-sm font-semibold text-foreground/80 uppercase ">
                    {t('common.authType')}
                </label>
                <div className="flex p-1 bg-muted/30 rounded-lg border border-border/40 w-fit">
                    <button
                        onClick={() => setSshForm(p => ({ ...p, authType: 'password' }))}
                        className={cn(
                            'px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer',
                            sshForm.authType === 'password'
                                ? 'bg-background text-foreground shadow-sm border border-border/50 translate-y-0'
                                : 'bg-transparent text-muted-foreground hover:text-foreground border-transparent'
                        )}
                    >
                        {t('common.password')}
                    </button>
                    <button
                        onClick={() => setSshForm(p => ({ ...p, authType: 'key' }))}
                        className={cn(
                            'px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer',
                            sshForm.authType === 'key'
                                ? 'bg-background text-foreground shadow-sm border border-border/50 translate-y-0'
                                : 'bg-transparent text-muted-foreground hover:text-foreground border-transparent'
                        )}
                    >
                        {t('common.privateKey')}
                    </button>
                </div>
            </div>

            {sshForm.authType === 'password' ? (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-sm font-semibold text-foreground/80 uppercase ">
                        {t('common.password')}
                    </label>
                    <input
                        type="password"
                        value={sshForm.password}
                        onChange={e => setSshForm(p => ({ ...p, password: e.target.value }))}
                        className="w-full h-9 px-3 text-sm bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                        placeholder={t('common.password')}
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-muted/10 p-4 rounded-xl border border-border/30">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-foreground/80 uppercase ">
                            {t('common.privateKey')}
                        </label>
                        <textarea
                            value={sshForm.privateKey}
                            onChange={e => setSshForm(p => ({ ...p, privateKey: e.target.value }))}
                            className="w-full min-h-120 p-3 text-sm font-mono bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-y custom-scrollbar"
                            placeholder={t('ssh.placeholders.privateKey')}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-sm font-semibold text-foreground/80 uppercase ">
                            {t('common.passphrase')} ({t('common.optional')})
                        </label>
                        <input
                            type="password"
                            value={sshForm.passphrase}
                            onChange={e => setSshForm(p => ({ ...p, passphrase: e.target.value }))}
                            className="w-full h-9 px-3 text-sm bg-muted/20 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
                            placeholder={t('common.passphrase')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
