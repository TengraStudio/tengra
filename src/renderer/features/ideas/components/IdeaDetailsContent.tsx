import {
    BusinessModel,
    IdeaCompetitor,
    JourneyStep,
    MarketingPlan,
    MarketTrend,
    ProjectIdea,
    ProjectRoadmap,
    SWOTAnalysis,
    TechStack,
    UserPersona
} from '@shared/types/ideas'
import {
    CheckCircle,
    ChevronRight,
    Code2,
    Cpu,
    Database,
    Globe,
    // Layers removed
    Map,
    Server,
    Sparkles,
    Target,
    TrendingUp,
    Trophy,
    Users,
    Wrench
} from 'lucide-react'
import React, { useState } from 'react'

import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

import { LogoGenerator } from './LogoGenerator'

interface IdeaDetailsContentProps {
    idea: ProjectIdea
    activeTab: 'overview' | 'market' | 'strategy' | 'technology' | 'roadmap' | 'users' | 'business'
    selectedName: string
    onNameSelect: (name: string) => void
    canGenerateLogo: boolean
    showLogoGenerator: boolean
    setShowLogoGenerator: (show: boolean) => void
}

const ValueProposition: React.FC<{ value?: string }> = ({ value }) => {
    const { t } = useTranslation()
    if (!value) { return null }
    return (
        <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {t('ideas.idea.valueProposition')}
            </h3>
            <p className="text-foreground/70 bg-muted/20 rounded-lg p-4 leading-relaxed border border-border/10 italic">{value}</p>
        </div>
    )
}

const NameSuggestions: React.FC<{
    names: string[],
    selectedName: string,
    onSelect: (name: string) => void
}> = ({ names, selectedName, onSelect }) => {
    const { t } = useTranslation()
    if (names.length === 0) { return null }
    return (
        <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <Trophy className="w-4 h-4 text-primary" />
                {t('ideas.idea.nameSuggestions')}
            </h3>
            <div className="flex flex-wrap gap-2">
                {names.map((name, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelect(name)}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                            selectedName === name
                                ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105'
                                : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'
                        )}
                    >
                        {name}
                    </button>
                ))}
            </div>
        </div>
    )
}

