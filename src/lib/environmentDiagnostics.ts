export interface TimezoneObservation {
  timeZone: string | null;
  utcOffsetMinutes: number;
  localTime: string;
  observedAt: string;
}

export type TimezoneComparison =
  | { status: 'unknown'; expectedTimeZone: null }
  | { status: 'invalid'; expectedTimeZone: null }
  | { status: 'match' | 'mismatch'; expectedTimeZone: string };

function canonicalTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function observeTimezone(now = new Date()): TimezoneObservation {
  const reported = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZone = reported ? canonicalTimeZone(reported) : null;
  const localTime = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(now);
  return {
    timeZone,
    utcOffsetMinutes: -now.getTimezoneOffset(),
    localTime,
    observedAt: now.toISOString(),
  };
}

export function compareTimezone(expected: string, observation: TimezoneObservation | null): TimezoneComparison {
  const value = expected.trim();
  if (!value) return { status: 'unknown', expectedTimeZone: null };
  if (value.length > 80) return { status: 'invalid', expectedTimeZone: null };
  const expectedTimeZone = canonicalTimeZone(value);
  if (!expectedTimeZone) return { status: 'invalid', expectedTimeZone: null };
  if (!observation?.timeZone) return { status: 'unknown', expectedTimeZone: null };
  return {
    status: expectedTimeZone === observation.timeZone ? 'match' : 'mismatch',
    expectedTimeZone,
  };
}

export function formatUtcOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}
