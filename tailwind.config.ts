import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          primary: "var(--accent-primary)",
          secondary: "var(--accent-secondary)",
          tertiary: "var(--accent-tertiary)",
        },
        status: {
          green: "var(--status-green)",
          yellow: "var(--status-yellow)",
          orange: "var(--status-orange)",
          red: "var(--status-red)",
        },
        metric: {
          readiness: "var(--metric-readiness)",
          energy: "var(--metric-energy)",
          fatigue: "var(--metric-fatigue)",
          stress: "var(--metric-stress)",
          sleep: "var(--metric-sleep-score)",
          load: "var(--metric-load)",
        }
      },
    },
  },
  plugins: [],
};
export default config;
