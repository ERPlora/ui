// Whether the server answers at all (gh:hub#438). `navigator.onLine` only knows about the device's link: a flaky
// network leaves it `true` (hub#2489). Before the shell leaves a screen for a fresh document, it asks the server for
// the file that failed; any answer, a 404 included, means a fresh document will load.

/** True when the server answers `url` (any status) within `withinMs`; false without an answer or once it is over. */
export async function serverAnswers(url: string, withinMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), withinMs);
  });
  // `no-cors`: an opaque answer is still an answer (the dev server serves the screens from another origin).
  const answered = fetch(url, { method: "HEAD", cache: "no-store", mode: "no-cors" }).then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([answered, late]);
  } finally {
    clearTimeout(timer);
  }
}
