/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState } from 'react';

import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface LogoGenerationOptions {
    prompt: string;
    style: string;
    model: string;
    count: number;
}

interface IdentityAnalysisResult {
    suggestedPrompts: string[];
    colors: string[];
}

export function useLogoGenerator(
    workspace: Workspace,
    onApply: (logoPath: string) => void,
    onClose: () => void
) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('Minimalist');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [palette, setPalette] = useState<string[]>([]);
    const [model, setModel] = useState('openai/dall-e-3');
    const [count, setCount] = useState(1);
    const [generatedLogos, setGeneratedLogos] = useState<string[]>([]);

    const handleAnalyze = async (): Promise<void> => {
        setIsAnalyzing(true);
        try {
            const result = await window.electron.workspace.analyzeIdentity(workspace.path) as IdentityAnalysisResult;
            setSuggestions(result.suggestedPrompts);
            setPalette(result.colors);
            if (result.suggestedPrompts.length > 0 && !prompt) {
                setPrompt(result.suggestedPrompts[0]);
            }
        } catch (error) {
            appLogger.error('LogoGenerator', 'Analysis failed', error as Error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerate = async (): Promise<void> => {
        if (!prompt) {
            return;
        }
        setIsGenerating(true);
        try {
            const colorContext =
                palette.length > 0 ? ` Primary colors: ${palette.slice(0, 3).join(', ')}.` : '';
            const finalPrompt = `${prompt}${colorContext}`;
            const options: LogoGenerationOptions = {
                prompt: finalPrompt,
                style,
                model,
                count,
            };
            const logoPaths = await window.electron.workspace.generateLogo(workspace.path, options);
            setGeneratedLogos(prev => [...prev, ...logoPaths]);
        } catch (error) {
            appLogger.error('LogoGenerator', 'Generation failed', error as Error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApply = async (logoPath: string): Promise<void> => {
        setIsGenerating(true);
        try {
            const finalPath = await window.electron.workspace.applyLogo(workspace.path, logoPath);
            onApply(finalPath);
            onClose();
        } catch (error) {
            appLogger.error('LogoGenerator', 'Apply failed', error as Error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleManualUpload = async (): Promise<void> => {
        try {
            const uploadedPath = await window.electron.workspace.uploadLogo(workspace.path);
            if (uploadedPath) {
                onApply(uploadedPath);
                onClose();
            }
        } catch (error) {
            appLogger.error('LogoGenerator', 'Manual upload failed', error as Error);
        }
    };

    return {
        prompt,
        setPrompt,
        style,
        setStyle,
        model,
        setModel,
        count,
        setCount,
        isGenerating,
        isAnalyzing,
        generatedLogos,
        suggestions,
        palette,
        handleAnalyze,
        handleGenerate,
        handleManualUpload,
        handleApply,
    };
}

