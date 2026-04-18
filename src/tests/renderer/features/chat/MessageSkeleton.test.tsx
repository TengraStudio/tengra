/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MessageSkeleton } from '@/features/chat/components/MessageSkeleton';

describe('MessageSkeleton', () => {
    it('renders without crashing', () => {
        const { container } = render(<MessageSkeleton />);
        expect(container.firstChild).toBeTruthy();
    });

    it('has animate-pulse class for loading effect', () => {
        const { container } = render(<MessageSkeleton />);
        const pulseElement = container.querySelector('.animate-pulse');
        expect(pulseElement).toBeInTheDocument();
    });

    it('renders skeleton placeholder lines', () => {
        const { container } = render(<MessageSkeleton />);
        const skeletonLines = container.querySelectorAll('.bg-muted\\/20');
        expect(skeletonLines.length).toBeGreaterThanOrEqual(4);
    });
});
