import { AdvancedSemanticFragment,MemoryCategory } from '@shared/types/advanced-memory';
import { Edit3, Plus } from 'lucide-react';
import React, { useState } from 'react';

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

import { CATEGORY_CONFIG } from './MemorySubComponents';

interface EditMemoryModalProps {
    memory: AdvancedSemanticFragment;
    onClose: () => void;
    onSave: (data: { content: string; category: MemoryCategory; tags: string[]; importance: number }) => Promise<void>;
}

export const EditMemoryModal = ({ memory, onClose, onSave }: EditMemoryModalProps) => {
    const [content, setContent] = useState(memory.content);
    const [category, setCategory] = useState<MemoryCategory>(memory.category);
    const [tags, setTags] = useState(memory.tags.join(', '));
    const [importance, setImportance] = useState(memory.importance);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-primary" />
                    Edit Memory
                </h2>
                <div className="space-y-4">
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-24 bg-muted/50 border rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
                            <SelectTrigger className="mt-1 bg-muted/50 border-white/5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <input type="range" min="0" max="1" step="0.05" value={importance} onChange={(e) => setImportance(parseFloat(e.target.value))} className="w-full mt-3" />
                    </div>
                    <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" className="mt-1 bg-muted/50 border-white/5" />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => void onSave({ content, category, tags: tags.split(',').map(t => t.trim()).filter(Boolean), importance })}>Save Changes</Button>
                </div>
            </Card>
        </div>
    );
};

interface AddMemoryModalProps {
    onClose: () => void;
    onAdd: (data: { content: string; category: MemoryCategory; tags: string[] }) => Promise<void>;
}

export const AddMemoryModal = ({ onClose, onAdd }: AddMemoryModalProps) => {
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<MemoryCategory>('fact');
    const [tags, setTags] = useState('');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg p-6 bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Add Memory
                </h2>
                <div className="space-y-4">
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Enter what you want to remember..." className="w-full h-24 bg-muted/50 border rounded-lg p-3 text-sm focus:border-primary/50 outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
                            <SelectTrigger className="mt-1 bg-muted/50 border-white/5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" className="mt-1 bg-muted/50 border-white/5" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => void onAdd({ content, category, tags: tags.split(',').map(t => t.trim()).filter(Boolean) })}>Add Memory</Button>
                </div>
            </Card>
        </div>
    );
};
