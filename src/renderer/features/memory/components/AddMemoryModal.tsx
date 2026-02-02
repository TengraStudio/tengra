import { MemoryCategory } from '@shared/types/advanced-memory';
import { Plus } from 'lucide-react';
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

interface AddMemoryModalProps {
    content: string;
    category: MemoryCategory;
    tags: string;
    onContentChange: (content: string) => void;
    onCategoryChange: (category: MemoryCategory) => void;
    onTagsChange: (tags: string) => void;
    onAdd: () => void;
    onCancel: () => void;
}

export const AddMemoryModal: React.FC<AddMemoryModalProps> = ({
    content,
    category,
    tags,
    onContentChange,
    onCategoryChange,
    onTagsChange,
    onAdd,
    onCancel
}) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Add Memory
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Content</label>
                    <textarea
                        value={content}
                        onChange={(e) => onContentChange(e.target.value)}
                        placeholder="Enter what you want to remember..."
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
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Tags (comma-separated)</label>
                        <Input
                            value={tags}
                            onChange={(e) => onTagsChange(e.target.value)}
                            placeholder="tag1, tag2"
                            className="mt-1 bg-muted/50 border-white/5"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button onClick={onAdd} disabled={!content.trim()}>Add Memory</Button>
            </div>
        </Card>
    </div>
);
