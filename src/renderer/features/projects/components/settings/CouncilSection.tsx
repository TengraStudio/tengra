import { Bot, Save, Shield } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { AgentDefinition } from '@/types';

import { SettingsSectionProps } from './types';

interface CouncilSectionProps extends SettingsSectionProps {
    availableAgents: AgentDefinition[]
    toggleMember: (id: string) => void
}

export const CouncilSection: React.FC<CouncilSectionProps> = ({
    formData,
    setFormData,
    availableAgents,
    toggleMember,
    t
}) => (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    {t('projects.councilAI') || 'Council AI Configuration'}
                </h3>
                <p className="text-xs text-muted-foreground">{t('projects.councilAIDesc') || 'Configure how agents collaborate on this project.'}</p>
            </div>
            <div className="flex items-center gap-3 bg-white/5 p-1 rounded-full border border-white/10 px-3 py-1">
                <span className="text-xs font-medium text-muted-foreground">{t('projects.councilEnabledLabel')}</span>
                <button
                    onClick={() => setFormData(prev => ({ ...prev, councilEnabled: !prev.councilEnabled }))}
                    className={cn(
                        "w-10 h-5 rounded-full transition-all relative",
                        formData.councilEnabled ? "bg-primary" : "bg-white/20"
                    )}
                >
                    <div className={cn(
                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                        formData.councilEnabled ? "right-1" : "left-1"
                    )} />
                </button>
            </div>
        </div>

        <div className={cn("space-y-6 transition-opacity", !formData.councilEnabled && "opacity-50 pointer-events-none")}>
            <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('projects.consensusThreshold') || 'Consensus Threshold'} ({Math.round(formData.consensusThreshold * 100)}%)
                </label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.consensusThreshold}
                    onChange={e => setFormData(prev => ({ ...prev, consensusThreshold: parseFloat(e.target.value) }))}
                    className="w-full accent-primary bg-muted/30 rounded-lg h-1.5 appearance-none cursor-pointer"
                />
                <p className="text-xxs text-muted-foreground italic">
                    {t('projects.councilThresholdHint')}
                </p>
            </div>

            <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">{t('projects.selectedAgents') || 'Selected Agents'}</label>
                <div className="grid gap-2">
                    {availableAgents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => toggleMember(agent.id)}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-lg border transition-all group",
                                formData.councilMembers.includes(agent.id)
                                    ? "bg-primary/10 border-primary/40 text-primary"
                                    : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/30"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase transition-colors",
                                    formData.councilMembers.includes(agent.id) ? "bg-primary text-primary-foreground" : "bg-muted/30"
                                )}>
                                    {agent.name.charAt(0)}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{agent.name}</div>
                                    <div className="text-xxs opacity-60">{agent.description ?? t('projects.generalAI')}</div>
                                </div>
                            </div>
                            <div className={cn(
                                "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                formData.councilMembers.includes(agent.id) ? "bg-primary border-primary text-primary-foreground" : "border-border/50"
                            )}>
                                {formData.councilMembers.includes(agent.id) && <Save className="w-3 h-3" />}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </section>
);
