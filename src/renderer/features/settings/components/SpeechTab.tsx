import React, { useState, useEffect, useMemo } from 'react'
import { Volume2, Speaker } from 'lucide-react'
import { AppSettings } from '../hooks/useSettingsLogic'
import { SelectDropdown } from '@/components/ui/SelectDropdown'

interface SpeechTabProps {
    settings: AppSettings | null
    updateSpeech: (patch: Partial<AppSettings['speech']>) => void
    t: (key: string) => string
}

export const SpeechTab: React.FC<SpeechTabProps> = ({ settings, updateSpeech, t }) => {
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

    useEffect(() => {
        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices()
            if (v.length > 0) setVoices(v)
        }

        const loadDevices = async () => {
            try {
                // Request permission first to get labels
                await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => console.warn('Mic permission denied:', err))
                const d = await navigator.mediaDevices.enumerateDevices()
                setDevices(d)
            } catch (err) {
                console.error('Error enumerating devices:', err)
            }
        }

        loadVoices()
        loadDevices()

        if (window.speechSynthesis.onvoiceschanged !== undefined) window.speechSynthesis.onvoiceschanged = loadVoices

        // Listen for device changes
        navigator.mediaDevices.ondevicechange = loadDevices

        return () => {
            navigator.mediaDevices.ondevicechange = null
        }
    }, [])

    const inputDevices = useMemo(() =>
        devices.filter(d => d.kind === 'audioinput').map(d => ({ value: d.deviceId, label: d.label || `${t('speech.microphone')} ${d.deviceId.slice(0, 5)}` })),
        [devices, t])

    const outputDevices = useMemo(() =>
        devices.filter(d => d.kind === 'audiooutput').map(d => ({ value: d.deviceId, label: d.label || `${t('speech.speaker')} ${d.deviceId.slice(0, 5)}` })),
        [devices, t])

    const handleTest = () => {
        const utterance = new SpeechSynthesisUtterance(t('speech.previewText'))
        const voice = voices.find(v => v.voiceURI === settings?.speech?.voiceURI)
        if (voice) utterance.voice = voice
        utterance.rate = settings?.speech?.rate || 1
        window.speechSynthesis.speak(utterance)
    }

    return (
        <div className="bg-card p-6 rounded-2xl border border-border">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-primary/10 text-primary"><Volume2 className="w-5 h-5" /></div>
                <div><h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('speech.title')}</h3><p className="text-xs text-muted-foreground">{t('speech.subtitle')}</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">{t('speech.voiceSelection')}</label>
                        <SelectDropdown
                            value={settings?.speech?.voiceURI || ''}
                            options={[
                                { value: '', label: t('speech.systemDefault') },
                                ...voices.map(v => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` }))
                            ]}
                            onChange={val => updateSpeech({ voiceURI: val })}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between mb-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('speech.speed')}</label><span className="text-xs font-mono text-primary font-bold">{settings?.speech?.rate || 1}x</span></div>
                        <input type="range" min="0.5" max="2" step="0.1" value={settings?.speech?.rate || 1} onChange={e => updateSpeech({ rate: parseFloat(e.target.value) })} className="w-full accent-primary" />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block flex items-center gap-1.5">
                            <Speaker className="w-3 h-3" /> {t('speech.microphone')}
                        </label>
                        <SelectDropdown
                            value={settings?.speech?.audioInputDeviceId || 'default'}
                            options={[
                                { value: 'default', label: t('speech.systemDefault') },
                                ...inputDevices
                            ]}
                            onChange={val => updateSpeech({ audioInputDeviceId: val })}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block flex items-center gap-1.5">
                            <Speaker className="w-3 h-3" /> {t('speech.speakerSelection')}
                        </label>
                        <SelectDropdown
                            value={settings?.speech?.audioOutputDeviceId || 'default'}
                            options={[
                                { value: 'default', label: t('speech.systemDefault') },
                                ...outputDevices
                            ]}
                            onChange={val => updateSpeech({ audioOutputDeviceId: val })}
                        />
                    </div>
                </div>

                <div className="flex flex-col justify-between md:col-span-2 mt-4 space-y-4">
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground leading-relaxed italic">"{t('speech.previewText')}"</div>
                    <button onClick={handleTest} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest transition-all border border-primary/20 hover:bg-primary/20"><Volume2 className="w-4 h-4" /> {t('speech.test')}</button>
                </div>
            </div>
        </div>
    )
}
