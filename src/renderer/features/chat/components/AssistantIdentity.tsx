/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { ProviderIcon } from '@/components/shared/ProviderIcon';

interface AssistantIdentityProps {
    model?: string
    provider?: string
    backend?: string
}

export const AssistantIdentity: React.FC<AssistantIdentityProps> = ({ model, provider, backend }) => {
    return (
        <ProviderIcon 
            model={model}
            provider={provider}
            backend={backend}
            variant="minimal"
            containerClassName="mt-1.5 w-6 h-6"
        />
    );
};
