import { AlertTriangle } from 'lucide-react';

import { useTranslation } from '@/i18n';


/** Props for the FailoverIndicator component */
interface FailoverIndicatorProps {
  /** The model that was originally requested */
  originalModel: string
  /** The fallback model that is being used instead */
  fallbackModel: string
  /** Whether the indicator is visible */
  isVisible: boolean
}

/**
 * Displays a small info banner when a fallback/alternate LLM model is used
 * instead of the originally requested model.
 */
const FailoverIndicator: React.FC<FailoverIndicatorProps> = ({
  originalModel,
  fallbackModel,
  isVisible
}) => {
  const { t } = useTranslation();

  if (!isVisible) {
    return null;
  }

  return (
    <div className="tengra-failover-indicator">
      <AlertTriangle className="tengra-failover-indicator__icon" />
      <span>
        {t('common.failoverModelUsed', { fallback: fallbackModel, original: originalModel })}
      </span>
    </div>
  );
};

export default FailoverIndicator;