const CompetitiveAdvantages: React.FC<{ advantages: string[] }> = ({ advantages }) => {
    const { t } = useTranslation()
    if (advantages.length === 0) { return null }
    return (
        <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <TrendingUp className="w-4 h-4 text-green-500" />
                {t('ideas.idea.competitiveAdvantages')}
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {advantages.map((adv, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-foreground/70 text-sm bg-muted/20 p-3 rounded-lg border border-border/10">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{adv}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const MarketTrends: React.FC<{ trends: MarketTrend[] }> = ({ trends }) => {
    const { t } = useTranslation()
    if (trends.length === 0) { return null }
    return (
        <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                {t('ideas.idea.marketTrends')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trends.slice(0, 4).map((trend, idx) => (
                    <div key={idx} className="bg-muted/20 border border-border/10 rounded-lg p-3">
                        <p className="text-sm font-medium text-foreground">{trend.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{trend.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// (Unused Competitors component removed to reduce complexity)

// ==================== New Multi-Stage Pipeline Components ====================

const RoadmapSection: React.FC<{ roadmap?: ProjectRoadmap }> = ({ roadmap }) => {
    const { t } = useTranslation()
    const [expandedPhase, setExpandedPhase] = useState<number | null>(null)

    if (!roadmap) {
        return null
    }

    const togglePhase = (idx: number) => {
        setExpandedPhase(expandedPhase === idx ? null : idx)
    }

    return (
        <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <Map className="w-4 h-4 text-indigo-400" />
                {t('ideas.idea.roadmap')}
                <span className="text-xs text-muted-foreground/40 ml-auto">{roadmap.totalDuration}</span>
            </h3>
            <div className="space-y-3">
                {/* MVP Phase */}
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-primary uppercase tracking-wider">{roadmap.mvp.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded border border-border/50">{roadmap.mvp.duration}</span>
                    </div>
                    <p className="text-xs text-foreground/70 mb-2 leading-relaxed">{roadmap.mvp.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {roadmap.mvp.deliverables.map((d: string, i: number) => (
                            <span key={i} className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/20">
                                {d}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Additional Phases */}
                {roadmap.phases.map((phase, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => togglePhase(idx)}
                            className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <ChevronRight className={cn(
                                    'w-4 h-4 text-muted-foreground/40 transition-transform',
                                    expandedPhase === idx && 'rotate-90'
                                )} />
                                <span className="text-sm font-medium text-foreground">{phase.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground/40">{phase.duration}</span>
                        </button>
                        {expandedPhase === idx && (
                            <div className="px-3 pb-3 pt-0">
                                <p className="text-xs text-foreground/60 mb-2 ml-6">{phase.description}</p>
                                <div className="flex flex-wrap gap-1.5 ml-6">
                                    {phase.deliverables.map((d: string, i: number) => (
                                        <span key={i} className="text-xs bg-muted/50 text-foreground/70 px-2 py-0.5 rounded">
                                            {d}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

const TechStackSection: React.FC<{ techStack?: TechStack }> = ({ techStack }) => {
    const { t } = useTranslation()
    if (!techStack) { return null }

    const categories = [
        { key: 'frontend', label: t('ideas.techStack.frontend'), icon: Globe, color: 'text-blue-400', items: techStack.frontend },
        { key: 'backend', label: t('ideas.techStack.backend'), icon: Server, color: 'text-green-400', items: techStack.backend },
        { key: 'database', label: t('ideas.techStack.database'), icon: Database, color: 'text-yellow-400', items: techStack.database },
        { key: 'infrastructure', label: t('ideas.techStack.infrastructure'), icon: Cpu, color: 'text-purple-400', items: techStack.infrastructure },
        { key: 'other', label: t('ideas.techStack.other'), icon: Wrench, color: 'text-orange-400', items: techStack.other }
    ].filter(c => c.items.length > 0)

    if (categories.length === 0) { return null }

    return (
        <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <Code2 className="w-4 h-4 text-primary" />
                {t('ideas.idea.techStack')}
            </h3>
            <div className="space-y-3">
                {categories.map(({ key, label, icon: Icon, color, items }) => (
                    <div key={key} className="bg-muted/20 border border-border/10 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Icon className={cn('w-4 h-4', color)} />
                            <span className="text-xs font-bold text-foreground/70 uppercase tracking-widest">{label}</span>
                        </div>
                        <div className="space-y-2">
                            {items.map((tech, idx) => (
                                <div key={idx} className="bg-muted/10 rounded p-2 border border-border/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-foreground">{tech.name}</span>
                                        {tech.alternatives && tech.alternatives.length > 0 && (
                                            <span className="text-xs text-muted-foreground/40">
                                                Alt: {tech.alternatives.slice(0, 2).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{tech.reason}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const IdeaCompetitorsSection: React.FC<{ competitors?: IdeaCompetitor[] }> = ({ competitors }) => {
    const { t } = useTranslation()
    const [expandedComp, setExpandedComp] = useState<number | null>(null)

    if (!competitors || competitors.length === 0) { return null }

    return (
        <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <Target className="w-4 h-4 text-primary" />
                {t('ideas.idea.competitorAnalysis')}
            </h3>
            <div className="space-y-3">
                {competitors.map((comp, idx) => (
                    <div key={idx} className="bg-muted/10 rounded-lg overflow-hidden border border-border/50">
                        <button
                            type="button"
                            onClick={() => setExpandedComp(expandedComp === idx ? null : idx)}
                            className="w-full flex items-start justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground">{comp.name}</span>
                                    {comp.marketPosition && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-muted/50 text-muted-foreground/60">
                                            {comp.marketPosition}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{comp.description}</p>
                            </div>
                            <ChevronRight className={cn(
                                'w-4 h-4 text-muted-foreground/40 transition-transform shrink-0 ml-2',
                                expandedComp === idx && 'rotate-90'
                            )} />
                        </button>
                        {expandedComp === idx && (
                            <div className="px-3 pb-3 space-y-3 border-t border-border/10 pt-3">
                                {/* Strengths */}
                                {comp.strengths.length > 0 && (
                                    <div>
                                        <span className="text-xs font-semibold text-green-500">{t('ideas.competitor.strengths')}</span>
                                        <ul className="mt-1 space-y-1">
                                            {comp.strengths.map((s, i) => (
                                                <li key={i} className="text-xs text-foreground/60 flex items-start gap-1.5">
                                                    <CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {/* Weaknesses */}
                                {comp.weaknesses.length > 0 && (
                                    <div>
                                        <span className="text-xs font-semibold text-red-500">{t('ideas.competitor.weaknesses')}</span>
                                        <ul className="mt-1 space-y-1">
                                            {comp.weaknesses.map((w, i) => (
                                                <li key={i} className="text-xs text-foreground/60 flex items-start gap-1.5">
                                                    <span className="w-3 h-3 flex items-center justify-center shrink-0 text-red-500">−</span>
                                                    {w}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {/* Missing Features */}
                                {comp.missingFeatures.length > 0 && (
                                    <div>
                                        <span className="text-xs font-semibold text-yellow-500">{t('ideas.competitor.missingFeatures')}</span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {comp.missingFeatures.map((f, i) => (
                                                <span key={i} className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Differentiation Opportunity */}
                                {comp.differentiationOpportunity && (
                                    <div className="bg-primary/10 rounded p-2 border border-primary/20">
                                        <span className="text-xs font-bold text-primary uppercase tracking-widest">{t('ideas.competitor.opportunity')}</span>
                                        <p className="text-xs text-foreground/70 mt-1 italic">{comp.differentiationOpportunity}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

const PersonasSection: React.FC<{ personas?: UserPersona[], journey?: JourneyStep[] }> = ({ personas, journey }) => {
    if (!personas || personas.length === 0) { return null }

    return (
        <div className="space-y-8">
            <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-4">
                    <Users className="w-4 h-4 text-primary" />
                    Target Personas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {personas.map((p, i) => (
                        <div key={i} className="bg-muted/20 border border-border/50 rounded-xl p-4 flex flex-col group hover:bg-primary/5 hover:border-primary/20 transition-all">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl grayscale-[0.5] group-hover:grayscale-0 transition-all">
                                    {p.avatarEmoji || '👤'}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-foreground">{p.name}</p>
                                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">{p.role}</p>
                                </div>
                            </div>
                            <div className="space-y-3 flex-1">
                                <div>
                                    <p className="text-[10px] font-bold text-primary uppercase mb-1">Pain Points</p>
                                    <ul className="space-y-1">
                                        {p.painPoints.slice(0, 2).map((pt, j) => (
                                            <li key={j} className="text-[11px] text-foreground/80 leading-tight flex items-start gap-1">
                                                <span className="text-primary font-bold">•</span> {pt}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {journey && journey.length > 0 && (
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-4">
                        <Map className="w-4 h-4 text-blue-400" />
                        User Journey Map
                    </h3>
                    <div className="relative flex flex-col space-y-4">
                        <div className="absolute left-4 top-2 bottom-2 w-px bg-border/50" />
                        {journey.map((step, i) => (
                            <div key={i} className="relative pl-10">
                                <div className={cn(
                                    "absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-background z-10",
                                    step.emotion === 'excited' ? 'bg-green-500' :
                                        step.emotion === 'happy' ? 'bg-blue-500' :
                                            step.emotion === 'neutral' ? 'bg-muted-foreground/40' : 'bg-red-500'
                                )} />
                                <div className="bg-muted/30 rounded-lg p-3 border border-border/20">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{step.stage}</span>
                                        <span className="text-[10px] text-muted-foreground/30">{step.emotion}</span>
                                    </div>
                                    <p className="text-sm text-foreground/80 mb-1">{step.action}</p>
                                    <p className="text-[11px] text-blue-400/80 font-medium italic">Benefit: {step.benefit}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

const BusinessCaseSection: React.FC<{ swot?: SWOTAnalysis, businessModel?: BusinessModel, marketingPlan?: MarketingPlan }> = ({ swot, businessModel, marketingPlan }) => {

    return (
        <div className="space-y-10">
            {/* SWOT Matrix */}
            {swot && (
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-4">
                        <Target className="w-4 h-4 text-orange-400" />
                        SWOT Analysis
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Strengths', items: swot.strengths, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20' },
                            { label: 'Weaknesses', items: swot.weaknesses, color: 'text-destructive', bg: 'bg-destructive/5', border: 'border-destructive/20' },
                            { label: 'Opportunities', items: swot.opportunities, color: 'text-accent', bg: 'bg-accent/5', border: 'border-accent/20' },
                            { label: 'Threats', items: swot.threats, color: 'text-amber-500', bg: 'bg-amber-500/5', border: 'border-amber-500/20' }
                        ].map((cell, i) => (
                            <div key={i} className={cn("p-4 rounded-xl border", cell.bg, cell.border)}>
                                <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-3", cell.color)}>{cell.label}</p>
                                <ul className="space-y-2">
                                    {cell.items.slice(0, 3).map((item, j) => (
                                        <li key={j} className="text-xs text-foreground/70 flex items-start gap-2">
                                            <div className={cn("w-1 h-1 rounded-full mt-1.5 shrink-0", cell.color.replace('text', 'bg'))} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Business Model */}
            {businessModel && (
                <div className="bg-muted/20 border border-border/50 rounded-2xl p-6">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                        Revenue Model
                        <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] normal-case tracking-normal border border-primary/20">
                            {businessModel.monetizationType}
                        </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            {businessModel.revenueStreams.map((rs, i) => (
                                <div key={i} className="bg-muted/10 rounded-xl p-4 border border-border/10">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-bold text-foreground">{rs.name}</p>
                                        <p className="text-xs font-black text-primary">{rs.pricePoint}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{rs.description}</p>
                                </div>
                            ))}
                        </div>
                        <div className="bg-primary/5 rounded-xl p-5 border border-primary/10">
                            <p className="text-[10px] font-bold text-primary uppercase mb-3">Break-even Strategy</p>
                            <p className="text-xs text-foreground/70 leading-relaxed font-sans italic">
                                "{businessModel.breakEvenStrategy}"
                            </p>
                            <div className="mt-4 pt-4 border-t border-border/20">
                                <p className="text-[10px] font-bold text-foreground/40 uppercase mb-2">Cost Structure</p>
                                <div className="flex flex-wrap gap-2">
                                    {businessModel.costStructure.map((c, i) => (
                                        <span key={i} className="text-[10px] bg-muted/50 text-muted-foreground/50 px-2 py-1 rounded border border-border/10">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Marketing / GTM */}
            {marketingPlan && (
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-4">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        Go-To-Market Plan
                    </h3>
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                        <p className="text-[10px] font-bold text-primary uppercase mb-4 tracking-widest">First 100 Users Strategy</p>
                        <div className="space-y-3">
                            {marketingPlan.first100UsersActionableSteps.map((step, i) => (
                                <div key={i} className="flex items-center gap-3 bg-muted/20 p-3 rounded-lg group border border-border/5">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                        {i + 1}
                                    </div>
                                    <p className="text-xs text-foreground/80">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const ResearchChat: React.FC<{ ideaId: string }> = ({ ideaId }) => {
    const [question, setQuestion] = useState('')
    const [chat, setChat] = useState<Array<{ q: string, a?: string }>>([])
    const [isLoading, setIsLoading] = useState(false)

    const handleAsk = async () => {
        if (!question.trim() || isLoading) { return }
        const currentQ = question
        setQuestion('')
        setChat(prev => [...prev, { q: currentQ }])
        setIsLoading(true)

        try {
            const result = await window.electron.ideas.queryResearch(ideaId, currentQ)
            setChat(prev => prev.map(item => item.q === currentQ ? { ...item, a: result.answer } : item))
        } catch {
            setChat(prev => prev.map(item => item.q === currentQ ? { ...item, a: "I'm sorry, I couldn't reach the research laboratory right now." } : item))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="bg-muted/30 border border-border/50 rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-foreground/80 uppercase tracking-widest">Research Assistant</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                {chat.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <p className="text-muted-foreground/60 text-xs leading-relaxed max-w-[200px] font-medium italic">
                            Ask me anything about the market research, competition, or tech stack for this idea!
                        </p>
                    </div>
                )}
                {chat.map((m, i) => (
                    <div key={i} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-end">
                            <div className="bg-primary/20 text-primary text-xs py-2 px-3 rounded-2xl rounded-tr-none border border-primary/30 font-medium">
                                {m.q}
                            </div>
                        </div>
                        {m.a && (
                            <div className="flex justify-start">
                                <div className="bg-muted/50 text-foreground/90 text-xs py-3 px-4 rounded-2xl rounded-tl-none border border-border/50 max-w-[85%] leading-relaxed">
                                    {m.a}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-muted/30 w-12 h-6 rounded-full" />
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-border/50 bg-muted/10">
                <div className="relative">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
                        placeholder="Ask about competitors, gaps, or logic..."
                        className="w-full bg-muted/20 border border-border/50 rounded-xl py-2.5 pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    <button
                        onClick={() => { void handleAsk() }}
                        disabled={!question.trim() || isLoading}
                        className="absolute right-2 top-1.5 p-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export const IdeaDetailsContent: React.FC<IdeaDetailsContentProps> = ({
    idea,
    activeTab,
    selectedName,
    onNameSelect,
    canGenerateLogo,
    showLogoGenerator,
    setShowLogoGenerator
}) => {
    const { t } = useTranslation()
    const nameSuggestions = idea.nameSuggestions ?? []
    const competitiveAdvantages = idea.competitiveAdvantages ?? []
    const marketTrends = idea.marketResearch?.trends ?? []
    // unused competitors removed
    const ideaCompetitors = idea.ideaCompetitors ?? []

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-muted/20 border border-border/50 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Sparkles className="w-32 h-32 text-primary" />
                            </div>
                            <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-4">Core Concept</h3>
                            <p className="text-lg text-foreground font-bold leading-relaxed relative z-10">
                                {idea.description}
                            </p>
                        </div>

                        <ValueProposition value={idea.valueProposition} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <NameSuggestions
                                names={nameSuggestions}
                                selectedName={selectedName}
                                onSelect={onNameSelect}
                            />
                            {canGenerateLogo && idea.status === 'pending' && (
                                <div className="space-y-3">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        Visual Identity
                                    </h3>
                                    {showLogoGenerator ? (
                                        <LogoGenerator
                                            ideaId={idea.id}
                                            ideaTitle={selectedName || idea.title}
                                            onClose={() => setShowLogoGenerator(false)}
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setShowLogoGenerator(true)}
                                            className="w-full aspect-[16/9] rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden flex flex-col items-center justify-center gap-3 bg-muted/10"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center group-hover:scale-110 transition-transform bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-bold text-muted-foreground/60 group-hover:text-foreground transition-colors">{t('ideas.logo.generate')}</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            case 'market':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="bg-muted/30 border border-border/50 rounded-2xl p-6">
                            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-4">Category Analysis</h3>
                            <p className="text-sm text-foreground/70 leading-relaxed font-sans">
                                {idea.marketResearch?.categoryAnalysis || 'Analysis pending deep dive...'}
                            </p>
                        </div>
                        <MarketTrends trends={marketTrends} />
                    </div>
                )
            case 'strategy':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                        <CompetitiveAdvantages advantages={competitiveAdvantages} />
                        <IdeaCompetitorsSection competitors={ideaCompetitors} />
                    </div>
                )
            case 'technology':
                return (
                    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                        <TechStackSection techStack={idea.techStack} />
                    </div>
                )
            case 'roadmap':
                return (
                    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                        <RoadmapSection roadmap={idea.roadmap} />
                    </div>
                )
            case 'users':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
                        <PersonasSection personas={idea.personas} journey={idea.userJourney} />
                    </div>
                )
            case 'business':
                return (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="xl:col-span-2">
                            <BusinessCaseSection
                                swot={idea.swot}
                                businessModel={idea.businessModel}
                                marketingPlan={idea.marketingPlan}
                            />
                        </div>
                        <div className="xl:col-span-1">
                            <div className="sticky top-0">
                                <ResearchChat ideaId={idea.id} />
                            </div>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className="p-8 overflow-y-auto max-h-full flex-1 custom-scrollbar">
            {renderContent()}
        </div>
    )
}
