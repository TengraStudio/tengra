import { IconRobot, IconShield, IconUserCheck } from '@tabler/icons-react';
import React from 'react';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AgentDefinition } from '@/types';

import { SettingsSectionProps } from './types';

interface CouncilSectionProps extends SettingsSectionProps {
    availableAgents: AgentDefinition[];
    toggleMember: (id: string) => void;
}

export const CouncilSection: React.FC<CouncilSectionProps> = ({
    formData,
    setFormData,
    availableAgents,
    toggleMember,
    t,
}) => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Council Activation */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/5 text-primary border border-primary/10">
                        <IconRobot className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground ">
                            {t('frontend.workspaces.councilAI')}
                        </h2>
                        <p className="text-sm text-muted-foreground/60">
                            {t('frontend.workspaces.councilAIDesc')}
                        </p>
                    </div>
                </div>
                <Switch
                    checked={formData.councilEnabled}
                    onCheckedChange={(checked: boolean) =>
                        setFormData(prev => ({ ...prev, councilEnabled: checked }))
                    }
                />
            </div>

            <div className={cn(
                "space-y-8 pl-11 transition-all duration-300",
                !formData.councilEnabled && "opacity-40 pointer-events-none grayscale"
            )}>
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-muted-foreground/50 uppercase  flex items-center gap-2">
                            <IconShield className="w-3.5 h-3.5" />
                            {t('frontend.workspaces.consensusThreshold')}
                        </Label>
                        <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {Math.round(formData.consensusThreshold * 100)}%
                        </span>
                    </div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.1}
                        value={[formData.consensusThreshold]}
                        onValueChange={(values: number[]) =>
                            setFormData(prev => ({ ...prev, consensusThreshold: values[0] }))
                        }
                        className="w-full"
                    />
                    <p className="text-sm text-muted-foreground/40 italic">
                        {t('frontend.workspaces.councilThresholdHint')}
                    </p>
                </div>
            </div>
        </div>

        <div className="h-px bg-border/5 ml-11" />

        {/* Member Selection */}
        <div className={cn(
            "space-y-6 transition-all duration-300",
            !formData.councilEnabled && "opacity-40 pointer-events-none grayscale"
        )}>
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/5 text-success border border-success/10">
                    <IconUserCheck className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground ">
                        {t('frontend.workspaces.selectedAgents')}
                    </h2>
                    <p className="text-sm text-muted-foreground/60">
                        {t('frontend.workspaces.selectedAgentsDesc')}
                    </p>
                </div>
            </div>

            <div className="grid gap-3 pl-11">
                {availableAgents.map(agent => (
                    <button
                        key={agent.id}
                        onClick={() => toggleMember(agent.id)}
                        className={cn(
                            'flex items-center justify-between p-3.5 rounded-xl border transition-all group',
                            formData.councilMembers.includes(agent.id)
                                ? 'bg-primary/5 border-primary/20 text-primary'
                                : 'bg-muted/5 border-border/5 text-muted-foreground hover:bg-muted/10'
                        )}
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors shadow-inner',
                                formData.councilMembers.includes(agent.id)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/20 text-muted-foreground/40'
                            )}>
                                {agent.name.charAt(0)}
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                    {agent.name}
                                </div>
                                <div className="text-sm text-muted-foreground/60 line-clamp-1">
                                    {agent.description ?? t('frontend.workspaces.generalAI')}
                                </div>
                            </div>
                        </div>
                        <div className={cn(
                            'w-5 h-5 rounded-md border flex items-center justify-center transition-all',
                            formData.councilMembers.includes(agent.id)
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-border/10 bg-muted/10'
                        )}>
                            {formData.councilMembers.includes(agent.id) && (
                                <IconUserCheck className="w-3 h-3" />
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </div>
);
