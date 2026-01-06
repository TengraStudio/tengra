import React from 'react'
import { Globe, Activity, Database } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { AppSettings } from '../../hooks/useSettingsLogic'

interface GeneralTabProps {
    settings: AppSettings | null
    updateGeneral: (patch: Partial<AppSettings['general']>) => void
    t: any
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, updateGeneral, t }) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {t('settings.language')}
                    </label>
                    <select
                        value={settings?.general?.language || 'tr'}
                        onChange={e => updateGeneral({ language: e.target.value })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 mt-2 font-mono text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="tr">TÃ¼rkÃ§e</option>
                        <option value="en">English</option>
                    </select>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2">
                        <Activity className="w-3 h-3 inline mr-1" /> Kontekst Mesaj Limiti
                    </label>
                    <input
                        type="number"
                        value={settings?.general?.contextMessageLimit || 50}
                        onChange={e => updateGeneral({ contextMessageLimit: parseInt(e.target.value) })}
                        className="w-full bg-muted/20 border border-border/50 rounded-lg px-3 py-2 mt-2 font-mono text-primary"
                    />
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                    <Database className="w-8 h-8 text-primary/40" />
                    <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">VeritabanÄ±</div>
                        <div className="text-xs text-muted-foreground">Yerel verileriniz ÅŸifrelenmiÅŸ olarak saklanÄ±r.</div>
                    </div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between">
                    <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">TanÄ±tÄ±m Turu</div>
                        <div className="text-xs text-muted-foreground">Orbit Ã¶zelliklerini keÅŸfetmek iÃ§in turu tekrar baÅŸlatÄ±n.</div>
                    </div>
                    <button
                        onClick={() => updateGeneral({ onboardingCompleted: false } as any)}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold uppercase rounded-lg border border-primary/20 transition-all"
                    >
                        Turu BaÅŸlat
                    </button>
                </div>
            </div>
        </div>
    )
}
