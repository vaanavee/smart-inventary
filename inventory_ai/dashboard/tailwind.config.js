/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#FF6B00",
          light: "#FF8A3D",
          dark: "#E05F00",
        },
        surface: "#F7F8FA",
        ink: "#1A1A1A",
        muted: "#6B7280",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        violet: "#8B5CF6",
      },
      borderRadius: {
        xl: "18px",
        "2xl": "22px",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(26, 26, 26, 0.04), 0 8px 24px rgba(26, 26, 26, 0.06)",
        lift: "0 12px 32px rgba(255, 107, 0, 0.14), 0 4px 12px rgba(26, 26, 26, 0.06)",
        glow: "0 0 0 1px rgba(255,107,0,0.25), 0 0 24px rgba(255,107,0,0.35)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #FF6B00 0%, #FF8A3D 100%)",
        "gradient-radial-soft":
          "radial-gradient(120% 120% at 0% 0%, rgba(255,107,0,0.08) 0%, rgba(255,107,0,0) 60%)",
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
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,107,0,0.35)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255,107,0,0)" },
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
