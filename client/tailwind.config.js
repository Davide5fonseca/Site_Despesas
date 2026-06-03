/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Tipografia com carácter, com fallbacks de sistema
        sans: ["Sora", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // Paleta "teal/petróleo" sobre fundo escuro azulado — distinta do look genérico
        marca: {
          50: "#effcf9",
          100: "#cbf5ec",
          200: "#99ebda",
          300: "#5fd9c3",
          400: "#2bbfa6",
          500: "#14a08a",
          600: "#0f766e",
          700: "#115e59",
          800: "#134e4a",
          900: "#0b3b39",
        },
        noite: {
          900: "#0b1120",
          800: "#111a2e",
          700: "#1b263f",
          600: "#27324f",
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
