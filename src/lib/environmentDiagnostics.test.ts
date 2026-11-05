import { describe, expect, it } from 'vitest';
import { compareTimezone, formatUtcOffset, observeTimezone, type TimezoneObservation } from './environmentDiagnostics';

const observation: TimezoneObservation = {
  timeZone: 'Asia/Shanghai',
  utcOffsetMinutes: 480,
  localTime: '2026/11/04 12:00:00',
  observedAt: '2026-11-04T04:00:00.000Z',
};

describe('local timezone consistency', () => {
  it('only compares an explicitly supplied, valid IANA timezone', () => {
    expect(compareTimezone('', observation).status).toBe('unknown');
    expect(compareTimezone('Invalid/Zone', observation).status).toBe('invalid');
    expect(compareTimezone('  Asia/Shanghai  ', observation)).toEqual({
      status: 'match', expectedTimeZone: 'Asia/Shanghai',
    });
    expect(compareTimezone('Europe/London', observation)).toEqual({
      status: 'mismatch', expectedTimeZone: 'Europe/London',
    });
    expect(compareTimezone('Asia/Shanghai', null).status).toBe('unknown');
    expect(compareTimezone('Asia/Shanghai', { ...observation, timeZone: null }).status).toBe('unknown');
  });

  it('reports offsets with the right sign and reads a local observation without a network source', () => {
    expect(formatUtcOffset(480)).toBe('UTC+08:00');
    expect(formatUtcOffset(-450)).toBe('UTC-07:30');
    expect(formatUtcOffset(0)).toBe('UTC+00:00');
    const now = new Date('2026-11-04T04:00:00.000Z');
    const result = observeTimezone(now);
    expect(result.observedAt).toBe(now.toISOString());
    expect(result.utcOffsetMinutes).toBe(-now.getTimezoneOffset());
    expect(result.localTime).toBeTruthy();
  });
});
