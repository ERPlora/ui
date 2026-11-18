const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The privacy-enhanced player of `videoId`, autoplaying inline without fullscreen; `undefined` for anything that is
 *  not a YouTube id, so no other text ever reaches the URL. */
export function youtubeEmbedSrc(videoId: string): string | undefined {
  if (!VIDEO_ID.test(videoId)) return undefined;
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&fs=0&rel=0&playsinline=1`;
}
