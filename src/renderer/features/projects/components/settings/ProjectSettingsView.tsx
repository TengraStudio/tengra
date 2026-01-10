import React, { useState } from 'react'
import { Project } from '@/types'
import { useTranslation, Language } from '@/i18n'
import { Save, Trash2, Image as ImageIcon, Sparkles, Terminal, Settings as SettingsIcon, Wand2, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectSettingsViewProps {
    project: Project
    onUpdate: (updates: Partial<Project>) => Promise<void>
    onDelete: () => Promise<void>
    language: Language
}

export const ProjectSettingsView: React.FC<ProjectSettingsViewProps> = ({
    project, onUpdate, onDelete, language
}) => {
    const { t } = useTranslation(language)
    const [activeTab, setActiveTab] = useState<'general' | 'identity' | 'config'>('general')

    // Forms
    const [generalForm, setGeneralForm] = useState({ title: project.title, description: project.description })
    const [logoPrompt, setLogoPrompt] = useState('')
    const [logoStyle, setLogoStyle] = useState('Minimalist')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedLogo, setGeneratedLogo] = useState<string | null>(null)

    // Identity Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([])
    const [suggestedColors, setSuggestedColors] = useState<string[]>([])

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Save Handlers
    const handleGeneralSave = async () => {
        await onUpdate(generalForm)
    }

    const handleSuggestIdeas = async () => {
        setIsAnalyzing(true)
        try {
            const result = await window.electron.project.analyzeIdentity(project.path)
            setSuggestedIdeas(result.suggestedPrompts || [])
            setSuggestedColors(result.colors || [])
        } catch (error) {
            console.error('Identity analysis failed:', error)
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handleGenerateLogo = async () => {
        if (!logoPrompt) return
        setIsGenerating(true)
        try {
            const logoPath = await window.electron.project.generateLogo(project.path, logoPrompt, logoStyle)
            setGeneratedLogo(logoPath)
        } catch (error) {
            console.error('Logo generation failed:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="flex bg-[#09090b] text-foreground h-full overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/5 bg-background/20 flex flex-col p-4 gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    {t('settings.projectSettings') || 'Project Settings'}
                </h2>

                <button
                    onClick={() => setActiveTab('general')}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                        activeTab === 'general' ? "bg-white/10 text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                    )}
                >
                    <SettingsIcon className="w-4 h-4" />
                    {t('settings.general') || 'General'}
                </button>
                <button
                    onClick={() => setActiveTab('identity')}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                        activeTab === 'identity' ? "bg-white/10 text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                    )}
                >
                    <ImageIcon className="w-4 h-4" />
                    {t('settings.identity') || 'Identity & Logo'}
                </button>
                <button
                    onClick={() => setActiveTab('config')}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                        activeTab === 'config' ? "bg-white/10 text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                    )}
                >
                    <Terminal className="w-4 h-4" />
                    {t('settings.advanced') || 'Advanced Config'}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto space-y-8">

                    {activeTab === 'general' && (
                        <div className="space-y-8">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xl font-medium mb-1">{t('projects.generalInfo')}</h3>
                                    <p className="text-sm text-muted-foreground">{t('projects.generalInfoDesc')}</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">{t('projects.nameLabel')}</label>
                                        <input
                                            type="text"
                                            value={generalForm.title}
                                            onChange={(e) => setGeneralForm(prev => ({ ...prev, title: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">{t('projects.description')}</label>
                                        <textarea
                                            value={generalForm.description}
                                            onChange={(e) => setGeneralForm(prev => ({ ...prev, description: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 min-h-[100px]"
                                        />
                                    </div>
                                    <div className="space-y-2 opacity-60">
                                        <label className="text-xs font-medium uppercase text-muted-foreground">{t('projects.localPath')} (Read Only)</label>
                                        <div className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2.5 text-sm font-mono text-muted-foreground truncate">
                                            {project.path}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleGeneralSave}
                                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {t('projects.saveChanges')}
                                </button>
                            </div>

                            {/* Danger Zone */}
                            <div className="pt-8 border-t border-white/5">
                                <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-4">Danger Zone</h3>
                                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-6 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium text-white mb-1">{t('projects.deleteProject') || 'Delete Project'}</h4>
                                        <p className="text-sm text-muted-foreground">{t('projects.deleteProjectDesc') || 'Permanently delete this project and all its data.'}</p>
                                    </div>

                                    {!showDeleteConfirm ? (
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            {t('common.delete')}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                                            <span className="text-xs text-red-400 font-bold uppercase">Are you sure?</span>
                                            <button
                                                onClick={onDelete}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
                                            >
                                                Yes, Delete
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(false)}
                                                className="px-4 py-2 bg-transparent hover:bg-white/5 text-muted-foreground hover:text-white rounded-lg text-sm transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'identity' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-medium mb-1">{t('projects.identity')}</h3>
                                    <p className="text-sm text-muted-foreground">{t('projects.identityDesc')}</p>
                                </div>
                                <button
                                    onClick={handleSuggestIdeas}
                                    disabled={isAnalyzing}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg text-sm transition-all disabled:opacity-50"
                                >
                                    {isAnalyzing ? (
                                        <Wand2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Wand2 className="w-4 h-4" />
                                    )}
                                    {isAnalyzing ? t('projects.suggesting') : t('projects.suggestIdeas')}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Side: Preview & Current */}
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-xs font-medium uppercase text-muted-foreground block">{t('projects.currentLogo')}</label>
                                        <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center bg-black/20 relative overflow-hidden group shadow-inner">
                                            {project.logo || generatedLogo ? (
                                                <img src={`safe-file://${generatedLogo || project.logo}`} alt="Project Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center p-6 text-muted-foreground/40">
                                                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                    <p className="text-xs">{t('projects.noLogo')}</p>
                                                </div>
                                            )}

                                            {generatedLogo && generatedLogo !== project.logo && (
                                                <div className="absolute inset-0 bg-purple-900/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 p-6 text-center flex-col">
                                                    <p className="text-sm font-medium text-white">{t('projects.generatedLogoSuccess')}</p>
                                                    <div className="flex gap-2 w-full">
                                                        <button
                                                            onClick={async () => {
                                                                await onUpdate({ logo: generatedLogo })
                                                                setGeneratedLogo(null)
                                                            }}
                                                            className="flex-1 py-2 bg-white text-purple-900 rounded-lg text-xs font-bold hover:bg-white/90 transition-colors"
                                                        >
                                                            {t('projects.apply')}
                                                        </button>
                                                        <button
                                                            onClick={() => setGeneratedLogo(null)}
                                                            className="flex-1 py-2 bg-black/40 text-white rounded-lg text-xs font-medium hover:bg-black/60 transition-colors"
                                                        >
                                                            {t('projects.discard')}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {suggestedColors.length > 0 && (
                                        <div className="space-y-3 animate-in zoom-in-95 duration-300">
                                            <label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-2">
                                                <Palette className="w-3.5 h-3.5" />
                                                {t('projects.palette')}
                                            </label>
                                            <div className="flex gap-2">
                                                {suggestedColors.map((color, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-10 h-10 rounded-lg shadow-lg border border-white/10 group relative"
                                                        style={{ backgroundColor: color }}
                                                    >
                                                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {color}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Generator */}
                                <div className="space-y-6">
                                    <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-5">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight flex items-center gap-2">
                                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                                {t('projects.aiGenerator')}
                                            </label>

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] text-muted-foreground uppercase">{t('projects.style')}</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['Minimalist', 'Cyberpunk', 'Abstract', 'Retro', 'Modern gradient'].map((style) => (
                                                            <button
                                                                key={style}
                                                                onClick={() => setLogoStyle(style)}
                                                                className={cn(
                                                                    "px-3 py-2 rounded-lg text-xs border transition-all text-left",
                                                                    logoStyle === style
                                                                        ? "bg-purple-500/10 border-purple-500/50 text-purple-300"
                                                                        : "bg-black/20 border-white/5 text-muted-foreground hover:border-white/20"
                                                                )}
                                                            >
                                                                {t(`projects.styles.${style.toLowerCase().replace(' ', '')}`) || style}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] text-muted-foreground uppercase">{t('projects.prompt')}</label>
                                                    <textarea
                                                        value={logoPrompt}
                                                        onChange={(e) => setLogoPrompt(e.target.value)}
                                                        placeholder={t('projects.prompt') + '...'}
                                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 min-h-[100px] resize-none transition-all placeholder:text-muted-foreground/30"
                                                    />
                                                </div>

                                                {suggestedIdeas.length > 0 && (
                                                    <div className="space-y-2 animate-in fade-in duration-500">
                                                        <label className="text-[10px] text-muted-foreground uppercase">{t('projects.ideas')}</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {suggestedIdeas.map((idea, i) => (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => setLogoPrompt(idea)}
                                                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[11px] text-white/70 transition-colors"
                                                                >
                                                                    {idea}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={handleGenerateLogo}
                                                    disabled={isGenerating || !logoPrompt}
                                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-500/20 active:scale-[0.98]"
                                                >
                                                    {isGenerating ? (
                                                        <>
                                                            <Sparkles className="w-4 h-4 animate-spin" />
                                                            {t('projects.generating')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-4 h-4" />
                                                            {t('projects.generate')}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {suggestedIdeas.length === 0 && !isAnalyzing && (
                                        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                            <p className="text-[11px] text-blue-300/60 leading-relaxed italic">
                                                {t('projects.noIdentity')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-medium mb-1">{t('projects.advancedConfig')}</h3>
                                <p className="text-sm text-muted-foreground">{t('projects.advancedConfigDesc')}</p>
                            </div>

                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/80 text-sm">
                                {t('projects.configComingSoon')}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
