// Single icon registry of the shell (ported from ERPlora hub `apps/web/src/lib/icons.ts`, trimmed
// to what the shell, topbar, menu, tabbar and demo need).
//
// Iconify, several sets, NO network at runtime (CSP `connect-src` has no external hosts):
//   - `ion:` icons the shell paints by default are BAKED below as SVG strings (a plain object, so
//     it tree-shakes and loads synchronously). `icons.test.ts` regenerates every entry from
//     `@iconify-json/ion` and fails if one is missing or stale, so the table cannot rot.
//   - any other icon (`ion:` not baked, `material-symbols:`, `mdi:`) is loaded on demand from its
//     `@iconify-json/*` package with a dynamic `import()`, so unused sets are never in the entry
//     chunk. `resolveIconAsync()` loads and resolves; afterwards `resolveIcon()` answers
//     synchronously from the cache.
//
// Two ways to paint, kept in sync from here (same as the source):
//   - `resolveIcon()`  -> HubIcon.vue (shell views, `prefix:name`).
//   - `iconRegistry()` -> `addIcons()` so `<ion-icon name="...">` inside the `ok-*` components of
//     OutfitKit keeps working. Note: ionicons sanitizes `name=` to `[a-z0-9-]`, so a prefixed name
//     never goes through `name=`.
//
// To bake another ion icon: add its name to the generator list, regenerate the entry with
// `buildIconSvg(ionSet, name)` (the guardrail test prints the stale one) and paste it below.
import { getIconData, iconToHTML, iconToSVG, replaceIDs } from '@iconify/utils';

/** An Iconify icon set (the `icons.json` of an `@iconify-json/*` package). */
export type IconifyJSON = Parameters<typeof getIconData>[0];

/**
 * SVG string for `name` in an Iconify set: `1em` box and `currentColor`, exactly what `ion-icon`
 * does, so an icon takes the size and the text color of its context.
 */
export function buildIconSvg(set: IconifyJSON, name: string): string | undefined {
  const data = getIconData(set, name);
  if (!data) return undefined;
  const rendered = iconToSVG(data, { width: '1em', height: '1em' });
  return iconToHTML(replaceIDs(rendered.body), { ...rendered.attributes, fill: 'currentColor' });
}

