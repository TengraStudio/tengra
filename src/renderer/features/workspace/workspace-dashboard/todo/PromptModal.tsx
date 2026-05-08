/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter,
    DialogHeader, 
    DialogTitle} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    placeholder,
    defaultValue = ''
}) => {
    const [value, setValue] = useState(defaultValue);

    const handleConfirm = () => {
        onConfirm(value);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md border-border/40 bg-background/80 backdrop-blur-3xl rounded-3xl p-8">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
                    <DialogDescription className="text-muted-foreground/60">{message}</DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Label className="sr-only">Input</Label>
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        className="bg-muted/20 border-transparent focus:bg-background rounded-xl h-10"
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                        autoFocus
                    />
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        disabled={!value.trim()}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 rounded-xl shadow-lg shadow-primary/20"
                    >
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
