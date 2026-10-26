import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      colors: {
        ink: { 950: "#07070d", 900: "#0b0b14", 850: "#10101c", 800: "#141424", 700: "#1c1c31", 600: "#26264a", 500: "#35355f" },
        prism: { violet: "#7c3aed", cyan: "#06b6d4", magenta: "#d946ef", pink: "#ec4899" },
      },
      boxShadow: {
        glow: "0 0 24px rgba(124,58,237,.45)",
        card: "0 8px 32px rgba(0,0,0,.45)",
        pop: "0 12px 40px rgba(0,0,0,.55)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        pulseDot: { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: ".5", transform: "scale(.8)" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        rise: "rise .35s cubic-bezier(.22,1,.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
