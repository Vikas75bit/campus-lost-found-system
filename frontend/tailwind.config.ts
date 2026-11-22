import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        secondary: {
          DEFAULT: "#08CB00",
          hover: "#07B300",
          dark: "#069E00",
          light: "#2EE626",
        },
      },
    },
  },
  plugins: [],
};
export default config;

