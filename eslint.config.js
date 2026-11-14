import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

const restricted = ["fetch", "EventSource", "WebSocket", "XMLHttpRequest"].map((name) => ({
  name,
  message: "Network access goes through the SDK (src/sdk).",
}));

export default [
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    // `slot="start|end|icon-only|action"` on ion-* (and on HubIcon, which renders ion-icon) is the
    // Web Components slot of Ionic, not Vue 2's deprecated slot syntax.
    files: ["**/*.vue"],
    rules: { "vue/no-deprecated-slot-attribute": ["error", { ignore: ["/^ion-/", "HubIcon"] }] },
  },
  {
    files: ["src/**/*.ts", "src/**/*.vue"],
    ignores: ["src/sdk/**"],
    rules: { "no-restricted-globals": ["error", ...restricted] },
  },
  // A function a person can follow. The ones that already broke these limits are frozen in
  // eslint-suppressions.json, which ESLint fails on once a suppression is no longer needed.
  {
    rules: {
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      "max-params": ["error", 3],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
    },
  },
  // A test's describe block is one long function, and a test helper takes what the case needs.
  {
    files: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/e2e/**"],
    rules: { "max-params": "off", "max-lines-per-function": "off" },
  },
];
