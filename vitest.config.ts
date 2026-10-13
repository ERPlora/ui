import { defineConfig } from "vitest/config";

import { erploraVite } from "./src/vite";

export default defineConfig({
  // The plugins every project builds with (`erploraVite()`): Vue SFCs and the baked `~icons/*`.
  plugins: erploraVite(),
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "*.config.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
