import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/i18n'

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
  const { t } = useTranslation()

  if (!isVisible) {
    return null
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        {t('common.failoverModelUsed', { fallback: fallbackModel, original: originalModel })}
      </span>
    </div>
  )
}

export default FailoverIndicator
