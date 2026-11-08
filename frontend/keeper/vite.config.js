import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  base: '/keeper/',
  css: { postcss: { plugins: [] } },
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: '../public/keeper', emptyOutDir: true },
  server: { port: 3002, proxy: { '/api': { target: process.env.VITE_API_PROXY_TARGET || 'https://tokenliberty.site', changeOrigin: true } } },
})
