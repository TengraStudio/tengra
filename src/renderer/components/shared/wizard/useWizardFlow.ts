import { useCallback, useMemo, useState } from 'react';

/** Validation callback for a wizard step. Returns true if the step is valid. */
type StepValidator<TData> = (data: TData) => boolean;

interface UseWizardFlowOptions<TStepId extends string, TData> {
    /** Ordered list of step identifiers. */
    steps: TStepId[];
    /** Initial step to display. Defaults to first step. */
    initialStep?: TStepId;
    /** Per-step validation callbacks. */
    stepValidation?: Partial<Record<TStepId, StepValidator<TData>>>;
}

interface UseWizardFlowReturn<TStepId extends string> {
    currentStep: TStepId;
    currentStepIndex: number;
    totalSteps: number;
    isFirstStep: boolean;
    isLastStep: boolean;
    canGoNext: boolean;
    canGoBack: boolean;
    goNext: () => void;
    goBack: () => void;
    goTo: (step: TStepId) => void;
    /** Returns true if a given step is completed (before current). */
    isStepCompleted: (step: TStepId) => boolean;
}

/**
 * Generic wizard flow state management hook.
 * @param options - Wizard configuration including steps and validation.
 * @param data - Current step data used for validation.
 */
export function useWizardFlow<TStepId extends string, TData>(
    options: UseWizardFlowOptions<TStepId, TData>,
    data: TData
): UseWizardFlowReturn<TStepId> {
    const { steps, initialStep, stepValidation } = options;
    const [currentStep, setCurrentStep] = useState<TStepId>(initialStep ?? steps[0]);

    const currentStepIndex = useMemo(
        () => steps.indexOf(currentStep),
        [steps, currentStep]
    );

    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === steps.length - 1;
    const canGoBack = !isFirstStep;

    const canGoNext = useMemo(() => {
        if (isLastStep) {return false;}
        const validator = stepValidation?.[currentStep];
        if (validator) {return validator(data);}
        return true;
    }, [isLastStep, stepValidation, currentStep, data]);

    const goNext = useCallback(() => {
        if (!isLastStep) {
            setCurrentStep(steps[currentStepIndex + 1]);
        }
    }, [isLastStep, steps, currentStepIndex]);

    const goBack = useCallback(() => {
        if (!isFirstStep) {
            setCurrentStep(steps[currentStepIndex - 1]);
        }
    }, [isFirstStep, steps, currentStepIndex]);

    const goTo = useCallback(
        (step: TStepId) => {
            if (steps.includes(step)) {
                setCurrentStep(step);
            }
        },
        [steps]
    );

    const isStepCompleted = useCallback(
        (step: TStepId) => {
            const stepIdx = steps.indexOf(step);
            return stepIdx >= 0 && stepIdx < currentStepIndex;
        },
        [steps, currentStepIndex]
    );

    return {
        currentStep,
        currentStepIndex,
        totalSteps: steps.length,
        isFirstStep,
        isLastStep,
        canGoNext,
        canGoBack,
        goNext,
        goBack,
        goTo,
        isStepCompleted,
    };
}
