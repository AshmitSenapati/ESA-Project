import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        base: {
          950: "#05080d",
          900: "#080d14",
          800: "#0b111a",
          700: "#0f1820",
          600: "#152230",
        },
        // Borders
        border: {
          DEFAULT: "#1b2635",
          muted: "#152333",
          subtle: "#101925",
        },
        // Primary electric blue
        primary: {
          DEFAULT: "#2d9cff",
          light: "#55b8ff",
          dim: "#168ee5",
          glow: "rgba(8,120,213,0.18)",
        },
        // Muted foreground
        muted: "#64758a",
        // Semantic
        safe: "#5de5a0",
        "safe-glow": "rgba(84,224,160,0.6)",
        watch: "#ffc55c",
        "watch-glow": "rgba(255,197,92,0.6)",
        danger: "#ff6875",
        "danger-glow": "rgba(255,100,112,0.6)",
        "entry-blue": "#5cbcff",
        "exit-violet": "#9b8dff",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "dot-grid":
          "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
        "panel-grad": "linear-gradient(145deg, #0b111a, #080d14)",
        "radial-glow": "radial-gradient(circle at 50% 45%, rgba(18,48,75,0.2), transparent 48%)",
      },
      backgroundSize: {
        "dot-size": "36px 36px",
      },
      animation: {
        "pulse-safe": "pulse-safe 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "pulse-crit": "pulse-crit 1s cubic-bezier(0.4,0,0.6,1) infinite",
        "scan-line": "scan-line 3s linear infinite",
        "glow-breathe": "glow-breathe 2.5s ease-in-out infinite",
      },
      keyframes: {
        "pulse-safe": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(84,224,160,0)" },
          "50%": { boxShadow: "0 0 0 6px rgba(84,224,160,0.15)" },
        },
        "pulse-crit": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(255,104,117,0)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255,104,117,0.2)" },
        },
        "scan-line": {
          "0%": { top: "0%" },
          "100%": { top: "100%" },
        },
        "glow-breathe": {
          "0%,100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      boxShadow: {
        "brand": "0 0 30px rgba(8,120,213,0.11)",
        "panel": "0 4px 24px rgba(0,0,0,0.4)",
        "glow-safe": "0 0 20px rgba(84,224,160,0.25)",
        "glow-danger": "0 0 20px rgba(255,100,112,0.3)",
        "glow-blue": "0 0 28px rgba(45,156,255,0.2)",
      },
      borderRadius: {
        panel: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
