/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Marca (teal + azul-marinho do logótipo ScanWise) — funciona em ambos os temas.
        // A ponta escura (800/900) é o marinho, para os gradientes irem teal -> marinho.
        marca: {
          50: "#f1f8f9",
          100: "#dcedf0",
          200: "#bbdbe1",
          300: "#8fc1cb",
          400: "#5aa0ad",
          500: "#347d8e", // teal do logo
          600: "#2b6575",
          700: "#264f5e",
          800: "#21405a",
          900: "#1c3856", // marinho do logo
        },
        // Azul-marinho do logótipo, para superfícies/realces profundos.
        marinho: "#1c3856",
        // Texto de marca com contraste adequado por tema (claro vs escuro)
        marcatxt: "rgb(var(--marca-txt) / <alpha-value>)",
        // "Linha"/overlay (branco no escuro, escuro no claro) — para bordas/hover
        linha: "rgb(var(--linha) / <alpha-value>)",
        // Superfícies (temáveis via variáveis CSS)
        noite: {
          900: "rgb(var(--noite-900) / <alpha-value>)",
          800: "rgb(var(--noite-800) / <alpha-value>)",
          700: "rgb(var(--noite-700) / <alpha-value>)",
          600: "rgb(var(--noite-600) / <alpha-value>)",
        },
        // Texto (sobrepõe a escala slate por tokens temáveis)
        slate: {
          100: "rgb(var(--slate-100) / <alpha-value>)",
          200: "rgb(var(--slate-200) / <alpha-value>)",
          300: "rgb(var(--slate-300) / <alpha-value>)",
          400: "rgb(var(--slate-400) / <alpha-value>)",
          500: "rgb(var(--slate-500) / <alpha-value>)",
          600: "rgb(var(--slate-600) / <alpha-value>)",
        },
      },
      boxShadow: {
        cartao: "0 10px 30px -12px rgba(0,0,0,0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
