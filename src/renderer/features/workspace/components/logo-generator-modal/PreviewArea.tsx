import { Check, ImageIcon, Loader2, Sparkles } from 'lucide-react';
import React, { useCallback } from 'react';

interface PreviewAreaProps {
    isGenerating: boolean;
    generatedLogo: string | null;
    onGenerate: () => Promise<void>;
    onManualUpload: () => Promise<void>;
    onApply: () => Promise<void>;
    translateKey: (key: string) => string;
    prompt: string;
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({
    isGenerating,
    generatedLogo,
    onGenerate,
    onManualUpload,
    onApply,
    translateKey,
    prompt,
}) => {
    const handleGenerateClick = useCallback(() => {
        void onGenerate();
    }, [onGenerate]);

    const handleManualUploadClick = useCallback(() => {
        void onManualUpload();
    }, [onManualUpload]);

    const handleApplyClick = useCallback(() => {
        void onApply();
    }, [onApply]);

    return (
        <div className="flex flex-col gap-4">
            <div className="aspect-square w-full rounded-2xl bg-muted/30 border-2 border-dashed border-border/50 flex items-center justify-center relative overflow-hidden group shadow-2xl">
                {isGenerating ? (
                    <div className="text-center space-y-3 p-8">
                        <Sparkles className="w-12 h-12 mx-auto animate-bounce text-primary" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-foreground uppercase tracking-widest">
                                {translateKey('workspaces.generating')}
                            </p>
                            <p className="text-xxs text-muted-foreground italic">
                                {translateKey('workspaces.logoGeneratingSubtitle')}
                            </p>
                        </div>
                    </div>
                ) : generatedLogo ? (
                    <img
                        src={`safe-file://${generatedLogo}`}
                        alt={translateKey('workspaces.generatedAlt')}
                        className="w-full h-full object-cover animate-in zoom-in-95 duration-500"
                    />
                ) : (
                    <div className="text-center p-8 opacity-40">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-primary/40" />
                        <p className="text-xs uppercase font-bold tracking-widest mb-4">
                            {translateKey('workspaces.preview')}
                        </p>
                        <button
                            onClick={handleManualUploadClick}
                            className="px-4 py-2 bg-muted/20 hover:bg-muted/30 border border-border/50 rounded-lg text-xxs font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                        >
                            {translateKey('workspaces.uploadOriginal')}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleGenerateClick}
                    disabled={isGenerating || !prompt}
                    className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-black text-sm hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-primary/20 uppercase tracking-widest"
                >
                    <Sparkles className="w-4 h-4" />
                    {translateKey('workspaces.generate')}
                </button>

                {generatedLogo ? (
                    <button
                        onClick={handleApplyClick}
                        disabled={isGenerating}
                        className="flex items-center justify-center px-6 bg-success text-foreground rounded-xl hover:bg-success transition-all active:scale-95 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                        title={translateKey('workspace.applyLogo')}
                    >
                        {isGenerating ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <Check className="w-6 h-6" />
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handleManualUploadClick}
                        className="flex items-center justify-center px-6 bg-muted/20 text-muted-foreground hover:text-foreground border border-border/50 rounded-xl hover:bg-muted/30 transition-all active:scale-95"
                        title={translateKey('workspace.uploadImage')}
                    >
                        <ImageIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    );
};
