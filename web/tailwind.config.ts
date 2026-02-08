import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-foreground) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        "secondary-foreground": "rgb(var(--secondary-foreground) / <alpha-value>)",
        destructive: "rgb(var(--destructive) / <alpha-value>)",
        "destructive-foreground": "rgb(var(--destructive-foreground) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)"
      },
      borderRadius: {
        xl: "var(--radius)",
        lg: "calc(var(--radius) - 2px)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)"
      },
      boxShadow: {
        glow: "0 0 44px rgba(35, 64, 102, 0.35)",
        "glow-strong": "0 0 64px rgba(35, 64, 102, 0.55)"
      }
    }
  },
  plugins: []
} satisfies Config;
