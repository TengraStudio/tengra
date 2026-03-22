import { RuntimeBootstrapExecutionResult } from '@shared/types/runtime-manifest';
import { Check, Download, ExternalLink, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { getOptionalRuntimePrompts } from '@/store/runtime-bootstrap.store';

interface OnboardingFlowProps {
    isOpen: boolean;
    onClose: () => void;
    onStartTour?: () => void;
}

type RuntimePromptSettings = {
    dismissedRuntimeInstallPrompts?: string[];
    completedRuntimeInstalls?: string[];
};

type StepDefinition = {
    title: string;
    icon: string;
    color: string;
    type: 'content' | 'runtime';
};

const BASE_STEPS: StepDefinition[] = [
    { title: 'welcome', icon: '🏮', color: 'from-warning to-destructive', type: 'content' },
    { title: 'multiModel', icon: '🧠', color: 'from-info to-primary', type: 'content' },
    { title: 'workspace', icon: '🚀', color: 'from-success to-success-light', type: 'content' },
    { title: 'privacy', icon: '🛡️', color: 'from-accent to-primary', type: 'content' },
];

type PromptEntry = ReturnType<typeof getOptionalRuntimePrompts>[number];

function getComponentActionLabel(componentId: string, t: (key: string) => string): string {
    return componentId === 'sd-cpp'
        ? t('runtime.repairAction')
        : t('onboarding.runtime.installAction');
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onClose, onStartTour }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [runtimePromptSettings, setRuntimePromptSettings] = useState<RuntimePromptSettings>({});
    const [runtimeStatus, setRuntimeStatus] = useState<RuntimeBootstrapExecutionResult | null>(null);
    const [selectedRuntimeIds, setSelectedRuntimeIds] = useState<string[]>([]);
    const [installingRuntimeIds, setInstallingRuntimeIds] = useState<string[]>([]);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const { language } = useAuth();
    const { t } = useTranslation(language);

    const refreshRuntimeStatus = async (forceRefresh: boolean = false): Promise<void> => {
        const status = forceRefresh
            ? await window.electron.runtime.refreshStatus()
            : await window.electron.runtime.getStatus();
        setRuntimeStatus(status);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        void (async () => {
            try {
                await refreshRuntimeStatus(false);
                const settings = await window.electron.getSettings();
                const generalSettings = settings.general ?? {};
                const dismissedRuntimeInstallPrompts =
                    generalSettings.dismissedRuntimeInstallPrompts ?? [];
                const completedRuntimeInstalls = generalSettings.completedRuntimeInstalls ?? [];
                setRuntimePromptSettings({
                    dismissedRuntimeInstallPrompts,
                    completedRuntimeInstalls,
                });
            } finally {
                setSettingsLoaded(true);
            }
        })();
    }, [isOpen]);

    const runtimePrompts = useMemo(
        () => getOptionalRuntimePrompts(runtimeStatus, runtimePromptSettings),
        [runtimePromptSettings, runtimeStatus]
    );

    useEffect(() => {
        setSelectedRuntimeIds(prev =>
            prev.length > 0 ? prev.filter(id => runtimePrompts.some(entry => entry.componentId === id)) : runtimePrompts.map(entry => entry.componentId)
        );
    }, [runtimePrompts]);

    const steps = useMemo(() => {
        const nextSteps = [...BASE_STEPS];
        if (runtimePrompts.length > 0) {
            nextSteps.splice(3, 0, {
                title: 'runtime',
                icon: '🧰',
                color: 'from-primary to-info',
                type: 'runtime',
            });
        }
        return nextSteps;
    }, [runtimePrompts.length]);

    const completeOnboarding = async (): Promise<void> => {
        localStorage.setItem('Tengra-onboarding-complete', 'true');
        const settings = await window.electron.getSettings();
        await window.electron.saveSettings({
            ...settings,
            general: {
                ...settings.general,
                onboardingCompleted: true,
                dismissedRuntimeInstallPrompts: runtimePromptSettings.dismissedRuntimeInstallPrompts ?? [],
                completedRuntimeInstalls: runtimePromptSettings.completedRuntimeInstalls ?? [],
            },
        });
        onClose();
    };

    const persistRuntimeSettings = async (nextSettings: RuntimePromptSettings): Promise<void> => {
        const settings = await window.electron.getSettings();
        await window.electron.saveSettings({
            ...settings,
            general: {
                ...settings.general,
                dismissedRuntimeInstallPrompts: nextSettings.dismissedRuntimeInstallPrompts ?? [],
                completedRuntimeInstalls: nextSettings.completedRuntimeInstalls ?? [],
            },
        });
        setRuntimePromptSettings(nextSettings);
    };

    const handleRuntimeInstall = async (entry: PromptEntry): Promise<void> => {
        setInstallingRuntimeIds(prev => [...prev, entry.componentId]);
        try {
            if (entry.installUrl && entry.componentId !== 'sd-cpp' && entry.componentId !== 'ollama') {
                window.electron.openExternal(entry.installUrl);
            } else {
                await window.electron.runtime.runComponentAction(entry.componentId);
            }

            const nextCompleted = [
                ...(runtimePromptSettings.completedRuntimeInstalls ?? []).filter(id => id !== entry.componentId),
                entry.componentId,
            ];
            await persistRuntimeSettings({
                ...runtimePromptSettings,
                completedRuntimeInstalls: nextCompleted,
            });
            await refreshRuntimeStatus(true);
        } finally {
            setInstallingRuntimeIds(prev => prev.filter(id => id !== entry.componentId));
        }
    };

    const handleRuntimeDismiss = async (componentId: string): Promise<void> => {
        const nextDismissed = [
            ...(runtimePromptSettings.dismissedRuntimeInstallPrompts ?? []).filter(id => id !== componentId),
            componentId,
        ];
        await persistRuntimeSettings({
            ...runtimePromptSettings,
            dismissedRuntimeInstallPrompts: nextDismissed,
        });
    };

    const handleNext = async (): Promise<void> => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
            return;
        }

        await completeOnboarding();
        onStartTour?.();
    };

    const handleBack = (): void => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const step = steps[currentStep];
    const titleKey = step.type === 'runtime' ? 'onboarding.runtime.title' : `onboarding.${step.title}Title`;
    const descKey =
        step.type === 'runtime'
            ? 'onboarding.runtime.description'
            : `onboarding.${step.title}Description`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="5xl">
            <div className="relative overflow-hidden min-h-[420px] flex flex-col">
                <div className="flex gap-1 mb-8 pr-8">
                    {steps.map((_, index) => (
                        <div
                            key={index}
                            className={cn(
                                'h-1.5 flex-1 rounded-full transition-all duration-500',
                                index <= currentStep ? 'bg-primary' : 'bg-muted'
                            )}
                        />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${step.title}-${currentStep}`}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -20, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="flex-1 flex flex-col items-center text-center space-y-6"
                    >
                        <div
                            className={cn(
                                'w-24 h-24 rounded-3xl bg-gradient-to-br flex items-center justify-center text-5xl shadow-2xl',
                                step.color
                            )}
                        >
                            {step.icon}
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-2xl font-black tracking-tight text-foreground">
                                {t(titleKey)}
                            </h2>
                            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
                                {t(descKey)}
                            </p>
                        </div>

                        {step.type === 'runtime' && (
                            <div className="w-full max-w-2xl space-y-3 text-left">
                                {!settingsLoaded && (
                                    <div className="rounded-xl border border-border/70 bg-card/60 px-4 py-4 text-sm text-muted-foreground">
                                        {t('common.loading')}
                                    </div>
                                )}
                                {settingsLoaded && runtimePrompts.map(entry => {
                                    const isSelected = selectedRuntimeIds.includes(entry.componentId);
                                    const isInstalling = installingRuntimeIds.includes(entry.componentId);
                                    return (
                                        <div
                                            key={entry.componentId}
                                            className="rounded-xl border border-border/70 bg-card/60 px-4 py-4 flex items-start gap-3"
                                        >
                                            <input
                                                type="checkbox"
                                                className="mt-1 h-4 w-4 rounded border-border"
                                                checked={isSelected}
                                                onChange={() => {
                                                    setSelectedRuntimeIds(prev =>
                                                        prev.includes(entry.componentId)
                                                            ? prev.filter(id => id !== entry.componentId)
                                                            : [...prev, entry.componentId]
                                                    );
                                                }}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {entry.displayName}
                                                    </span>
                                                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                        {entry.componentId}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {entry.message}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {entry.installUrl && entry.componentId !== 'sd-cpp' && entry.componentId !== 'ollama' && (
                                                    <button
                                                        onClick={() => {
                                                            window.electron.openExternal(entry.installUrl ?? '');
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted/40"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        {t('onboarding.runtime.websiteAction')}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        void handleRuntimeInstall(entry);
                                                    }}
                                                    disabled={!isSelected || isInstalling}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {isInstalling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                                    {getComponentActionLabel(entry.componentId, t)}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        void handleRuntimeDismiss(entry.componentId);
                                                    }}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted/40"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    {t('onboarding.runtime.notNowAction')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="mt-auto flex justify-between items-center pt-8 border-t border-border/50">
                    <button
                        onClick={handleBack}
                        className={cn(
                            'px-6 py-2 rounded-xl text-sm font-semibold transition-all',
                            currentStep === 0
                                ? 'opacity-0 pointer-events-none'
                                : 'hover:bg-muted text-muted-foreground'
                        )}
                    >
                        {t('common.back')}
                    </button>

                    <button
                        onClick={() => {
                            void handleNext();
                        }}
                        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {currentStep === steps.length - 1
                            ? t('common.getStarted')
                            : t('common.next')}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingFlow;
