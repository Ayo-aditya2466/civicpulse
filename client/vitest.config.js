// CivicPulse — Vitest configuration (test-only)
//
// Deliberately separate from vite.config.js: the characterization tests exercise
// plain domain modules, so they need neither the React nor the Tailwind plugin,
// and the production build config stays untouched. Vitest prefers this file over
// vite.config.js when both exist.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No DOM is required — lib/ modules are plain JS. The one browser API they
    // touch (localStorage) is stubbed in vitest.setup.js.
    environment: "node",
    setupFiles: ["./vitest.setup.js"],
    include: ["src/**/*.test.js"],
  },
});
