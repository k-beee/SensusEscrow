/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        serif: ["Outfit", "sans-serif"],
      },
      colors: {
        sapphire: {
          50: "#f2f7fc",
          100: "#e1edf7",
          200: "#c8def1",
          300: "#a2c9e7",
          400: "#74aed9",
          500: "#5392ca",
          600: "#3e77b6",
          700: "#33619b",
          800: "#2d5280",
          900: "#1e3a5f",
          950: "#0b1528",
        },
        platinum: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#09090b",
        }
      }
    },
  },
  plugins: [],
}
