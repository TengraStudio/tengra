/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconLoader2 } from '@tabler/icons-react';

import { useTranslation } from '@/i18n';


/** Props for the RetryIndicator component */
interface RetryIndicatorProps {
  /** Whether a retry is currently in progress */
  isRetrying: boolean
  /** Current retry attempt number */
  attempt?: number
  /** Maximum number of retry attempts */
  maxAttempts?: number
}

/**
 * Displays a spinner and "Retrying..." text when a request is being retried.
 * Optionally shows the current attempt out of max attempts.
 */
const RetryIndicator: React.FC<RetryIndicatorProps> = ({ isRetrying, attempt, maxAttempts }) => {
  const { t } = useTranslation();

  if (!isRetrying) {
    return null;
  }

  const showAttempts = attempt !== undefined && maxAttempts !== undefined;

  return (
    <div className="flex items-center gap-2 text-sm text-warning font-medium animate-in fade-in duration-300">
      <IconLoader2 className="w-4 h-4 animate-spin" />
      <span>
        {showAttempts
          ? t('common.retryingWithAttempt', { attempt, maxAttempts })
          : t('common.retrying')}
      </span>
    </div>
  );
};

export default RetryIndicator;
