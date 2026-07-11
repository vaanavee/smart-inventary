/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#ea580c",
          light: "#f97316",
          dark: "#c2410c",
        },
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-alt": "rgb(var(--color-surface-alt) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        hairline: "rgb(var(--color-hairline) / <alpha-value>)",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
        info: "#0284c7",
        violet: "#7c3aed",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "14px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, .06)",
        lift: "0 10px 25px -5px rgba(15, 23, 42, .15)",
        glow: "0 0 0 1px rgba(234,88,12,0.25), 0 0 24px rgba(234,88,12,0.3)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
        "gradient-radial-soft":
          "radial-gradient(120% 120% at 0% 0%, rgba(234,88,12,0.06) 0%, rgba(234,88,12,0) 60%)",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        scanLine: {
          "0%": { transform: "translateY(0%)" },
          "100%": { transform: "translateY(100%)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(234,88,12,0.35)" },
          "50%": { boxShadow: "0 0 0 8px rgba(234,88,12,0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease-out both",
        slideUp: "slideUp 0.45s cubic-bezier(0.16,1,0.3,1) both",
        scanLine: "scanLine 2.2s linear infinite",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
