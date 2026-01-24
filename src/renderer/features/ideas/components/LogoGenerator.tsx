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
        <div className="mb-4 p-4 bg-muted/20 border border-border/50 rounded-lg flex items-center justify-center backdrop-blur-sm">
            <img
                src={`file://${logoPath}`}
                alt="Generated logo"
                className="max-w-[200px] max-h-[200px] object-contain drop-shadow-2xl"
            />
        </div>
    )
}

const LogoError: React.FC<{ error: string | null }> = ({ error }) => {
    if (!error) {
        return null
    }
    return (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-bold flex items-center gap-2">
            <Sparkles className="w-3 h-3 animate-pulse" />
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
        <div className="bg-muted/10 rounded-xl border border-border/50 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
                <h4 className="flex items-center gap-2 font-bold text-foreground">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {t('ideas.logo.title')}
                </h4>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-muted/30 text-muted-foreground/60 hover:text-foreground transition-colors"
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
                        'w-full px-4 py-3 bg-muted/20 border border-border/50 rounded-lg',
                        'text-foreground placeholder:text-muted-foreground/30 resize-none',
                        'focus:outline-none focus:border-primary/50 transition-all text-sm'
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
                    'w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2',
                    'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20',
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