/** SVG per Ionicons name (`ion:` set), baked. */
const ION_SVGS: Record<string, string> = {
  "add":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M256 112v288m144-144H112\"/></svg>",
  "add-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M256 112v288m144-144H112\"/></svg>",
  "close":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"currentColor\" d=\"m289.94 256l95-95A24 24 0 0 0 351 127l-95 95l-95-95a24 24 0 0 0-34 34l95 95l-95 95a24 24 0 1 0 34 34l95-95l95 95a24 24 0 0 0 34-34Z\"/></svg>",
  "close-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M368 368L144 144m224 0L144 368\"/></svg>",
  "chevron-forward":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"48\" d=\"m184 112l144 144l-144 144\"/></svg>",
  "chevron-back":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"48\" d=\"M328 112L184 256l144 144\"/></svg>",
  "chevron-forward-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"48\" d=\"m184 112l144 144l-144 144\"/></svg>",
  "chevron-back-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"48\" d=\"M328 112L184 256l144 144\"/></svg>",
  "chevron-down-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"48\" d=\"m112 184l144 144l144-144\"/></svg>",
  "chevron-expand-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m136 208l120-104l120 104m-240 96l120 104l120-104\"/></svg>",
  "home-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M80 212v236a16 16 0 0 0 16 16h96V328a24 24 0 0 1 24-24h80a24 24 0 0 1 24 24v136h96a16 16 0 0 0 16-16V212\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M480 256L266.89 52c-5-5.28-16.69-5.34-21.78 0L32 256m368-77V64h-48v69\"/></svg>",
  "settings-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4M416.39 256a154 154 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.5 164.5 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155 155 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.5 164.5 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155 155 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47\"/></svg>",
  "person-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M344 144c-3.92 52.87-44 96-88 96s-84.15-43.12-88-96c-4-55 35-96 88-96s92 42 88 96\"/><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 304c-87 0-175.3 48-191.64 138.6C62.39 453.52 68.57 464 80 464h352c11.44 0 17.62-10.48 15.65-21.4C431.3 352 343 304 256 304Z\"/></svg>",
  "person-circle-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"currentColor\" d=\"M258.9 48C141.92 46.42 46.42 141.92 48 258.9c1.56 112.19 92.91 203.54 205.1 205.1c117 1.6 212.48-93.9 210.88-210.88C462.44 140.91 371.09 49.56 258.9 48m126.42 327.25a4 4 0 0 1-6.14-.32a124.3 124.3 0 0 0-32.35-29.59C321.37 329 289.11 320 256 320s-65.37 9-90.83 25.34a124.2 124.2 0 0 0-32.35 29.58a4 4 0 0 1-6.14.32A175.32 175.32 0 0 1 80 259c-1.63-97.31 78.22-178.76 175.57-179S432 158.81 432 256a175.32 175.32 0 0 1-46.68 119.25\"/><path fill=\"currentColor\" d=\"M256 144c-19.72 0-37.55 7.39-50.22 20.82s-19 32-17.57 51.93C191.11 256 221.52 288 256 288s64.83-32 67.79-71.24c1.48-19.74-4.8-38.14-17.68-51.82C293.39 151.44 275.59 144 256 144\"/></svg>",
  "log-out-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M304 336v40a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V136a40 40 0 0 1 40-40h152c22.09 0 48 17.91 48 40v40m64 160l80-80l-80-80m-192 80h256\"/></svg>",
  "log-in-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M192 176v-40a40 40 0 0 1 40-40h160a40 40 0 0 1 40 40v240a40 40 0 0 1-40 40H240c-22.09 0-48-17.91-48-40v-40\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m288 336l80-80l-80-80M80 256h272\"/></svg>",
  "menu-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M80 160h352M80 256h352M80 352h352\"/></svg>",
  "notifications-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M427.68 351.43C402 320 383.87 304 383.87 217.35C383.87 138 343.35 109.73 310 96c-4.43-1.82-8.6-6-9.95-10.55C294.2 65.54 277.8 48 256 48s-38.21 17.55-44 37.47c-1.35 4.6-5.52 8.71-9.95 10.53c-33.39 13.75-73.87 41.92-73.87 121.35C128.13 304 110 320 84.32 351.43C73.68 364.45 83 384 101.61 384h308.88c18.51 0 27.77-19.61 17.19-32.57M320 384v16a64 64 0 0 1-128 0v-16\"/></svg>",
  "sunny-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 48v48m0 320v48m147.08-355.08l-33.94 33.94M142.86 369.14l-33.94 33.94M464 256h-48m-320 0H48m355.08 147.08l-33.94-33.94M142.86 142.86l-33.94-33.94\"/><circle cx=\"256\" cy=\"256\" r=\"80\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\"/></svg>",
  "moon-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M160 136c0-30.62 4.51-61.61 16-88C99.57 81.27 48 159.32 48 248c0 119.29 96.71 216 216 216c88.68 0 166.73-51.57 200-128c-26.39 11.49-57.38 16-88 16c-119.29 0-216-96.71-216-216\"/></svg>",
  "contrast-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><circle cx=\"256\" cy=\"256\" r=\"208\" fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\"/><path fill=\"currentColor\" d=\"M256 464c-114.88 0-208-93.12-208-208S141.12 48 256 48Z\"/></svg>",
  "arrow-back-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"48\" d=\"M244 400L100 256l144-144M120 256h292\"/></svg>",
  "cart-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><circle cx=\"176\" cy=\"416\" r=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\"/><circle cx=\"400\" cy=\"416\" r=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M48 80h64l48 272h256\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M160 288h249.44a8 8 0 0 0 7.85-6.43l28.8-144a8 8 0 0 0-7.85-9.57H128\"/></svg>",
  "cart":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><circle cx=\"176\" cy=\"416\" r=\"32\" fill=\"currentColor\"/><circle cx=\"400\" cy=\"416\" r=\"32\" fill=\"currentColor\"/><path fill=\"currentColor\" d=\"M456.8 120.78a23.92 23.92 0 0 0-18.56-8.78H133.89l-6.13-34.78A16 16 0 0 0 112 64H48a16 16 0 0 0 0 32h50.58l45.66 258.78A16 16 0 0 0 160 368h256a16 16 0 0 0 0-32H173.42l-5.64-32h241.66A24.07 24.07 0 0 0 433 284.71l28.8-144a24 24 0 0 0-5-19.93\"/></svg>",
  "cash-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"448\" height=\"256\" x=\"32\" y=\"80\" fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"16\" ry=\"16\" transform=\"matrix(-1 0 0 -1 512 416)\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M64 384h384M96 432h320\"/><circle cx=\"256\" cy=\"208\" r=\"80\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M480 160a80 80 0 0 1-80-80M32 160a80 80 0 0 0 80-80m368 176a80 80 0 0 0-80 80M32 256a80 80 0 0 1 80 80\"/></svg>",
  "receipt-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M160 336V48l32 16l32-16l31.94 16l32.37-16L320 64l31.79-16l31.93 16L416 48l32.01 16L480 48v224\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M480 272v112a80 80 0 0 1-80 80a80 80 0 0 1-80-80v-48H48a15.86 15.86 0 0 0-16 16c0 64 6.74 112 80 112h288\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M224 144h192m-128 80h128\"/></svg>",
  "cube-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M448 341.37V170.61A32 32 0 0 0 432.11 143l-152-88.46a47.94 47.94 0 0 0-48.24 0L79.89 143A32 32 0 0 0 64 170.61v170.76A32 32 0 0 0 79.89 369l152 88.46a48 48 0 0 0 48.24 0l152-88.46A32 32 0 0 0 448 341.37\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m69 153.99l187 110l187-110m-187 310v-200\"/></svg>",
  "grid-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"176\" height=\"176\" x=\"48\" y=\"48\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"20\" ry=\"20\"/><rect width=\"176\" height=\"176\" x=\"288\" y=\"48\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"20\" ry=\"20\"/><rect width=\"176\" height=\"176\" x=\"48\" y=\"288\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"20\" ry=\"20\"/><rect width=\"176\" height=\"176\" x=\"288\" y=\"288\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"20\" ry=\"20\"/></svg>",
  "apps-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"80\" height=\"80\" x=\"64\" y=\"64\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"216\" y=\"64\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"368\" y=\"64\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"64\" y=\"216\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"216\" y=\"216\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"368\" y=\"216\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"64\" y=\"368\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"216\" y=\"368\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><rect width=\"80\" height=\"80\" x=\"368\" y=\"368\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/></svg>",
  "people-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M402 168c-2.93 40.67-33.1 72-66 72s-63.12-31.32-66-72c-3-42.31 26.37-72 66-72s69 30.46 66 72\"/><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M336 304c-65.17 0-127.84 32.37-143.54 95.41c-2.08 8.34 3.15 16.59 11.72 16.59h263.65c8.57 0 13.77-8.25 11.72-16.59C463.85 335.36 401.18 304 336 304Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M200 185.94c-2.34 32.48-26.72 58.06-53 58.06s-50.7-25.57-53-58.06C91.61 152.15 115.34 128 147 128s55.39 24.77 53 57.94\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M206 306c-18.05-8.27-37.93-11.45-59-11.45c-52 0-102.1 25.85-114.65 76.2c-1.65 6.66 2.53 13.25 9.37 13.25H154\"/></svg>",
  "storefront-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M448 448V240m-384 0v208M382.47 48H129.53c-21.79 0-41.47 12-49.93 30.46L36.3 173c-14.58 31.81 9.63 67.85 47.19 69h2c31.4 0 56.85-25.18 56.85-52.23c0 27 25.46 52.23 56.86 52.23s56.8-23.38 56.8-52.23c0 27 25.45 52.23 56.85 52.23s56.86-23.38 56.86-52.23c0 28.85 25.45 52.23 56.85 52.23h1.95c37.56-1.17 61.77-37.21 47.19-69l-43.3-94.54C423.94 60 404.26 48 382.47 48M32 464h448M136 288h80a24 24 0 0 1 24 24v88h0h-128h0v-88a24 24 0 0 1 24-24m152 176V312a24 24 0 0 1 24-24h64a24 24 0 0 1 24 24v152\"/></svg>",
  "calendar-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"416\" height=\"384\" x=\"48\" y=\"80\" fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"48\"/><circle cx=\"296\" cy=\"232\" r=\"24\" fill=\"currentColor\"/><circle cx=\"376\" cy=\"232\" r=\"24\" fill=\"currentColor\"/><circle cx=\"296\" cy=\"312\" r=\"24\" fill=\"currentColor\"/><circle cx=\"376\" cy=\"312\" r=\"24\" fill=\"currentColor\"/><circle cx=\"136\" cy=\"312\" r=\"24\" fill=\"currentColor\"/><circle cx=\"216\" cy=\"312\" r=\"24\" fill=\"currentColor\"/><circle cx=\"136\" cy=\"392\" r=\"24\" fill=\"currentColor\"/><circle cx=\"216\" cy=\"392\" r=\"24\" fill=\"currentColor\"/><circle cx=\"296\" cy=\"392\" r=\"24\" fill=\"currentColor\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M128 48v32m256-32v32\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M464 160H48\"/></svg>",
  "time-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 64C150 64 64 150 64 256s86 192 192 192s192-86 192-192S362 64 256 64Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M256 128v144h96\"/></svg>",
  "search-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M221.09 64a157.09 157.09 0 1 0 157.09 157.09A157.1 157.1 0 0 0 221.09 64Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M338.29 338.29L448 448\"/></svg>",
  "checkmark-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M416 128L192 384l-96-96\"/></svg>",
  "checkmark-circle-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192s192-86 192-192Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M352 176L217.6 336L160 272\"/></svg>",
  "alert-circle-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192s192-86 192-192Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M250.26 166.05L256 288l5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 6\"/><path fill=\"currentColor\" d=\"M256 367.91a20 20 0 1 1 20-20a20 20 0 0 1-20 20\"/></svg>",
  "warning-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M85.57 446.25h340.86a32 32 0 0 0 28.17-47.17L284.18 82.58c-12.09-22.44-44.27-22.44-56.36 0L57.4 399.08a32 32 0 0 0 28.17 47.17\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m250.26 195.39l5.74 122l5.73-121.95a5.74 5.74 0 0 0-5.79-6h0a5.74 5.74 0 0 0-5.68 5.95\"/><path fill=\"currentColor\" d=\"M256 397.25a20 20 0 1 1 20-20a20 20 0 0 1-20 20\"/></svg>",
  "information-circle-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M248 64C146.39 64 64 146.39 64 248s82.39 184 184 184s184-82.39 184-184S349.61 64 248 64Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M220 220h32v116\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M208 340h88\"/><path fill=\"currentColor\" d=\"M248 130a26 26 0 1 0 26 26a26 26 0 0 0-26-26\"/></svg>",
  "help-circle-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 80a176 176 0 1 0 176 176A176 176 0 0 0 256 80Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"28\" d=\"M200 202.29s.84-17.5 19.57-32.57C230.68 160.77 244 158.18 256 158c10.93-.14 20.69 1.67 26.53 4.45c10 4.76 29.47 16.38 29.47 41.09c0 26-17 37.81-36.37 50.8S251 281.43 251 296\"/><circle cx=\"250\" cy=\"348\" r=\"20\" fill=\"currentColor\"/></svg>",
  "cloud-offline-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M93.72 183.25C49.49 198.05 16 233.1 16 288c0 66 54 112 120 112h184.37m147.45-22.26C485.24 363.3 496 341.61 496 312c0-59.82-53-85.76-96-88c-8.89-89.54-71-144-144-144c-26.16 0-48.79 6.93-67.6 18.14\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M448 448L64 64\"/></svg>",
  "cloud-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M400 240c-8.89-89.54-71-144-144-144c-69 0-113.44 48.2-128 96c-60 6-112 43.59-112 112c0 66 54 112 120 112h260c55 0 100-27.44 100-88c0-59.82-53-85.76-96-88Z\"/></svg>",
  "refresh-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M320 146s24.36-12-64-12a160 160 0 1 0 160 160\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m256 58l80 80l-80 80\"/></svg>",
  "sync-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M434.67 285.59v-29.8c0-98.73-80.24-178.79-179.2-178.79a179 179 0 0 0-140.14 67.36m-38.53 82v29.8C76.8 355 157 435 256 435a180.45 180.45 0 0 0 140-66.92\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m32 256l44-44l46 44m358 0l-44 44l-46-44\"/></svg>",
  "backspace-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M135.19 390.14a28.8 28.8 0 0 0 21.68 9.86h246.26A29 29 0 0 0 432 371.13V140.87A29 29 0 0 0 403.13 112H156.87a28.84 28.84 0 0 0-21.67 9.84L46.33 256l88.86 134.11Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M336.67 192.33L206.66 322.34m130.01 0L206.66 192.33m130.01 0L206.66 322.34m130.01 0L206.66 192.33\"/></svg>",
  "keypad-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><circle cx=\"256\" cy=\"448\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><circle cx=\"256\" cy=\"320\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M288 192a32 32 0 1 1-32-32a32 32 0 0 1 32 32Z\"/><circle cx=\"256\" cy=\"64\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><circle cx=\"384\" cy=\"320\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><circle cx=\"384\" cy=\"192\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><circle cx=\"384\" cy=\"64\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><circle cx=\"128\" cy=\"320\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><circle cx=\"128\" cy=\"192\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/><circle cx=\"128\" cy=\"64\" r=\"32\" fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\"/></svg>",
  "trash-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m112 112l20 320c.95 18.49 14.4 32 32 32h184c17.67 0 30.87-13.51 32-32l20-320\"/><path fill=\"currentColor\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M80 112h352\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M192 112V72h0a23.93 23.93 0 0 1 24-24h80a23.93 23.93 0 0 1 24 24h0v40m-64 64v224m-72-224l8 224m136-224l-8 224\"/></svg>",
  "create-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h167.48\"/><path fill=\"currentColor\" d=\"M459.94 53.25a16.06 16.06 0 0 0-23.22-.56L424.35 65a8 8 0 0 0 0 11.31l11.34 11.32a8 8 0 0 0 11.34 0l12.06-12c6.1-6.09 6.67-16.01.85-22.38M399.34 90L218.82 270.2a9 9 0 0 0-2.31 3.93L208.16 299a3.91 3.91 0 0 0 4.86 4.86l24.85-8.35a9 9 0 0 0 3.93-2.31L422 112.66a9 9 0 0 0 0-12.66l-9.95-10a9 9 0 0 0-12.71 0\"/></svg>",
  "ellipsis-vertical":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><circle cx=\"256\" cy=\"256\" r=\"48\" fill=\"currentColor\"/><circle cx=\"256\" cy=\"416\" r=\"48\" fill=\"currentColor\"/><circle cx=\"256\" cy=\"96\" r=\"48\" fill=\"currentColor\"/></svg>",
  "language-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M48 112h288M192 64v48m80 336l96-224l96 224m-162.5-64h133M281.3 112S257 206 199 277S80 384 80 384\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M256 336s-35-27-72-75s-56-85-56-85\"/></svg>",
  "lock-closed-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M336 208v-95a80 80 0 0 0-160 0v95\"/><rect width=\"320\" height=\"272\" x=\"96\" y=\"208\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"48\" ry=\"48\"/></svg>",
  "wallet-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"416\" height=\"288\" x=\"48\" y=\"144\" fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"48\" ry=\"48\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M411.36 144v-30A50 50 0 0 0 352 64.9L88.64 109.85A50 50 0 0 0 48 159v49\"/><path fill=\"currentColor\" d=\"M368 320a32 32 0 1 1 32-32a32 32 0 0 1-32 32\"/></svg>",
  "card-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"416\" height=\"320\" x=\"48\" y=\"96\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"56\" ry=\"56\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"60\" d=\"M48 192h416M128 300h48v20h-48z\"/></svg>",
  "qr-code-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"80\" height=\"80\" x=\"336\" y=\"336\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"64\" height=\"64\" x=\"272\" y=\"272\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"64\" height=\"64\" x=\"416\" y=\"416\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"48\" height=\"48\" x=\"432\" y=\"272\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"48\" height=\"48\" x=\"272\" y=\"432\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"80\" height=\"80\" x=\"336\" y=\"96\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"176\" height=\"176\" x=\"288\" y=\"48\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"16\" ry=\"16\"/><rect width=\"80\" height=\"80\" x=\"96\" y=\"96\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"176\" height=\"176\" x=\"48\" y=\"48\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"16\" ry=\"16\"/><rect width=\"80\" height=\"80\" x=\"96\" y=\"336\" fill=\"currentColor\" rx=\"8\" ry=\"8\"/><rect width=\"176\" height=\"176\" x=\"48\" y=\"288\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"16\" ry=\"16\"/></svg>",
  "funnel":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"currentColor\" d=\"M296 464a23.9 23.9 0 0 1-7.55-1.23L208.3 436.1a23.92 23.92 0 0 1-16.3-22.78V294.11a.4.4 0 0 0-.09-.13L23.26 97.54A30 30 0 0 1 46.05 48H466a30 30 0 0 1 22.79 49.54L320.09 294a1 1 0 0 0-.09.13V440a23.93 23.93 0 0 1-24 24\"/></svg>",
  "ellipse":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"currentColor\" d=\"M256 464c-114.69 0-208-93.31-208-208S141.31 48 256 48s208 93.31 208 208s-93.31 208-208 208\"/></svg>",
  "copy-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"336\" height=\"336\" x=\"128\" y=\"128\" fill=\"none\" stroke=\"currentColor\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"57\" ry=\"57\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m383.5 128l.5-24a56.16 56.16 0 0 0-56-56H112a64.19 64.19 0 0 0-64 64v216a56.16 56.16 0 0 0 56 56h24\"/></svg>",
  "download-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M336 176h40a40 40 0 0 1 40 40v208a40 40 0 0 1-40 40H136a40 40 0 0 1-40-40V216a40 40 0 0 1 40-40h40\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m176 272l80 80l80-80M256 48v288\"/></svg>",
  "globe-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208s208-93.13 208-208S370.87 48 256 48Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 48c-58.07 0-112.67 93.13-112.67 208S197.93 464 256 464s112.67-93.13 112.67-208S314.07 48 256 48Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M117.33 117.33c38.24 27.15 86.38 43.34 138.67 43.34s100.43-16.19 138.67-43.34m0 277.34c-38.24-27.15-86.38-43.34-138.67-43.34s-100.43 16.19-138.67 43.34\"/><path fill=\"none\" stroke=\"currentColor\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 48v416m208-208H48\"/></svg>",
  "mail-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><rect width=\"416\" height=\"320\" x=\"48\" y=\"96\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" rx=\"40\" ry=\"40\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"m112 160l144 112l144-112\"/></svg>",
  "chatbubbles-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M431 320.6c-1-3.6 1.2-8.6 3.3-12.2a34 34 0 0 1 2.1-3.1A162 162 0 0 0 464 215c.3-92.2-77.5-167-173.7-167c-83.9 0-153.9 57.1-170.3 132.9a160.7 160.7 0 0 0-3.7 34.2c0 92.3 74.8 169.1 171 169.1c15.3 0 35.9-4.6 47.2-7.7s22.5-7.2 25.4-8.3a26.4 26.4 0 0 1 9.3-1.7a26 26 0 0 1 10.1 2l56.7 20.1a13.5 13.5 0 0 0 3.9 1a8 8 0 0 0 8-8a13 13 0 0 0-.5-2.7Z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M66.46 232a146.23 146.23 0 0 0 6.39 152.67c2.31 3.49 3.61 6.19 3.21 8s-11.93 61.87-11.93 61.87a8 8 0 0 0 2.71 7.68A8.17 8.17 0 0 0 72 464a7.3 7.3 0 0 0 2.91-.6l56.21-22a15.7 15.7 0 0 1 12 .2c18.94 7.38 39.88 12 60.83 12A159.2 159.2 0 0 0 284 432.11\"/></svg>",
  "speedometer-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"currentColor\" d=\"m326.1 231.9l-47.5 75.5a31 31 0 0 1-7 7a30.11 30.11 0 0 1-35-49l75.5-47.5a10.23 10.23 0 0 1 11.7 0a10.06 10.06 0 0 1 2.3 14\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M256 64C132.3 64 32 164.2 32 287.9a223.18 223.18 0 0 0 56.3 148.5c1.1 1.2 2.1 2.4 3.2 3.5a25.19 25.19 0 0 0 37.1-.1a173.13 173.13 0 0 1 254.8 0a25.19 25.19 0 0 0 37.1.1l3.2-3.5A223.18 223.18 0 0 0 480 287.9C480 164.2 379.7 64 256 64\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"32\" d=\"M256 128v32m160 128h-32m-256 0H96m69.49-90.51l-22.63-22.63m203.65 22.63l22.63-22.63\"/></svg>",
  "wifi-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\"><path d=\"M318.586 363.5L256 424l-62.586-60.5S212 336 256 336s62.586 27.5 62.586 27.5M407.31 278L372 312s-41-46-116-46s-116 46-116 46l-35.31-34S142.5 214 256 214s151.31 64 151.31 64\"/><path d=\"m496 192l-36.69 35.5S386.5 141 256 141S52.69 227.5 52.69 227.5L16 192S88 88 256 88s240 104 240 104\"/></g></svg>",
  "code-slash-outline":
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 512 512\" fill=\"currentColor\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"32\" d=\"M160 368L32 256l128-112m192 224l128-112l-128-112m-48-48l-96 320\"/></svg>",
};

