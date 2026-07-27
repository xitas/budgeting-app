import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  // "shared" is a linked npm workspace package built to CommonJS. Vite
  // doesn't run its CJS->ESM named-export interop on linked workspace
  // packages by default (only on real node_modules deps), so without this
  // its named exports silently resolve to `undefined` in the browser.
  optimizeDeps: {
    include: ["shared"],
  },
})
