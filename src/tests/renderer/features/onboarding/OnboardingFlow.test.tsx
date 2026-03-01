import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({ language: 'en' }),
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/framer-motion-compat', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children }: Record<string, unknown> & { children?: React.ReactNode }) => (
            <div data-testid="motion-div">{children}</div>
        ),
    },
}));

vi.mock('@/components/ui/modal', () => ({
    Modal: ({
        isOpen,
        children,
        title,
    }: {
        isOpen: boolean;
        children: React.ReactNode;
        title: string;
        onClose: () => void;
        className?: string;
    }) => (isOpen ? <div data-testid="modal" aria-label={title}>{children}</div> : null),
}));

import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';

describe('OnboardingFlow', () => {
    const defaultProps: {
        isOpen: boolean;
        onClose: () => void;
        onStartTour: () => void;
    } = {
        isOpen: true,
        onClose: vi.fn(),
        onStartTour: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders when isOpen is true', () => {
        render(<OnboardingFlow {...defaultProps} />);
        expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
        render(<OnboardingFlow {...defaultProps} isOpen={false} />);
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders progress indicators for all steps', () => {
        const { container } = render(<OnboardingFlow {...defaultProps} />);
        // 4 steps = 4 progress bars
        const progressBars = container.querySelectorAll('.h-1\\.5');
        expect(progressBars.length).toBe(4);
    });

    it('renders next button with translation key', () => {
        render(<OnboardingFlow {...defaultProps} />);
        expect(screen.getByText('common.next')).toBeInTheDocument();
    });

    it('navigates to next step on next button click', () => {
        render(<OnboardingFlow {...defaultProps} />);
        const nextButton = screen.getByText('common.next');
        fireEvent.click(nextButton);
        // After clicking next, the title key should change to second step
        expect(screen.getByText('onboarding.multiModelTitle')).toBeInTheDocument();
    });

    it('calls onClose and sets localStorage on skip', () => {
        render(<OnboardingFlow {...defaultProps} />);
        // The skip button is the X button
        const skipButton = screen.getByTitle('onboarding.skip');
        fireEvent.click(skipButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
        expect(localStorage.getItem('Tengra-onboarding-complete')).toBe('true');
    });

    it('shows getStarted on last step', () => {
        render(<OnboardingFlow {...defaultProps} />);
        const nextButton = screen.getByText('common.next');
        // Navigate to last step (4 steps, click next 3 times)
        fireEvent.click(nextButton);
        fireEvent.click(screen.getByText('common.next'));
        fireEvent.click(screen.getByText('common.next'));
        expect(screen.getByText('common.getStarted')).toBeInTheDocument();
    });

    it('calls onStartTour when completing last step', () => {
        render(<OnboardingFlow {...defaultProps} />);
        // Navigate to last step
        for (let i = 0; i < 3; i++) {
            fireEvent.click(screen.getByText('common.next'));
        }
        fireEvent.click(screen.getByText('common.getStarted'));
        expect(defaultProps.onStartTour).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
    });
});
