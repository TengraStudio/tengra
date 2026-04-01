import {
    autoUpdate,
    flip,
    FloatingPortal,
    offset,
    shift,
    useFloating,
} from '@floating-ui/react';
import { Check,ChevronDown } from 'lucide-react';
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
            "w-full px-4 py-2 text-left text-sm font-medium transition-all flex items-center justify-between group/item",
            isSelected
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
    >
        <span className="truncate">{option.label}</span>
        {isSelected && <Check className="w-3.5 h-3.5" />}
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
            "w-full flex items-center justify-between bg-muted/20 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-1 focus:ring-primary/50 group/select shadow-sm hover:border-border",
            isOpen ? "border-primary/40 bg-primary/5" : "text-primary/90 hover:bg-muted/30"
        )}
    >
        <span className="truncate">{label}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2 group-hover/select:text-primary/70", isOpen && "rotate-180")} />
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
            style={{ position: strategy, top: y ?? 0, left: x ?? 0, zIndex: 10000, width: width || 'auto' }}
            className="bg-background/95 backdrop-blur-xl border border-border/40 rounded-xl shadow-2xl overflow-hidden"
            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
        >
            <div className="max-h-72 overflow-y-auto custom-scrollbar py-1">
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
