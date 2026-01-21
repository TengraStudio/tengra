import { Activity, AlertTriangle,ExternalLink } from 'lucide-react'
import React from 'react'

import antigravityLogo from '@/assets/antigravity.svg'

interface AboutTabProps {
    onReset: () => void
    t: (key: string) => string
}

export const AboutTab: React.FC<AboutTabProps> = ({ onReset, t }) => {
    return (
        <div className="space-y-6">
            <div className="bg-card p-8 rounded-xl border border-border flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mb-2"><img src={antigravityLogo} alt="Logo" className="w-12 h-12 opacity-80" /></div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Orbit AI</h2>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <p className="text-sm text-primary font-mono font-bold">v1.2.0 (Beta)</p>
                        <button
                            onClick={() => console.warn(t('about.updateCheckAlert'))}
                            className="bg-primary/10 text-[10px] text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors uppercase font-bold tracking-wide"
                        >
                            {t('about.checkUpdates')}
                        </button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground max-w-md">{t('about.description')}</p>
                <div className="flex gap-3">
                    <button onClick={() => window.electron.openExternal('https://github.com/agnes0912491/orbit')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground hover:text-foreground border border-white/5"><ExternalLink className="w-3.5 h-3.5" /> {t('about.privacyPolicy')}</button>
                    <button onClick={() => window.electron.openExternal('https://github.com/agnes0912491/orbit')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground hover:text-foreground border border-white/5"><ExternalLink className="w-3.5 h-3.5" /> {t('about.github')}</button>
                </div>
                <div className="pt-6 border-t border-white/5 w-full"><p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">{t('about.copyright')}</p></div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> {t('advanced.systemInfo')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5"><div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t('advanced.platform')}</div><div className="text-sm font-bold text-white">{navigator.platform}</div></div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5"><div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t('settings.language')}</div><div className="text-sm font-bold text-white">{navigator.language}</div></div>
                </div>
            </div>
            <div className="bg-card p-6 rounded-xl border border-red-500/20">
                <div className="flex items-center justify-between">
                    <div><h3 className="text-sm font-bold text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {t('about.factoryReset')}</h3><p className="text-xs text-muted-foreground mt-1">{t('about.factoryResetDesc')}</p></div>
                    <button onClick={onReset} className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20">{t('about.factoryReset')}</button>
                </div>
            </div>
        </div>
    )
}
