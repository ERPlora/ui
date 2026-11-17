import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { useOnline } from './online';

afterEach(() => {
  vi.restoreAllMocks();
});

const setOnLine = (value: boolean) => vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);

describe('useOnline', () => {
  it('starts from navigator.onLine', () => {
    setOnLine(false);
    const scope = effectScope();
    const online = scope.run(() => useOnline())!;
    expect(online.value).toBe(false);
    scope.stop();
  });

  it('follows the offline and online events of the window', () => {
    setOnLine(true);
    const scope = effectScope();
    const online = scope.run(() => useOnline())!;
    expect(online.value).toBe(true);

    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    expect(online.value).toBe(false);

    setOnLine(true);
    window.dispatchEvent(new Event('online'));
    expect(online.value).toBe(true);
    scope.stop();
  });

  it('stops listening once its scope ends', () => {
    setOnLine(true);
    const scope = effectScope();
    const online = scope.run(() => useOnline())!;
    scope.stop();

    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    expect(online.value).toBe(true);
  });
});
