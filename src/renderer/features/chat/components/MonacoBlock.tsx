import React, { useState } from 'react'
import { CodeEditor } from '@/components/ui/CodeEditor'
import { Volume2, VolumeX, Copy, Check } from 'lucide-react'
import { normalizeLanguage } from '@/utils/language-map'
import { useTranslation, Language } from '@/i18n'
// import { cn } from '@/lib/utils'

interface MonacoBlockProps {
    language: string
    code: string
    isSpeaking?: boolean
    onSpeak?: () => void
    onStop?: () => void
    i18nLanguage?: Language
}

export const MonacoBlock: React.FC<MonacoBlockProps> = ({
    language,
    code,
    isSpeaking,
    onSpeak,
    onStop,
    i18nLanguage = 'en'
}) => {
    const { t } = useTranslation(i18nLanguage)
    const [copied, setCopied] = useState(false)

    // Calculate initial height based on lines
    const lines = code.split('\n').length
    const height = Math.min(Math.max(lines * 19 + 20, 100), 600) // Max 600px, then scroll

    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="not-prose my-3 rounded-xl overflow-hidden border border-border/30 bg-[#1e1e1e] group/code transition-premium shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 backdrop-blur-sm">
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60 group-hover/code:opacity-100 transition-opacity">
                    {language || 'plaintext'}
                </span>
                <div className="flex items-center gap-1.5">
                    {isSpeaking ? (
                        <button onClick={onStop} className="p-1 px-1.5 hover:bg-white/10 rounded-md transition-colors text-primary" title={t('workspace.stopSpeaking')}>
                            <VolumeX className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <button onClick={onSpeak} className="p-1 px-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground" title={t('workspace.speakCode')}>
                            <Volume2 className="w-3.5 h-3.5" />
                        </button>
                    )}

                    <button onClick={handleCopy} className="p-1 px-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground relative">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Editor Body */}
            <div style={{ height: `${height}px` }} className="relative w-full">
                <CodeEditor
                    value={code}
                    language={normalizeLanguage(language)}
                    readOnly={true}
                    showMinimap={code.split('\n').length > 25}
                    theme="vs-dark"
                    fontSize={13}
                    className="bg-[#1e1e1e]"
                />
            </div>
        </div>
    )
}
