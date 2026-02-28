/**
 * Locale-aware date and number formatting utilities using the Intl API.
 * @module format.util
 */

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400
const SECONDS_PER_WEEK = 604800
const SECONDS_PER_MONTH = 2592000
const SECONDS_PER_YEAR = 31536000

/** Thresholds for relative time units, ordered from largest to smallest. */
const RELATIVE_TIME_THRESHOLDS: ReadonlyArray<{
  upperBound: number
  unit: Intl.RelativeTimeFormatUnit
  divisor: number
}> = [
  { upperBound: SECONDS_PER_MINUTE, unit: 'second', divisor: 1 },
  { upperBound: SECONDS_PER_HOUR, unit: 'minute', divisor: SECONDS_PER_MINUTE },
  { upperBound: SECONDS_PER_DAY, unit: 'hour', divisor: SECONDS_PER_HOUR },
  { upperBound: SECONDS_PER_WEEK, unit: 'day', divisor: SECONDS_PER_DAY },
  { upperBound: SECONDS_PER_MONTH, unit: 'week', divisor: SECONDS_PER_WEEK },
  { upperBound: SECONDS_PER_YEAR, unit: 'month', divisor: SECONDS_PER_MONTH }
]

/**
 * Formats a date according to the given locale and options using `Intl.DateTimeFormat`.
 * @param date - The date to format.
 * @param locale - A BCP 47 locale string (e.g. "en-US", "tr-TR").
 * @param options - Optional `Intl.DateTimeFormatOptions` to customize output.
 * @returns The formatted date string.
 */
export function formatDate(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale, options).format(date)
}

/**
 * Formats a number according to the given locale and options using `Intl.NumberFormat`.
 * @param num - The number to format.
 * @param locale - A BCP 47 locale string (e.g. "en-US", "de-DE").
 * @param options - Optional `Intl.NumberFormatOptions` to customize output.
 * @returns The formatted number string.
 */
export function formatNumber(
  num: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(num)
}

/**
 * Formats a date as a human-readable relative time string (e.g. "2 hours ago")
 * using `Intl.RelativeTimeFormat`.
 * @param date - The date to express relative to now.
 * @param locale - A BCP 47 locale string (e.g. "en-US", "ja-JP").
 * @returns A locale-aware relative time string.
 */
export function formatRelativeTime(date: Date, locale: string): string {
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absDiff = Math.abs(diffSeconds)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  for (const { upperBound, unit, divisor } of RELATIVE_TIME_THRESHOLDS) {
    if (absDiff < upperBound) {
      return rtf.format(Math.round(diffSeconds / divisor), unit)
    }
  }

  return rtf.format(Math.round(diffSeconds / SECONDS_PER_YEAR), 'year')
}
