import React from 'react';

import { Language } from '@/i18n';
import { ProjectAnalysis, ProjectStats } from '@/types';

import { ProjectAnalysisTodos,ProjectLanguageDistribution, ProjectTechStack } from './ProjectAnalysisDetails';

interface AnalysisTabProps {
    analysis: ProjectAnalysis;
    stats: ProjectStats | null;
    t: (key: string) => string;
    language: Language;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
    analysis,
    stats,
    t
}) => {
    return (
        <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
            <ProjectTechStack frameworks={analysis.frameworks} t={t} />
            <ProjectLanguageDistribution
                languages={analysis.languages}
                stats={stats}
                t={t}
            />
            <ProjectAnalysisTodos todos={analysis.todos} t={t} />
        </div>
    );
};
