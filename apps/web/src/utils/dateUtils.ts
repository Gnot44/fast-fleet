/**
 * FastFleet Date Utility Functions
 * Ensures timezone consistency for Thailand GMT+7 operations
 */

/**
 * Returns formatted YYYY-MM-DD in local time
 * Prevents UTC-shift bugs where .toISOString().split('T')[0] yields yesterday
 * between 00:00 and 06:59 in Thailand (UTC+7).
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns start of current week (Sunday) formatted as YYYY-MM-DD in local time
 */
export function getStartOfWeekString(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - day);
  return getLocalDateString(date);
}

/**
 * Returns end of current week (Saturday) formatted as YYYY-MM-DD in local time
 */
export function getEndOfWeekString(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() + (6 - day));
  return getLocalDateString(date);
}
