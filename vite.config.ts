import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const isElectron = process.env.BUILD_TARGET === 'electron'

export default defineConfig({
  base: isElectron ? './' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png', 'icons/*.png'],
      manifest: {
        name: 'Calorie Snap',
        short_name: 'Calorie Snap',
        description: '拍一下、扫一下，今天吃了什么就清楚了',
        theme_color: '#1d5c3a',
        background_color: '#f6f2eb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/world\.openfoodfacts\.org/,
            handler: 'NetworkFirst',
            options: { cacheName: 'off-api', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'unsplash-images', expiration: { maxEntries: 30, maxAgeSeconds: 604800 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5174',
        changeOrigin: true,
      },
    },
  },
})
