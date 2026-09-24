import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Frontend calls /api/* in dev; Vite forwards it to the Express backend.
      // Set VITE_API_BASE_URL instead if you deploy frontend/backend separately.
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
