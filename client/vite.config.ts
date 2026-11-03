import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Proxies /api to the backend so the client is same-origin in dev and the SameSite=Lax session
  // cookie is sent on every request.
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
    include: ["test/**/*.test.tsx", "test/**/*.test.ts"],
  },
});
