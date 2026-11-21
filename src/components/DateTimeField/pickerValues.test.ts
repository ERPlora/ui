import { afterEach, describe, expect, it, vi } from 'vitest';

import { firstDayOfWeek, formatDay, formatTime, isoDay, isoTime, minuteValues, todayAt } from './pickerValues';

describe('isoDay: the day an ion-datetime answers, as the field keeps it', () => {
  it('keeps a day and drops the time Ionic adds to it', () => {
    expect(isoDay('2026-11-23')).toBe('2026-11-23');
    expect(isoDay('2026-11-23T14:30:00')).toBe('2026-11-23');
  });

  it('is empty for no value or something that is not a day', () => {
    for (const value of [undefined, null, '', '14:30', ['2026-11-23'], 'tomorrow']) expect(isoDay(value), String(value)).toBe('');
  });
});

describe('isoTime: the time an ion-datetime answers, as the field keeps it', () => {
  it('keeps hours and minutes, alone or after a day', () => {
    expect(isoTime('14:30')).toBe('14:30');
    expect(isoTime('09:05:00')).toBe('09:05');
    expect(isoTime('2026-11-21T07:45:00')).toBe('07:45');
  });

  it('is empty for no value or something that is not a time', () => {
    for (const value of [undefined, null, '', '2026-11-21', ['14:30'], 'noon']) expect(isoTime(value), String(value)).toBe('');
  });
});

describe('formatDay: the day as the person reads it', () => {
  it('writes the numeric date of the language, never shifted by the device zone', () => {
    expect(formatDay('2026-11-23', 'es')).toBe('23/11/2026');
    expect(formatDay('2026-11-23', 'en')).toBe('11/23/2026');
    expect(formatDay('2026-01-01', 'es-ES')).toBe('01/01/2026');
  });

  it('is empty for no day, and a broken language tag falls back to English', () => {
    expect(formatDay('', 'es')).toBe('');
    expect(formatDay('2026-11-23', 'not a tag')).toBe('11/23/2026');
  });
});

describe('formatTime: the time as the person reads it', () => {
  it('uses the clock of the language: 24 hours in Spanish, AM/PM in English', () => {
    expect(formatTime('14:30', 'es')).toBe('14:30');
    expect(formatTime('14:30', 'en')).toMatch(/^02:30\sPM$/);
    expect(formatTime('09:05', 'es')).toBe('09:05');
  });

  it('is empty for no time', () => {
    expect(formatTime('', 'es')).toBe('');
  });
});

describe('firstDayOfWeek: where the calendar of a language starts its week (ion-datetime counts Sunday as 0)', () => {
  it('Monday in Spain and Britain, Sunday in the United States and Brazil', () => {
    expect([firstDayOfWeek('es'), firstDayOfWeek('es-ES'), firstDayOfWeek('en-GB')]).toEqual([1, 1, 1]);
    expect([firstDayOfWeek('en'), firstDayOfWeek('pt-BR')]).toEqual([0, 0]);
  });

  it('Monday, the international week, when the language says nothing', () => {
    expect(firstDayOfWeek('not a tag')).toBe(1);
  });
});

describe('todayAt: a time on the day the time picker works on, the device’s today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts the time on the local date of the device, as ion-datetime takes today', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 23, 59));
    expect(todayAt('09:00')).toBe('2026-11-21T09:00');
    vi.setSystemTime(new Date(2027, 0, 2, 0, 1));
    expect(todayAt('18:30')).toBe('2027-01-02T18:30');
  });

  it('is nothing for no time', () => {
    expect([todayAt(''), todayAt(undefined), todayAt('noon')]).toEqual([undefined, undefined, undefined]);
  });
});

describe('minuteValues: the minutes the time picker offers', () => {
  it('every `step` minutes from the hour', () => {
    expect(minuteValues(15)).toBe('0,15,30,45');
    expect(minuteValues(20)).toBe('0,20,40');
    expect(minuteValues(60)).toBe('0');
  });

  it('every minute without a step, or with one that is not a whole number of minutes', () => {
    for (const step of [undefined, 0, 1, -5, 1.5]) expect(minuteValues(step), String(step)).toBeUndefined();
  });
});
