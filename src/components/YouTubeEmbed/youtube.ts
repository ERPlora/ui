const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LANGUAGE = /^[A-Za-z]{2,3}(?:-(?:[A-Za-z]{2}|\d{3}))?$/;

/** The privacy-enhanced player of `videoId` with all of YouTube's controls, autoplaying inline; with a `language`
 *  (`es`, `pt-BR`), its captions are on in that language and the player speaks it. Anything that is not a YouTube id
 *  gives `undefined`, and a language that is not a language code is left out, so no other text ever reaches the URL. */
export function youtubeEmbedSrc(videoId: string, language?: string): string | undefined {
  if (!VIDEO_ID.test(videoId)) return undefined;
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;
  if (language === undefined || !LANGUAGE.test(language)) return src;
  return `${src}&cc_load_policy=1&cc_lang_pref=${language}&hl=${language}`;
}
