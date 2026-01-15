import { Globe, Loader2, Play, Save, Server, ShieldCheck } from 'lucide-react'
import React, { useState } from 'react'

import { Language, useTranslation } from '@/i18n'

interface NginxWizardProps {
    connectionId: string
    language: Language
}

export const NginxWizard: React.FC<NginxWizardProps> = ({ connectionId, language }) => {
    const { t } = useTranslation(language)
    const [domain, setDomain] = useState('')
    const [backendPort, setBackendPort] = useState('3000')
    const [isGenerating, setIsGenerating] = useState(false)
    const [config, setConfig] = useState('')
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

    const generateConfig = () => {
        const conf = `server {
    listen 80;
    server_name ${domain || 'example.com'};

    location / {
        proxy_pass http://localhost:${backendPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`
        setConfig(conf)
    }

    const handleApply = async () => {
        if (!domain) {
            setStatus({ type: 'error', message: 'Domain name is required' })
            return
        }

        setIsGenerating(true)
        setStatus({ type: 'info', message: 'Connecting to server...' })

        try {
            const fileName = domain.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            const remotePath = `/etc/nginx/sites-available/${fileName}`

            // Step 1: Write to temp file first (since /etc/nginx is likely protected)
            const tempPath = `/tmp/orbit_nginx_${fileName}`
            await window.electron.ssh.writeFile(connectionId, tempPath, config)

            // Step 2: Try to move with sudo (User will see errors if they don't have sudo or if it fails)
            setStatus({ type: 'info', message: 'Moving configuration to Nginx directory...' })
            const moveCmd = `sudo mv ${tempPath} ${remotePath} && sudo ln -sf ${remotePath} /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`

            const result = await window.electron.ssh.execute(connectionId, moveCmd)

            if (result.code === 0) {
                setStatus({ type: 'success', message: 'Nginx reloaded successfully!' })
            } else {
                setStatus({ type: 'error', message: `Failed to apply: ${result.stderr || 'Unknown error'}. Make sure you have sudo privileges.` })
            }
        } catch (error) {
            setStatus({ type: 'error', message: `Error: ${error instanceof Error ? error.message : String(error)}` })
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-background p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto w-full space-y-6">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">{t('ssh.nginx.title')}</h2>
                        <p className="text-sm text-muted-foreground">{t('ssh.nginx.subtitle')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{t('ssh.nginx.domain')}</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                className="w-full bg-muted/30 border border-border rounded-lg h-10 pl-10 pr-4 focus:ring-1 focus:ring-primary/50 text-sm"
                                placeholder={t('ssh.nginx.placeholders.domain')}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{t('ssh.nginx.port')}</label>
                        <input
                            type="number"
                            value={backendPort}
                            onChange={(e) => setBackendPort(e.target.value)}
                            className="w-full bg-muted/30 border border-border rounded-lg h-10 px-4 focus:ring-1 focus:ring-primary/50 text-sm"
                            placeholder={t('ssh.nginx.placeholders.port')}
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <button
                        onClick={generateConfig}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                        <Play className="w-3 h-3" />
                        {t('ssh.nginx.preview')}
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={isGenerating || !domain}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t('ssh.nginx.apply')}
                    </button>
                </div>

                {status && (
                    <div className={`p-4 rounded-lg text-sm flex items-start gap-3 border ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}>
                        {status.type === 'success' && <ShieldCheck className="w-5 h-5 flex-shrink-0" />}
                        <p>{status.message}</p>
                    </div>
                )}

                {config && (
                    <div className="space-y-2 pt-4">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{t('ssh.nginx.configPreview')}</label>
                        <pre className="p-4 bg-black/40 border border-border rounded-xl font-mono text-xs overflow-x-auto text-emerald-300/80">
                            {config}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    )
}
