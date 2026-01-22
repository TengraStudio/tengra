import { Loader2, Sparkles, X } from 'lucide-react'
import React, { useState } from 'react'

import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

import { useLogoGeneration } from '../hooks/useLogoGeneration'

interface LogoGeneratorProps {
    ideaId: string
    ideaTitle: string
    onClose: () => void
}

const LogoPreview: React.FC<{ logoPath: string | null }> = ({ logoPath }) => {
    if (!logoPath) {
        return null
    }
    return (
        <div className="mb-4 p-4 bg-black/40 rounded-lg flex items-center justify-center">
            <img
                src={`file://${logoPath}`}
                alt="Generated logo"
                className="max-w-[200px] max-h-[200px] object-contain"
            />
        </div>
    )
}

const LogoError: React.FC<{ error: string | null }> = ({ error }) => {
    if (!error) {
        return null
    }
    return (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
        </div>
    )
}

export const LogoGenerator: React.FC<LogoGeneratorProps> = ({
    ideaId,
    ideaTitle,
    onClose
}) => {
    const { t } = useTranslation()
    const [prompt, setPrompt] = useState(`Modern minimalist logo for ${ideaTitle}`)
    const { isGenerating, logoPath, error, generateLogo } = useLogoGeneration()

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            return
        }
        await generateLogo(ideaId, prompt)
    }

    return (
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="flex items-center gap-2 font-medium text-white">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    {t('ideas.logo.title')}
                </h4>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="mb-4">
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={t('ideas.logo.promptPlaceholder')}
                    rows={2}
                    className={cn(
                        'w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg',
                        'text-white placeholder-white/30 resize-none',
                        'focus:outline-none focus:border-purple-500/50'
                    )}
                />
            </div>

            <LogoPreview logoPath={logoPath} />
            <LogoError error={error} />

            <button
                type="button"
                onClick={() => {
                    void handleGenerate()
                }}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                    'w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                    'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('ideas.logo.generating')}
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" />
                        {t('ideas.logo.generate')}
                    </>
                )}
            </button>
        </div>
    )
}
