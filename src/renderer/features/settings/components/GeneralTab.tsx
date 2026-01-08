import React from 'react'
import { Globe, Activity, Database } from 'lucide-react'
import { AppSettings } from '../hooks/useSettingsLogic'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

interface GeneralTabProps {
    settings: AppSettings | null
    updateGeneral: (patch: Partial<AppSettings['general']>) => void
    t: (key: string) => string
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, updateGeneral, t }) => {
    const languageOptions = [
        { value: 'tr', label: t('general.turkish') },
        { value: 'en', label: t('general.english') }
    ]

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {t('settings.language')}
                    </label>
                    <SelectDropdown
                        value={settings?.general?.language || 'tr'}
                        options={languageOptions}
                        onChange={(val) => updateGeneral({ language: val })}
                        className="mt-2"
                    />
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                    <label className="text-xs font-bold uppercase text-muted-foreground mr-2">
                        <Activity className="w-3 h-3 inline mr-1" /> {t('general.contextMessageLimit')}
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
                        <div className="text-sm font-bold text-white uppercase tracking-wider">{t('general.database')}</div>
                        <div className="text-xs text-muted-foreground">{t('general.databaseDesc')}</div>
                    </div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between">
                    <div>
                        <div className="text-sm font-bold text-white uppercase tracking-wider">{t('general.onboardingTour')}</div>
                        <div className="text-xs text-muted-foreground">{t('general.onboardingTourDesc')}</div>
                    </div>
                    <button
                        onClick={() => updateGeneral({ onboardingCompleted: false } as any)}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold uppercase rounded-lg border border-primary/20 transition-all"
                    >
                        {t('general.startTour')}
                    </button>
                </div>
            </div>
        </div>
    )
}
