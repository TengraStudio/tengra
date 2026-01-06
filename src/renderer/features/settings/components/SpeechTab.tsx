import React, { useState, useEffect } from 'react'
import { Volume2 } from 'lucide-react'
import { AppSettings } from '../../hooks/useSettingsLogic'

interface SpeechTabProps {
    settings: AppSettings | null
    updateSpeech: (patch: Partial<AppSettings['speech']>) => void
}

export const SpeechTab: React.FC<SpeechTabProps> = ({ settings, updateSpeech }) => {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

    useEffect(() => {
        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices()
            if (v.length > 0) setVoices(v)
        }
        loadVoices()
        if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = loadVoices
    }, [])

    const handleTest = () => {
        const utterance = new SpeechSynthesisUtterance("YÄ±ldÄ±zlara ulaÅŸmak iÃ§in ayaklarÄ±nÄ±za deÄŸil, gÃ¶kyÃ¼zÃ¼ne bakÄ±n. Orbit ile her ÅŸey mÃ¼mkÃ¼n.")
        const voice = voices.find(v => v.voiceURI === settings?.speech?.voiceURI)
        if (voice) utterance.voice = voice
        utterance.rate = settings?.speech?.rate || 1
        window.speechSynthesis.speak(utterance)
    }

    return (
        <div className="bg-card p-6 rounded-2xl border border-border">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-primary/10 text-primary"><Volume2 className="w-5 h-5" /></div>
                <div><h3 className="text-sm font-bold text-white uppercase tracking-wider">Ses & KonuÅŸma</h3><p className="text-xs text-muted-foreground">Asistan yanÄ±tlarÄ± iÃ§in ses ayarlarÄ±nÄ± yapÄ±n.</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Ses SeÃ§imi</label>
                        <select value={settings?.speech?.voiceURI || ''} onChange={e => updateSpeech({ voiceURI: e.target.value })} className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-2.5 font-medium text-primary cursor-pointer appearance-none">
                            <option value="">Sistem VarsayÄ±lanÄ±</option>
                            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="flex justify-between mb-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">KonuÅŸma HÄ±zÄ±</label><span className="text-xs font-mono text-primary font-bold">{settings?.speech?.rate || 1}x</span></div>
                        <input type="range" min="0.5" max="2" step="0.1" value={settings?.speech?.rate || 1} onChange={e => updateSpeech({ rate: parseFloat(e.target.value) })} className="w-full accent-primary" />
                    </div>
                </div>
                <div className="flex flex-col justify-between">
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground leading-relaxed italic">"YÄ±ldÄ±zlara ulaÅŸmak iÃ§in ayaklarÄ±nÄ±za deÄŸil, gÃ¶kyÃ¼zÃ¼ne bakÄ±n. Orbit ile her ÅŸey mÃ¼mkÃ¼n."</div>
                    <button onClick={handleTest} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest transition-all border border-primary/20"><Volume2 className="w-4 h-4" /> Test Et</button>
                </div>
            </div>
        </div>
    )
}