/** Sets wired for `prefix:name`. Each loader is a dynamic import: an unused set is never fetched. */
export const ICON_SETS: Record<string, () => Promise<IconifyJSON>> = {
  ion: async () => (await import('@iconify-json/ion/icons.json')).default as unknown as IconifyJSON,
  'material-symbols': async () =>
    (await import('@iconify-json/material-symbols/icons.json')).default as unknown as IconifyJSON,
  mdi: async () => (await import('@iconify-json/mdi/icons.json')).default as unknown as IconifyJSON,
};

/** SVG by Ionicons name, for `addIcons()` (the `ok-*` components paint by `name=`). */
export function iconRegistry(): Record<string, string> {
  return { ...ION_SVGS };
}

const loaded = new Map<string, IconifyJSON>();
/** Resolved lazily-loaded icons, by full `prefix:name`. */
const cache = new Map<string, string>();

function split(name: string): { prefix: string; icon: string } | undefined {
  if (!name) return undefined;
  const at = name.indexOf(':');
  const prefix = at === -1 ? 'ion' : name.slice(0, at);
  const icon = at === -1 ? name : name.slice(at + 1);
  return icon && prefix in ICON_SETS ? { prefix, icon } : undefined;
}

/**
 * Synchronous lookup: baked `ion:` icons and anything already loaded by `resolveIconAsync`.
 * `undefined` when the prefix is unknown or the icon is not available (yet).
 */
export function resolveIcon(name: string): string | undefined {
  const parsed = split(name);
  if (!parsed) return undefined;
  const key = `${parsed.prefix}:${parsed.icon}`;
  if (cache.has(key)) return cache.get(key);
  if (parsed.prefix === 'ion' && parsed.icon in ION_SVGS) return ION_SVGS[parsed.icon];
  return undefined;
}

/** Loads the set of `name` if needed and resolves it. `undefined` for an unknown prefix or icon. */
export async function resolveIconAsync(name: string): Promise<string | undefined> {
  const parsed = split(name);
  if (!parsed) return undefined;
  const key = `${parsed.prefix}:${parsed.icon}`;
  const known = resolveIcon(name);
  if (known) return known;
  let set = loaded.get(parsed.prefix);
  if (!set) {
    set = await ICON_SETS[parsed.prefix]();
    loaded.set(parsed.prefix, set);
  }
  const svg = buildIconSvg(set, parsed.icon);
  if (svg) cache.set(key, svg);
  return svg;
}
