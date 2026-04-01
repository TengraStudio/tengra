import { Loader2 } from 'lucide-react';

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
    <div className="flex items-center gap-2 text-sm text-warning">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>
        {showAttempts
          ? t('common.retryingWithAttempt', { attempt, maxAttempts })
          : t('common.retrying')}
      </span>
    </div>
  );
};

export default RetryIndicator;
