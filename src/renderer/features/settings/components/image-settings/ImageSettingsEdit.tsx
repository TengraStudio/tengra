import { Play, Wand2 } from 'lucide-react';
import React from 'react';

interface ImageSettingsEditProps {
    batchPrompts: string;
    setBatchPrompts: (prompts: string) => void;
    handleRunBatch: () => Promise<void>;
    editSource: string;
    setEditSource: (source: string) => void;
    editPrompt: string;
    setEditPrompt: (prompt: string) => void;
    editMode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
    setEditMode: (mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer') => void;
    handleRunEdit: () => Promise<void>;
    t: (key: string) => string | undefined;
}

export const ImageSettingsEdit: React.FC<ImageSettingsEditProps> = ({
    batchPrompts,
    setBatchPrompts,
    handleRunBatch,
    editSource,
    setEditSource,
    editPrompt,
    setEditPrompt,
    editMode,
    setEditMode,
    handleRunEdit,
    t,
}) => {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h5 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Wand2 className="h-3.5 w-3.5" />
                {t('settings.images.editTitle')}
            </h5>

            <textarea
                value={batchPrompts}
                onChange={event => setBatchPrompts(event.target.value)}
                placeholder={t('settings.images.batchPrompts') || 'Batch Prompts (one per line)'}
                className="min-h-[78px] w-full rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
            />
            <button
                onClick={() => { void handleRunBatch(); }}
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
            >
                <Play className="h-3.5 w-3.5" />
                {t('settings.images.batchRun')}
            </button>

            <div className="mt-3 grid grid-cols-1 gap-2">
                <input
                    value={editSource}
                    onChange={event => setEditSource(event.target.value)}
                    placeholder={t('settings.images.editSource') || 'Source Image Path'}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                />
                <input
                    value={editPrompt}
                    onChange={event => setEditPrompt(event.target.value)}
                    placeholder={t('settings.images.editPrompt') || 'Edit Prompt'}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                />
                <select
                    value={editMode}
                    onChange={event => setEditMode(event.target.value as 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer')}
                    className="rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs"
                >
                    <option value="img2img">img2img</option>
                    <option value="inpaint">inpaint</option>
                    <option value="outpaint">outpaint</option>
                    <option value="style-transfer">style-transfer</option>
                </select>
            </div>
            <button
                onClick={() => { void handleRunEdit(); }}
                className="mt-2 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
            >
                {t('settings.images.editRun')}
            </button>
        </div>
    );
};
