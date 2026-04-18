/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-warning/15 text-warning font-medium text-sm border border-warning/20 animate-in fade-in slide-in-from-top-1 duration-300">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        {t('common.failoverModelUsed', { fallback: fallbackModel, original: originalModel })}
      </span>
    </div>
  );
};

export default FailoverIndicator;
