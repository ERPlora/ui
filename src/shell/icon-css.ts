// CSS for <HubIcon> (V5): it must look exactly like `ion-icon`. The box rules and the `--ion-color-*`
// hook are copied from `ionicons` (icon.css / ion-icon.entry), the slot rules from `ion-button`'s
// ios stylesheet (the shell pins `mode: 'ios'`). `ion-button` styles slotted `ion-icon` by tag name,
// so a different element needs the same rules spelled for its own class.
//
// Difference from ion-icon, on purpose: that component keeps these rules in its shadow root, we
// ship them as one global stylesheet string for HubIcon to inject once.

/** Class carried by the element HubIcon renders. */
export const ICON_CLASS = 'hub-icon';

/** Ionic palette names that `ion-icon` understands through its `color` prop. */
export const ICON_COLORS = [
  'primary',
  'secondary',
  'tertiary',
  'success',
  'warning',
  'danger',
  'light',
  'medium',
  'dark',
] as const;

const FALLBACKS: Record<(typeof ICON_COLORS)[number], string> = {
  primary: '#3880ff',
  secondary: '#0cd1e8',
  tertiary: '#f4a942',
  success: '#10dc60',
  warning: '#ffce00',
  danger: '#f14141',
  light: '#f4f5f8',
  medium: '#989aa2',
  dark: '#222428',
};

const colorRules = ICON_COLORS.map(
  (c) => `.${ICON_CLASS}.ion-color-${c} { --ion-color-base: var(--ion-color-${c}, ${FALLBACKS[c]}); }`,
).join('\n');

/** The stylesheet text. */
export const ICON_CSS = `.${ICON_CLASS} {
  display: inline-block;
  width: 1em;
  height: 1em;
  font-size: 1em;
  contain: layout style;
  fill: currentColor;
  box-sizing: content-box !important;
}

.${ICON_CLASS} > svg {
  display: block;
  width: 100%;
  height: 100%;
}

.${ICON_CLASS}.ion-color {
  color: var(--ion-color-base) !important;
}
${colorRules}

ion-button .${ICON_CLASS} {
  font-size: 1.35em;
  pointer-events: none;
}

ion-button .${ICON_CLASS}[slot="start"] {
  margin-inline: -0.3em 0.3em;
  margin-block: 0;
}

ion-button .${ICON_CLASS}[slot="end"] {
  margin-inline: 0.3em -0.2em;
  margin-block: 0;
}

ion-button .${ICON_CLASS}[slot="icon-only"] {
  font-size: clamp(15.12px, 1.125em, 43.02px);
}
`;
