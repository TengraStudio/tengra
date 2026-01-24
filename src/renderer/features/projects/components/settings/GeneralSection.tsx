import React from 'react'
import { Info } from 'lucide-react'
import { Project } from '@/types'
import { SettingsSectionProps } from './types'

export const GeneralSection: React.FC<SettingsSectionProps> = ({ formData, setFormData, t }) => (
    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                {t('projects.basicInfo') || 'Basic Information'}
            </h3>
            <p className="text-xs text-muted-foreground">{t('projects.basicInfoDesc') || 'Update your project identity and status.'}</p>
        </div>

        <div className="space-y-4">
            <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">{t('projects.projectTitle') || 'Project Title'}</label>
                <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-muted/20 border border-border/50 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
            </div>
            <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">{t('projects.description') || 'Description'}</label>
                <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-muted/20 border border-border/50 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                />
            </div>
            <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">{t('projects.status') || 'Status'}</label>
                <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as Project['status'] }))}
                    className="w-full bg-muted/20 border border-border/50 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-sans"
                >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="draft">Draft</option>
                </select>
            </div>
        </div>
    </section>
)
