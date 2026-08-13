import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@/app': path.resolve(__dirname, './src/app'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    // Lets `VITE_API_BASE_URL=""` work in dev too (relative `/api/...`, same-origin) — the same
    // trick `netlify.toml` uses in prod, needed so a single ngrok tunnel on :5173 can reach the
    // backend without a second tunnel/CORS/cross-site cookie setup.
    proxy: {
      '/api': { target: 'http://localhost:5253', changeOrigin: true },
    },
    // Vite rejects requests whose Host header it doesn't recognize; ngrok's random subdomains
    // need to be allow-listed or the dev server returns "Blocked request".
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
  },
})
