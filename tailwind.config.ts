import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: { DEFAULT: "#0f3d2e", 50: "#eef6f1", 100: "#d5eadd", 200: "#a9d3ba", 600: "#1d6b4c", 700: "#155238", 800: "#0f3d2e", 900: "#0a2a20" },
        gold: { DEFAULT: "#e2a917", 100: "#fbf0cf", 300: "#f2cd5c", 500: "#e2a917", 700: "#9a6f05" },
        cream: "#f6f3ea",
        ink: "#18211d",
        ball: "#b3261e",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["ui-rounded", "SF Pro Rounded", "Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(16,40,30,.06), 0 4px 16px rgba(16,40,30,.06)" },
    },
  },
  plugins: [],
};
export default config;
