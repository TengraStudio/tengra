import React from 'react';

import { Modal } from '@/components/ui/modal';
import { Language, useTranslation } from '@/i18n';
import { Project } from '@/types';

import { useLogoGenerator } from '../hooks/useLogoGenerator';

import { PaletteSection } from './LogoGeneratorModal/PaletteSection';
import { PreviewArea } from './LogoGeneratorModal/PreviewArea';
import { PromptSection } from './LogoGeneratorModal/PromptSection';
import { StyleSection } from './LogoGeneratorModal/StyleSection';
import { SuggestionsSection } from './LogoGeneratorModal/SuggestionsSection';

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
    const { t } = useTranslation(language);
    const {
        prompt,
        setPrompt,
        style,
        setStyle,
        isGenerating,
        isAnalyzing,
        generatedLogo,
        suggestions,
        palette,
        handleAnalyze,
        handleGenerate,
        handleImprovePrompt,
        handleManualUpload,
        handleApply,
        selectIdea
    } = useLogoGenerator(project, onApply, onClose);

    const handleColorSelect = (color: string) => {
        setPrompt(prev => prev + ` Use color ${color}.`);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('projects.aiLogoGenerator') || 'AI Logo Generator'}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                {/* Controls */}
                <div className="space-y-6">
                    <PromptSection
                        prompt={prompt}
                        setPrompt={setPrompt}
                        isAnalyzing={isAnalyzing}
                        onAnalyze={handleAnalyze}
                        onImprovePrompt={handleImprovePrompt}
                        translateKey={t}
                    />

                    <StyleSection
                        style={style}
                        setStyle={setStyle}
                        translateKey={t}
                    />

                    <SuggestionsSection
                        suggestions={suggestions}
                        onSelectIdea={selectIdea}
                        translateKey={t}
                    />

                    <PaletteSection
                        palette={palette}
                        onColorSelect={handleColorSelect}
                        translateKey={t}
                    />
                </div>

                {/* Preview */}
                <PreviewArea
                    isGenerating={isGenerating}
                    generatedLogo={generatedLogo}
                    onGenerate={handleGenerate}
                    onManualUpload={handleManualUpload}
                    onApply={handleApply}
                    prompt={prompt}
                    translateKey={t}
                />
            </div>
        </Modal>
    );
};
