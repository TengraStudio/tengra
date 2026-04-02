/**
 * UI-related constants for consistent styling and behavior across the application.
 */

/** Z-index values for layered UI elements */
export const Z_INDEX = {
    /** Base content layer */
    BASE: 0,
    /** Sticky headers and footers */
    STICKY: 100,
    /** Dropdown menus */
    DROPDOWN: 1000,
    /** Tooltips */
    TOOLTIP: 5000,
    /** Modals and dialogs */
    MODAL: 9000,
    /** Select dropdowns */
    SELECT_DROPDOWN: 10000,
    /** Floating elements in workspace */
    WORKSPACE_FLOAT: 99999, 
} as const;

/** Animation durations (in milliseconds) */
export const ANIMATION_DURATIONS = {
    /** Fast transitions (hover, focus) */
    FAST: 150,
    /** Normal transitions */
    NORMAL: 200,
    /** Slow transitions (page changes) */
    SLOW: 300,
    /** Modal enter/exit */
    MODAL: 200,
} as const;

/** Breakpoints for responsive design (in pixels) */
export const BREAKPOINTS = {
    /** Mobile devices */
    SM: 640,
    /** Tablets */
    MD: 768,
    /** Laptops */
    LG: 1024,
    /** Desktops */
    XL: 1280,
    /** Large desktops */
    XXL: 1536,
} as const;

/** Color thresholds for statistics and indicators */
export const COLOR_THRESHOLDS = {
    /** Low percentage threshold (red zone) */
    LOW: 25,
    /** Medium percentage threshold (yellow zone) */
    MEDIUM: 50,
    /** High percentage threshold (green zone) */
    HIGH: 75,
    /** Quota warning threshold */
    QUOTA_WARNING: 5,
} as const;

/** Number formatting thresholds */
export const FORMAT_THRESHOLDS = {
    /** Threshold for displaying in millions */
    MILLIONS: 1000000,
    /** Threshold for displaying in thousands */
    THOUSANDS: 1000,
    /** Downloads threshold for popular indicator */
    POPULAR_DOWNLOADS: 1000,
} as const;

/** Accessibility constants */
export const A11Y = {
    /** Minimum touch target size (in pixels) */
    MIN_TOUCH_TARGET: 44,
    /** Focus ring width */
    FOCUS_RING_WIDTH: 2,
    /** Focus ring offset */
    FOCUS_RING_OFFSET: 2,
} as const;

/** Default port numbers */
export const DEFAULT_PORTS = {
    /** Default backend server port */
    BACKEND: 3000,
    /** Default SSH port */
    SSH: 22,
} as const;

/** Common unit conversions */
export const CONVERSIONS = {
    /** Milliseconds to seconds */
    MS_TO_SEC: 1000,
    /** Bytes to kilobytes */
    BYTES_TO_KB: 1024,
    /** Bytes to megabytes */
    BYTES_TO_MB: 1024 * 1024,
} as const;
