import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `VITE_BASE` permite publicar en un subdirectorio (GitHub Pages) o empaquetar
// para escritorio con rutas relativas (`./`).
const base = process.env.VITE_BASE ?? '/';

/*
 * Marca de la compilación. Se ve en Ajustes y sirve para saber, cuando algo
 * «no aparece», si el aparato tiene la versión nueva o una copia guardada.
 */
const version = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base,
  define: { __VERSION__: JSON.stringify(version) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        // La app y el formulario de monitores son dos páginas del mismo sitio,
        // así que comparten código (formato de envío, imágenes, estilos).
        principal: resolve(__dirname, 'index.html'),
        formulario: resolve(__dirname, 'formulario/index.html'),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // La versión nueva se aplica sola y recarga. Lo que faltaba no era el
      // modo, sino comprobar si la hay: ver `src/lib/actualizacion.ts`.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        // Nunca interceptamos las llamadas a Google ni a la API de Claude.
        navigateFallbackDenylist: [/^\/api/, /googleapis\.com/, /anthropic\.com/],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        id: 'fotos-arima',
        name: 'Fotos Arima — Catálogo de manualidades',
        short_name: 'Fotos Arima',
        description:
          'Guarda, clasifica por tipo de manualidad, renombra y comparte las fotos de manualidades de tu cuenta de Google Fotos.',
        lang: 'es',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'browser'],
        orientation: 'any',
        background_color: '#faf7f2',
        theme_color: '#b4553a',
        categories: ['photo', 'productivity', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Importar fotos', short_name: 'Importar', url: `${base}#/importar` },
          { name: 'Revisar dudosas', short_name: 'Revisar', url: `${base}#/revisar` },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
