import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The production CSP in index.html is strict (connect-src 'none', no inline scripts).
 * The Vite dev server needs an inline React Refresh preamble and a websocket for HMR,
 * so the CSP is relaxed ONLY when serving in dev. `vite build` keeps index.html untouched.
 */
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function devCsp(): Plugin {
  return {
    name: "space-studio-dev-csp",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/,
        `$1${DEV_CSP}$2`,
      );
    },
  };
}

export default defineConfig({
  root: ".",
  base: "./",
  plugins: [react(), devCsp()],
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
    target: "chrome130",
    // Fonts are emitted as files; small ones may be inlined as data: (allowed by font-src).
    assetsInlineLimit: 4096,
    rollupOptions: { input: "index.html" },
  },
  server: { port: 5173, strictPort: true },
});
