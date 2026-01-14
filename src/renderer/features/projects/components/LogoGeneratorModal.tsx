import { Check, ImageIcon, Loader2,Sparkles, Wand2 } from 'lucide-react'
import React, { useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { Language,useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'
import { Project } from '@/types'

interface LogoGeneratorModalProps {
    isOpen: boolean
    onClose: () => void
    project: Project
    onApply: (logoPath: string) => void
    language: Language
}

export const LogoGeneratorModal: React.FC<LogoGeneratorModalProps> = ({
    isOpen, onClose, project, onApply, language
}) => {
    const { t } = useTranslation(language)
    const [prompt, setPrompt] = useState('')
    const [style, setStyle] = useState('Minimalist')
    const [isGenerating, setIsGenerating] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [generatedLogo, setGeneratedLogo] = useState<string | null>(null)
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [palette, setPalette] = useState<string[]>([])

    const handleAnalyze = async () => {
        setIsAnalyzing(true)
        try {
            const result = await window.electron.project.analyzeIdentity(project.path)
            setSuggestions(result.suggestedPrompts || [])
            setPalette(result.colors || [])
            if (result.suggestedPrompts?.length > 0 && !prompt) {
                setPrompt(result.suggestedPrompts[0])
            }
        } catch (error) {
            console.error('Analysis failed', error)
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handleGenerate = async () => {
        if (!prompt) {return}
        setIsGenerating(true)
        try {
            // Include palette colors in prompt if available
            const colorContext = palette.length > 0 ? ` Primary colors: ${palette.slice(0, 3).join(', ')}.` : ''
            const finalPrompt = `${prompt}${colorContext}`
            const logoPath = await window.electron.project.generateLogo(project.path, finalPrompt, style)
            setGeneratedLogo(logoPath)
        } catch (error) {
            console.error('Generation failed', error)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleImprovePrompt = async () => {
        if (!prompt || isAnalyzing) {return}
        setIsAnalyzing(true)
        try {
            const improved = await window.electron.project.improveLogoPrompt(prompt)
            setPrompt(improved)
        } catch (error) {
            console.error('Improvement failed', error)
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handleManualUpload = async () => {
        try {
            const uploadedPath = await window.electron.project.uploadLogo(project.path)
            if (uploadedPath) {
                onApply(uploadedPath)
                onClose()
            }
        } catch (error) {
            console.error('Manual upload failed', error)
        }
    }

    const handleApply = async () => {
        if (!generatedLogo) {return}
        setIsGenerating(true)
        try {
            const finalPath = await window.electron.project.applyLogo(project.path, generatedLogo)
            onApply(finalPath)
            onClose()
        } catch (error) {
            console.error('Apply failed', error)
        } finally {
            setIsGenerating(false)
        }
    }

    const selectIdea = (idea: string) => {
        setPrompt(idea)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('projects.aiLogoGenerator') || 'AI Logo Generator'}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                {/* Controls */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('projects.prompt')}</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleImprovePrompt}
                                    disabled={isAnalyzing || !prompt}
                                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                                    title={t('workspace.improvePromptWithAI')}
                                >
                                    <Sparkles className="w-3 h-3" />
                                    {t('projects.improvePrompt') || 'Improve'}
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing}
                                    className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                    {t('projects.analyzeContext') || 'Suggest Ideas'}
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm min-h-[100px] resize-none focus:border-primary/50 transition-colors outline-none"
                            placeholder={t('projects.logoPromptPlaceholder') || 'Describe your vision...'}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('projects.style') || 'Style'}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Minimalist', 'Cyberpunk', 'Modern', 'Retro', 'Modern gradient', '3D Render'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStyle(s)}
                                    className={cn(
                                        "px-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-tight border transition-all text-center truncate",
                                        style === s ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]" : "bg-black/40 border-white/10 text-muted-foreground hover:border-white/20 hover:bg-black/60"
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {suggestions.length > 0 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('projects.ideas') || 'Concepts'}</label>
                            <div className="flex flex-col gap-2">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => selectIdea(s)}
                                        className="text-left p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] text-zinc-400 hover:text-white transition-all border border-transparent hover:border-white/10"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {palette.length > 0 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('projects.suggestedPalette') || 'Brand Colors'}</label>
                            <div className="flex items-center gap-2 pt-1">
                                {palette.map((c, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setPrompt(prev => prev + ` Use color ${c}.`)}
                                        className="group relative"
                                        title={c}
                                    >
                                        <div className="w-8 h-8 rounded-full border border-white/10 shadow-lg transition-transform hover:scale-110 active:scale-90" style={{ backgroundColor: c }} />
                                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-[8px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">{c}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview */}
                <div className="flex flex-col gap-4">
                    <div className="aspect-square w-full rounded-2xl bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden group shadow-2xl">
                        {isGenerating ? (
                            <div className="text-center space-y-3 p-8">
                                <Sparkles className="w-12 h-12 mx-auto animate-bounce text-primary" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-white uppercase tracking-widest">{t('projects.generating') || 'Crafting...'}</p>
                                    <p className="text-[10px] text-muted-foreground italic">Bringing your vision to life</p>
                                </div>
                            </div>
                        ) : generatedLogo ? (
                            <img src={`safe-file://${generatedLogo}`} alt="Generated" className="w-full h-full object-cover animate-in zoom-in-95 duration-500" />
                        ) : (
                            <div className="text-center p-8 opacity-40">
                                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-primary/40" />
                                <p className="text-xs uppercase font-bold tracking-widest mb-4">{t('projects.preview') || 'Preview Area'}</p>
                                <button
                                    onClick={handleManualUpload}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                                >
                                    {t('projects.uploadOriginal') || 'Upload Manual Image'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt}
                            className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-black text-sm hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-primary/20 uppercase tracking-widest"
                        >
                            <Sparkles className="w-4 h-4" />
                            {t('projects.generate') || 'Generate with AI'}
                        </button>

                        {generatedLogo ? (
                            <button
                                onClick={handleApply}
                                disabled={isGenerating}
                                className="flex items-center justify-center px-6 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                title={t('workspace.applyLogo')}
                            >
                                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                            </button>
                        ) : (
                            <button
                                onClick={handleManualUpload}
                                className="flex items-center justify-center px-6 bg-white/5 text-muted-foreground hover:text-white border border-white/10 rounded-xl hover:bg-white/10 transition-all active:scale-95"
                                title={t('workspace.uploadImage')}
                            >
                                <ImageIcon className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    )
}
