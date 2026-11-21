import { afterEach, describe, expect, it, vi } from 'vitest';

import { afterTheLoad, NOT_THE_LINKED_HUB, whileTheHubLands } from './native-bridge';

describe('whileTheHubLands — asking the app again while the hub lands', () => {
  it('the app saying it in an Error counts too: asked again, and its answer comes back', async () => {
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error(NOT_THE_LINKED_HUB))
      .mockResolvedValueOnce('printed');

    await expect(whileTheHubLands(attempt, async () => {})).resolves.toBe('printed');
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('waits a little longer each time, about eight seconds in all, then the last refusal comes back', async () => {
    const attempt = vi.fn(async () => {
      throw 'not_the_linked_hub';
    });
    const wait = vi.fn<(ms: number) => Promise<void>>(async () => {});

    await expect(whileTheHubLands(attempt, wait)).rejects.toBe('not_the_linked_hub');
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([250, 500, 1000, 2000, 4000]);
    expect(attempt).toHaveBeenCalledTimes(6);
  });
});

describe('afterTheLoad — the wait starts once the page has loaded', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('on a page still loading, nothing is counted until its load', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    let done = false;
    void afterTheLoad(250).then(() => (done = true));

    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(250);
    expect(done).toBe(true);
  });

  it('on a page already loaded, it is the time asked and no less', async () => {
    vi.useFakeTimers();
    let done = false;
    void afterTheLoad(250).then(() => (done = true));

    await vi.advanceTimersByTimeAsync(249);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
