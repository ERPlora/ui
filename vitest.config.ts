import { defineConfig } from "vitest/config";

import { erploraVite } from "./src/vite";

export default defineConfig({
  // The plugins every project builds with (`erploraVite()`): Vue SFCs and the baked `~icons/*`.
  plugins: erploraVite(),
  test: {
    environment: "happy-dom",
    // Installed from the Hub's workspace, ionicons lives outside this package's own pnpm workspace, where Vite
    // refuses to read it: Node loads it instead.
    server: { deps: { external: ["ionicons"] } },
    // happy-dom with the browser behaviour Ionic relies on (src/testing/happyDom.ts).
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "*.config.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
