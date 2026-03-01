import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/framer-motion-compat', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({
            children,
            onClick,
            className,
        }: {
            children?: React.ReactNode;
            onClick?: () => void;
            className?: string;
        }) => (
            <div onClick={onClick} className={className}>
                {children}
            </div>
        ),
    },
}));

import { OnboardingTour } from '@/features/onboarding/OnboardingTour';

describe('OnboardingTour', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onComplete: vi.fn(),
        language: 'en' as const,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        const { container } = render(<OnboardingTour {...defaultProps} isOpen={false} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders when isOpen is true', () => {
        render(<OnboardingTour {...defaultProps} />);
        expect(screen.getByText('onboarding.step1Title')).toBeInTheDocument();
    });

    it('renders 5 step indicators', () => {
        const { container } = render(<OnboardingTour {...defaultProps} />);
        const dots = container.querySelectorAll('.rounded-full');
        // 5 steps = 5 dots (filter to the step indicator dots)
        expect(dots.length).toBeGreaterThanOrEqual(5);
    });

    it('navigates forward through steps', () => {
        render(<OnboardingTour {...defaultProps} />);
        fireEvent.click(screen.getByText('onboarding.continue'));
        expect(screen.getByText('onboarding.step2Title')).toBeInTheDocument();
    });

    it('navigates backward through steps', () => {
        render(<OnboardingTour {...defaultProps} />);
        fireEvent.click(screen.getByText('onboarding.continue'));
        expect(screen.getByText('onboarding.step2Title')).toBeInTheDocument();
        fireEvent.click(screen.getByText('onboarding.back'));
        expect(screen.getByText('onboarding.step1Title')).toBeInTheDocument();
    });

    it('calls onComplete on last step', () => {
        render(<OnboardingTour {...defaultProps} />);
        // Navigate through all 5 steps
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByText('onboarding.continue'));
        }
        // Last step shows letsStart
        fireEvent.click(screen.getByText('onboarding.letsStart'));
        expect(defaultProps.onComplete).toHaveBeenCalled();
    });

    it('shows letsStart text on final step', () => {
        render(<OnboardingTour {...defaultProps} />);
        for (let i = 0; i < 4; i++) {
            fireEvent.click(screen.getByText('onboarding.continue'));
        }
        expect(screen.getByText('onboarding.letsStart')).toBeInTheDocument();
    });
});
