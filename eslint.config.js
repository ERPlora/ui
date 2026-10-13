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
    files: ["src/**/*.ts", "src/**/*.vue"],
    ignores: ["src/sdk/**"],
    rules: { "no-restricted-globals": ["error", ...restricted] },
  },
];
