type TranslationFunction = (key: string, values?: Record<string, string | number>) => string;

export const formatDurationSeconds = (
  value: number | string | null | undefined,
  t: TranslationFunction,
  fallback = '-'
): string => {
  if (value === null || value === undefined || value === '') return fallback;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;

  let remainingSeconds = Math.max(0, Math.round(numericValue));
  const hours = Math.floor(remainingSeconds / 3600);
  remainingSeconds %= 3600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(t('hoursShort', { count: hours }));
  if (minutes > 0) parts.push(t('minutesShort', { count: minutes }));
  if (seconds > 0 || parts.length === 0) parts.push(t('secondsShort', { count: seconds }));

  return parts.join(' ');
};
