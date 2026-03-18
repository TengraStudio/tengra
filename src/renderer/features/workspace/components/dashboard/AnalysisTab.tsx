import React from 'react';

import { Language } from '@/i18n';
import { WorkspaceAnalysis, WorkspaceStats } from '@/types';

import {
    WorkspaceAnalysisTodos,
    WorkspaceLanguageDistribution,
    WorkspaceTechStack,
} from './WorkspaceAnalysisDetails';

interface AnalysisTabProps {
    analysis: WorkspaceAnalysis;
    stats: WorkspaceStats | null;
    t: (key: string) => string;
    language: Language;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
    analysis,
    t
}) => {
    return (
        <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
            <WorkspaceTechStack frameworks={analysis.frameworks} t={t} />
            <WorkspaceLanguageDistribution
                languages={analysis.languages}
                t={t}
            />
            <WorkspaceAnalysisTodos todos={analysis.todos} t={t} />
        </div>
    );
};
