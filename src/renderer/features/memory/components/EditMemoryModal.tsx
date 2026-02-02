import { MemoryCategory } from '@shared/types/advanced-memory';
import { Edit3 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { CATEGORY_CONFIG } from './constants';

interface EditMemoryModalProps {
    content: string;
    category: MemoryCategory;
    tags: string;
    importance: number;
    onContentChange: (content: string) => void;
    onCategoryChange: (category: MemoryCategory) => void;
    onTagsChange: (tags: string) => void;
    onImportanceChange: (importance: number) => void;
    onSave: () => void;
    onCancel: () => void;
}

export const EditMemoryModal: React.FC<EditMemoryModalProps> = ({
    content,
    category,
    tags,
    importance,
    onContentChange,
    onCategoryChange,
    onTagsChange,
    onImportanceChange,
    onSave,
    onCancel
}) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                Edit Memory
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Content</label>
                    <textarea
                        value={content}
                        onChange={(e) => onContentChange(e.target.value)}
                        className="w-full h-24 mt-1 bg-muted/50 border border-white/5 rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none transition-colors"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Category</label>
                        <Select value={category} onValueChange={(v) => onCategoryChange(v as MemoryCategory)}>
                            <SelectTrigger className="mt-1 bg-muted/50 border-white/5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-2">
                                            <config.icon className="w-4 h-4" />
                                            {config.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                            Importance ({Math.round(importance * 100)}%)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={importance}
                            onChange={(e) => onImportanceChange(parseFloat(e.target.value))}
                            className="w-full mt-3"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Tags (comma-separated)</label>
                    <Input
                        value={tags}
                        onChange={(e) => onTagsChange(e.target.value)}
                        placeholder="tag1, tag2, tag3"
                        className="mt-1 bg-muted/50 border-white/5"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button onClick={onSave} disabled={!content.trim()}>Save Changes</Button>
            </div>
        </Card>
    </div>
);
