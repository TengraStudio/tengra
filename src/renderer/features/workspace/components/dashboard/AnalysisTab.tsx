/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
