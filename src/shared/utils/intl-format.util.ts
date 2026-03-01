/**
 * Locale-aware date formatting using Intl.DateTimeFormat.
 * @param date - Date object or epoch milliseconds
 * @param locale - BCP 47 locale string (e.g. 'en-US', 'ar')
 * @param options - Intl.DateTimeFormatOptions overrides
 */
export function formatDate(
    date: Date | number,
    locale: string,
    options?: Intl.DateTimeFormatOptions
): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) {
        return '-';
    }
    return new Intl.DateTimeFormat(locale, options).format(d);
}

/**
 * Locale-aware number formatting using Intl.NumberFormat.
 * @param num - The number to format
 * @param locale - BCP 47 locale string
 * @param options - Intl.NumberFormatOptions overrides
 */
export function formatNumber(
    num: number,
    locale: string,
    options?: Intl.NumberFormatOptions
): string {
    if (typeof num !== 'number' || Number.isNaN(num)) {
        return '0';
    }
    return new Intl.NumberFormat(locale, options).format(num);
}

const RELATIVE_UNITS: ReadonlyArray<{ max: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { max: 60, divisor: 1, unit: 'second' },
    { max: 3600, divisor: 60, unit: 'minute' },
    { max: 86400, divisor: 3600, unit: 'hour' },
    { max: 2592000, divisor: 86400, unit: 'day' },
    { max: 31536000, divisor: 2592000, unit: 'month' },
    { max: Infinity, divisor: 31536000, unit: 'year' },
];

/**
 * Locale-aware relative time formatting (e.g. "3 hours ago").
 * @param date - Date object or epoch milliseconds
 * @param locale - BCP 47 locale string
 */
export function formatRelativeTime(date: Date | number, locale: string): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) {
        return '-';
    }

    const diffSeconds = Math.round((d.getTime() - Date.now()) / 1000);
    const absDiff = Math.abs(diffSeconds);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const { max, divisor, unit } of RELATIVE_UNITS) {
        if (absDiff < max) {
            return rtf.format(Math.round(diffSeconds / divisor), unit);
        }
    }

    return rtf.format(Math.round(diffSeconds / 31536000), 'year');
}
