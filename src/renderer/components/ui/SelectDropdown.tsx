/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    autoUpdate,
    flip,
    FloatingPortal,
    offset,
    shift,
    useFloating,
} from '@floating-ui/react';
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import React, { useState } from 'react';

import { useTranslation } from '@/i18n';
import { AnimatePresence,motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';


interface SelectOption {
    value: string
    label: string
}

interface SelectDropdownProps {
    value: string
    options: SelectOption[]
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

interface OptionButtonProps {
    option: SelectOption
    isSelected: boolean
    onSelect: () => void
}

const OptionButton: React.FC<OptionButtonProps> = ({ option, isSelected, onSelect }) => (
    <button
        type="button"
        onClick={onSelect}
        className={cn(
            "w-full flex items-center justify-between py-2 px-4 text-sm font-medium text-muted-foreground bg-transparent border-none text-left cursor-pointer transition-all duration-150 ease-in-out hover:bg-muted/60 hover:text-foreground",
            isSelected && "bg-primary/15 text-primary"
        )}
    >
        <span className="truncate overflow-hidden whitespace-nowrap text-ellipsis">{option.label}</span>
        {isSelected && <IconCheck className="w-3.5 h-3.5 shrink-0" />}
    </button>
);

interface TriggerButtonProps {
    label: string
    isOpen: boolean
    onToggle: (e: React.MouseEvent) => void
}

const TriggerButton: React.FC<TriggerButtonProps> = ({ label, isOpen, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        className={cn(
            "group w-full flex items-center justify-between bg-muted/20 border border-border/50 rounded-xl py-2.5 px-4 text-sm font-medium text-primary/90 shadow-sm cursor-pointer transition-all duration-150 ease-in-out hover:bg-muted/30 hover:border-border focus:outline-none focus:shadow-outline-primary-1",
            isOpen && "bg-primary/5 border-primary/40"
        )}
    >
        <span className="truncate overflow-hidden whitespace-nowrap text-ellipsis">{label}</span>
        <IconChevronDown className={cn("w-4 h-4 text-muted-foreground ml-2 shrink-0 transition-transform duration-150 group-hover:text-primary/70", isOpen && "rotate-180")} />
    </button>
);

interface FloatingMenuProps {
    options: SelectOption[]
    value: string
    isUp: boolean
    width: number
    strategy: 'absolute' | 'fixed'
    x: number | null
    y: number | null
    setFloatingNode: (node: HTMLElement | null) => void
    onSelect: (value: string) => void
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({
    options, value, isUp, width, strategy, x, y, setFloatingNode, onSelect
}) => (
    <FloatingPortal>
        <motion.div
            ref={setFloatingNode}
            initial={{ opacity: 0, y: isUp ? 4 : -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isUp ? 4 : -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ position: strategy, top: y ?? 0, left: x ?? 0, zIndex: 'var(--tengra-z-10001)', width: width || 'auto' }}
            className="bg-background/95 backdrop-blur-16 border border-border/40 rounded-xl shadow-2xl overflow-hidden"
            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
        >
            <div className="max-h-72 overflow-y-auto py-1 custom-scrollbar">
                {options.map(opt => (
                    <OptionButton key={opt.value} option={opt} isSelected={opt.value === value} onSelect={() => onSelect(opt.value)} />
                ))}
            </div>
        </motion.div>
    </FloatingPortal>
);

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
    value,
    options,
    onChange,
    placeholder,
    className
}) => {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t('common.selectEllipsis');
    const [isOpen, setIsOpen] = useState(false);
    const [width, setWidth] = useState<number>(0);

    const { x, y, strategy, refs, placement } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [offset(4), flip(), shift({ padding: 8 })],
        whileElementsMounted: autoUpdate,
    });

    const setReferenceNode = React.useCallback((node: HTMLElement | null) => { refs.setReference(node); }, [refs]);
    const setFloatingNode = React.useCallback((node: HTMLElement | null) => { refs.setFloating(node); }, [refs]);

    const selectedLabel = options.find(opt => opt.value === value)?.label ?? resolvedPlaceholder;
    const isUp = placement.startsWith('top');

    const handleSelect = (optValue: string) => {
        onChange(optValue);
        setIsOpen(false);
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    React.useEffect(() => {
        const reference = refs.domReference.current;
        if (isOpen && reference) {
            setWidth((reference as HTMLElement).offsetWidth);
        }
    }, [isOpen, refs.domReference]);

    return (
        <div ref={setReferenceNode} className={cn("relative w-full", className)}>
            <TriggerButton label={selectedLabel} isOpen={isOpen} onToggle={handleToggle} />
            <AnimatePresence>
                {isOpen && (
                    <FloatingMenu
                        options={options}
                        value={value}
                        isUp={isUp}
                        width={width}
                        strategy={strategy}
                        x={x}
                        y={y}
                        setFloatingNode={setFloatingNode}
                        onSelect={handleSelect}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

