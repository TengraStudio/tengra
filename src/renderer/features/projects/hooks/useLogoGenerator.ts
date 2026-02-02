import { useState } from 'react';

import { Project } from '@/types';

export function useLogoGenerator(project: Project, onApply: (logoPath: string) => void, onClose: () => void) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('Minimalist');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [palette, setPalette] = useState<string[]>([]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const result = await window.electron.project.analyzeIdentity(project.path);
            setSuggestions(result.suggestedPrompts);
            setPalette(result.colors);
            if (result.suggestedPrompts.length > 0 && !prompt) {
                setPrompt(result.suggestedPrompts[0]);
            }
        } catch (error) {
            console.error('Analysis failed', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt) {return;}
        setIsGenerating(true);
        try {
            const colorContext = palette.length > 0 ? ` Primary colors: ${palette.slice(0, 3).join(', ')}.` : '';
            const finalPrompt = `${prompt}${colorContext}`;
            const logoPath = await window.electron.project.generateLogo(project.path, finalPrompt, style);
            setGeneratedLogo(logoPath);
        } catch (error) {
            console.error('Generation failed', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImprovePrompt = async () => {
        if (!prompt || isAnalyzing) {return;}
        setIsAnalyzing(true);
        try {
            const improved = await window.electron.project.improveLogoPrompt(prompt);
            setPrompt(improved);
        } catch (error) {
            console.error('Improvement failed', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleManualUpload = async () => {
        try {
            const uploadedPath = await window.electron.project.uploadLogo(project.path);
            if (uploadedPath) {
                onApply(uploadedPath);
                onClose();
            }
        } catch (error) {
            console.error('Manual upload failed', error);
        }
    };

    const handleApply = async () => {
        if (!generatedLogo) {return;}
        setIsGenerating(true);
        try {
            const finalPath = await window.electron.project.applyLogo(project.path, generatedLogo);
            onApply(finalPath);
            onClose();
        } catch (error) {
            console.error('Apply failed', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const selectIdea = (idea: string) => {
        setPrompt(idea);
    };

    return {
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
    };
}
