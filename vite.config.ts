import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

// Mobile-first PWA. Capacitor-ready: build output goes to dist/ with no
// absolute-path assumptions, so `npx cap add ios|android` later needs no rewrite.
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      // TEMPORARY: self-destroying service worker. Previous SW builds got stuck
      // serving stale code on installed PWAs, and clearing browser data doesn't
      // remove an installed SW — so updates never reached the user. A
      // self-destroying SW makes every browser unregister the old worker and
      // clear its caches, guaranteeing fresh code from the network. Offline
      // support is off for now; a robust offline layer returns before release.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'National Team Manager',
        short_name: 'NTM',
        description: 'Pick a nation, build a squad, chase wonderkids, win the World Cup.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}'],
        // Offline-first: everything is cached; the game runs with no network.
        navigateFallback: 'index.html',
      },
    }),
  ],
})
