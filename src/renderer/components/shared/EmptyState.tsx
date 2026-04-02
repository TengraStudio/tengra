/**
 * Reusable Empty State Component
 *
 * Displays a centered empty state with optional icon, title, description, and action button.
 * Title and description should be passed as already-translated strings.
 */

import React, { memo } from 'react';

import './empty-state.css';

/** Props for the EmptyState component */
interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** Optional icon element displayed above the title */
  icon?: React.ReactNode;
  /** Primary message (should be pre-translated) */
  title: string;
  /** Secondary explanatory text (should be pre-translated) */
  description?: string;
  /** Optional call-to-action button */
  action?: EmptyStateAction;
}

/**
 * A reusable empty state component for when there are no items to display.
 * Renders a centered layout with an optional icon, title, description, and action button.
 */
export const EmptyState: React.FC<EmptyStateProps> = memo(({
  icon,
  title,
  description,
  action,
}) => (
  <div className="tengra-empty-state">
    {icon && (
      <div className="tengra-empty-state__icon">
        {icon}
      </div>
    )}
    <div className="tengra-empty-state__content">
      <h3 className="tengra-empty-state__title">{title}</h3>
      {description && (
        <p className="tengra-empty-state__description">{description}</p>
      )}
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="tengra-empty-state__action"
      >
        {action.label}
      </button>
    )}
  </div>
));

EmptyState.displayName = 'EmptyState';
