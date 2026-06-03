import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Despesas da Casa",
        short_name: "Despesas",
        description: "Registo de despesas partilhado da casa, com leitura de talões por IA",
        lang: "pt-PT",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        theme_color: "#0f766e",
        background_color: "#0b1120",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Faz cache do shell da app (HTML/JS/CSS/ícones) para abrir offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        // A leitura de talões (POST /api/talao) precisa de internet e NÃO é
        // cacheada. As leituras GET da API usam rede-primeiro com fallback.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith("/api") && request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // service worker só no build de produção
      },
    }),
  ],
  server: {
    host: true, // 0.0.0.0 -> acessível na rede Wi-Fi local
    port: 5173,
    proxy: {
      // Encaminha /api para o backend Express (funciona também a partir do telemóvel,
      // pois o proxy corre no PC que serve o Vite).
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
