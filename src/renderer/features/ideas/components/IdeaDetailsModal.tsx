/**
 * Modal for viewing full idea details with approval workflow
 */
import { ProjectIdea } from '@shared/types/ideas'
import { Briefcase, Code2, Globe, Map, Sparkles, Target, Users, X } from 'lucide-react'
import React, { useState } from 'react'

import { cn } from '@/lib/utils'

import { getCategoryMeta } from '../utils/categories'

import { ApprovalFooter } from './ApprovalFooter'
import { IdeaDetailsContent } from './IdeaDetailsContent'

interface IdeaDetailsModalProps {
    idea: ProjectIdea
    onClose: () => void
    onApprove: (projectPath: string, selectedName?: string) => Promise<void>
    onReject: () => Promise<void>
    isApproving: boolean
    isRejecting: boolean
    canGenerateLogo: boolean
}

export const IdeaDetailsModal: React.FC<IdeaDetailsModalProps> = ({
    idea,
    onClose,
    onApprove,
    onReject,
    isApproving,
    isRejecting,
    canGenerateLogo
}) => {
    const [projectPath, setProjectPath] = useState('')
    const [selectedName, setSelectedName] = useState(idea.title)
    const [activeTab, setActiveTab] = useState<'overview' | 'market' | 'strategy' | 'technology' | 'roadmap' | 'users' | 'business'>('overview')
    const [showLogoGenerator, setShowLogoGenerator] = useState(false)
    const meta = getCategoryMeta(idea.category)
    const Icon = meta.icon

    const handleSelectFolder = async () => {
        try {
            const result = await window.electron.selectDirectory()
            if (result.success && result.path) {
                setProjectPath(result.path)
            }
        } catch (err) {
            // Log error for debugging - user sees no folder selected
            if (err instanceof Error) {
                console.warn('Folder selection failed:', err.message)
            }
        }
    }

    const handleApprove = async () => {
        if (!projectPath || !selectedName) {
            return
        }
        await onApprove(projectPath, selectedName)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col shadow-2xl shadow-purple-500/10">
                {/* Header Section */}
                <div className="flex items-center gap-4 p-6 border-b border-white/10 shrink-0 bg-gradient-to-r from-white/5 to-transparent">
                    <div
                        className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg',
                            meta.bgColor,
                            meta.color
                        )}
                    >
                        <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={selectedName}
                                onChange={(e) => setSelectedName(e.target.value)}
                                className="bg-transparent border-none p-0 text-2xl font-black text-white placeholder:text-white/10 focus:ring-0 outline-none w-full max-w-md"
                                placeholder="Project Name"
                            />
                            {selectedName !== idea.title && (
                                <button
                                    onClick={() => setSelectedName(idea.title)}
                                    className="text-[10px] text-purple-400 hover:text-purple-300 uppercase tracking-widest font-bold"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                        <p className="text-white/40 text-xs font-medium uppercase tracking-[0.15em] mt-1 flex items-center gap-2">
                            {idea.category} • {new Date(idea.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Side Navigation */}
                    <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-1 bg-white/[0.02]">
                        {[
                            { id: 'overview', label: 'Overview', icon: Sparkles },
                            { id: 'market', label: 'Market Analysis', icon: Globe },
                            { id: 'strategy', label: 'Strategy', icon: Target },
                            { id: 'users', label: 'User Profiles', icon: Users },
                            { id: 'business', label: 'Business Case', icon: Briefcase },
                            { id: 'technology', label: 'Technology', icon: Code2 },
                            { id: 'roadmap', label: 'Roadmap', icon: Map }
                        ].map((tab) => {
                            const TabIcon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group',
                                        isActive
                                            ? 'bg-purple-500/10 text-purple-400'
                                            : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                                    )}
                                >
                                    <TabIcon className={cn(
                                        'w-4 h-4 transition-colors',
                                        isActive ? 'text-purple-400' : 'text-white/20 group-hover:text-white/40'
                                    )} />
                                    {tab.label}
                                    {isActive && (
                                        <div className="ml-auto w-1 h-4 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                    )}
                                </button>
                            )
                        })}

                        <div className="mt-auto pt-4 border-t border-white/5">
                            <div className="px-4 py-2 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
                                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest leading-relaxed">
                                    Status
                                </p>
                                <p className="text-white font-bold text-sm mt-0.5">
                                    {idea.status === 'pending' ? 'Ready for Pilot' : 'Project Created'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-gradient-to-b from-white/[0.01] to-transparent">
                        <IdeaDetailsContent
                            idea={idea}
                            activeTab={activeTab}
                            selectedName={selectedName}
                            onNameSelect={setSelectedName}
                            canGenerateLogo={canGenerateLogo}
                            showLogoGenerator={showLogoGenerator}
                            setShowLogoGenerator={setShowLogoGenerator}
                        />
                    </div>
                </div>

                {idea.status === 'pending' && (
                    <ApprovalFooter
                        projectPath={projectPath}
                        setProjectPath={setProjectPath}
                        handleSelectFolder={handleSelectFolder}
                        onReject={onReject}
                        handleApprove={handleApprove}
                        isApproving={isApproving}
                        isRejecting={isRejecting}
                    />
                )}
            </div>
        </div>
    )
}
