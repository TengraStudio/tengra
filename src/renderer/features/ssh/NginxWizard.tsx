/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDeviceFloppy, IconGlobe, IconLoader2, IconPlayerPlay, IconServer, IconShieldCheck } from '@tabler/icons-react';
import React, { useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_NGINXWIZARD_1 = "px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50";


interface NginxWizardProps {
    connectionId: string
    language: Language
}

export const NginxWizard: React.FC<NginxWizardProps> = ({ connectionId, language }) => {
    const { t } = useTranslation(language);
    const [domain, setDomain] = useState('');
    const [backendPort, setBackendPort] = useState('3000');
    const [isGenerating, setIsGenerating] = useState(false);
    const [config, setConfig] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    const generateConfig = () => {
        const conf = `server {
    listen 80;
    server_name ${domain !== '' ? domain : 'example.com'};

    location / {
        proxy_pass http://localhost:${backendPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
        setConfig(conf);
    };

    const handleApply = async () => {
        if (!domain) {
            setStatus({ type: 'error', message: t('frontend.ssh.nginx.status.domainRequired') });
            return;
        }

        setIsGenerating(true);
        setStatus({ type: 'info', message: t('frontend.ssh.nginx.status.connecting') });

        try {
            const fileName = domain.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const remotePath = `/etc/nginx/sites-available/${fileName}`;

            // Step 1: Write to temp file first (since /etc/nginx is likely protected)
            const tempPath = `/tmp/Tengra_nginx_${fileName}`;
            await window.electron.ssh.writeFile(connectionId, tempPath, config);

            // Step 2: Try to move with sudo (User will see errors if they don't have sudo or if it fails)
            setStatus({ type: 'info', message: t('frontend.ssh.nginx.status.moving') });
            const moveCmd = `sudo mv ${tempPath} ${remotePath} && sudo ln -sf ${remotePath} /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`;

            const result = await window.electron.ssh.execute(connectionId, moveCmd);

            if (result.code === 0) {
                setStatus({ type: 'success', message: t('frontend.ssh.nginx.status.success') });
            } else {
                setStatus({ type: 'error', message: t('frontend.ssh.nginx.status.error', { error: result.stderr !== '' ? result.stderr : 'Unknown error' }) });
            }
        } catch (error) {
            setStatus({ type: 'error', message: `${t('common.error')}: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <IconServer className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">{t('frontend.ssh.nginx.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('frontend.ssh.nginx.subtitle')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="typo-caption font-bold text-muted-foreground">{t('frontend.ssh.nginx.domain')}</label>
                        <div className="relative">
                            <IconGlobe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                className="w-full bg-muted/30 border border-border rounded-lg h-10 pl-10 pr-4 focus:ring-1 focus:ring-primary/50 text-sm"
                                placeholder={t('frontend.ssh.nginx.placeholders.domain')}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="typo-caption font-bold text-muted-foreground">{t('frontend.ssh.nginx.port')}</label>
                        <input
                            type="number"
                            value={backendPort}
                            onChange={(e) => setBackendPort(e.target.value)}
                            className="w-full bg-muted/30 border border-border rounded-lg h-10 px-4 focus:ring-1 focus:ring-primary/50 text-sm"
                            placeholder={t('frontend.ssh.nginx.placeholders.port')}
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <button
                        onClick={generateConfig}
                        className="typo-caption font-medium text-primary hover:underline flex items-center gap-1"
                    >
                        <IconPlayerPlay className="w-3 h-3" />
                        {t('frontend.ssh.nginx.preview')}
                    </button>
                    <button
                        onClick={() => void handleApply()}
                        disabled={isGenerating || !domain}
                        className={C_NGINXWIZARD_1}
                    >
                        {isGenerating ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconDeviceFloppy className="w-4 h-4" />}
                        {t('frontend.ssh.nginx.apply')}
                    </button>
                </div>

                {status && (
                    <div className={cn(
                        'p-4 rounded-lg text-sm flex items-start gap-3 border',
                        status.type === 'success' && 'bg-success/10 border-success/20 text-success',
                        status.type === 'error' && 'bg-destructive/10 border-destructive/20 text-destructive',
                        status.type === 'info' && 'bg-primary/10 border-primary/20 text-primary'
                    )}>
                        {status.type === 'success' && <IconShieldCheck className="w-5 h-5 flex-shrink-0" />}
                        <p>{status.message}</p>
                    </div>
                )}

                {config && (
                    <div className="space-y-2 pt-4">
                        <label className="typo-caption font-bold text-muted-foreground">{t('frontend.ssh.nginx.configPreview')}</label>
                        <pre className="p-4 bg-muted/30 border border-border/50 rounded-xl font-mono typo-caption overflow-x-auto text-primary/80">
                            {config}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};


