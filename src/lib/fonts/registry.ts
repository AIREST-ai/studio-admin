import localFont from "next/font/local";

import { GeistPixelSquare } from "geist/font/pixel";

// F-16 (outbound audit 15 Oct, item 3): the fonts no longer come from Google at build time (next/font/google downloaded
// them from fonts.gstatic.com when the server compiled). The same files are kept in ./files and loaded with
// next/font/local (https://nextjs.org/docs/app/getting-started/fonts). Each is the "latin" subset file the Google loader
// had already fetched for this app (subsets: ["latin"], the only subset these fonts asked for), copied from the preview's
// own build cache (.next/dev/static/media); every file is a variable font (one "wght" axis), so one file covers the
// weights the old setup listed (Roboto 400/500/700, Merriweather 400/700). Licences: SIL Open Font License 1.1, Roboto
// and Roboto Slab Apache 2.0, as published by Google Fonts. Letters outside latin fall back to the next font in the stack.

const inter = localFont({
  src: "./files/inter-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
});

const notoSans = localFont({
  src: "./files/noto-sans-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-noto-sans",
});

const roboto = localFont({
  src: "./files/roboto-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-roboto",
});

const geist = localFont({
  src: "./files/geist-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-geist",
});

const outfit = localFont({
  src: "./files/outfit-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-outfit",
});

const geistMono = localFont({
  src: "./files/geist-mono-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-geist-mono",
});

const dmSans = localFont({
  src: "./files/dm-sans-latin.woff2",
  weight: "100 1000",
  style: "normal",
  display: "swap",
  variable: "--font-dm-sans",
});

const nunitoSans = localFont({
  src: "./files/nunito-sans-latin.woff2",
  weight: "200 1000",
  style: "normal",
  display: "swap",
  variable: "--font-nunito-sans",
});

const figtree = localFont({
  src: "./files/figtree-latin.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  variable: "--font-figtree",
});

const raleway = localFont({
  src: "./files/raleway-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-raleway",
});

const publicSans = localFont({
  src: "./files/public-sans-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-public-sans",
});

const jetBrainsMono = localFont({
  src: "./files/jetbrains-mono-latin.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
  variable: "--font-jetbrains-mono",
});

const notoSerif = localFont({
  src: "./files/noto-serif-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-noto-serif",
});

const robotoSlab = localFont({
  src: "./files/roboto-slab-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-roboto-slab",
});

const merriweather = localFont({
  src: "./files/merriweather-latin.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  variable: "--font-merriweather",
});

const lora = localFont({
  src: "./files/lora-latin.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-lora",
});

const playfairDisplay = localFont({
  src: "./files/playfair-display-latin.woff2",
  weight: "400 900",
  style: "normal",
  display: "swap",
  variable: "--font-playfair-display",
});

export const fontRegistry = {
  geist: {
    label: "Geist",
    font: geist,
  },
  inter: {
    label: "Inter",
    font: inter,
  },
  notoSans: {
    label: "Noto Sans",
    font: notoSans,
  },
  nunitoSans: {
    label: "Nunito Sans",
    font: nunitoSans,
  },
  figtree: {
    label: "Figtree",
    font: figtree,
  },
  roboto: {
    label: "Roboto",
    font: roboto,
  },
  raleway: {
    label: "Raleway",
    font: raleway,
  },
  dmSans: {
    label: "DM Sans",
    font: dmSans,
  },
  publicSans: {
    label: "Public Sans",
    font: publicSans,
  },
  outfit: {
    label: "Outfit",
    font: outfit,
  },
  geistMono: {
    label: "Geist Mono",
    font: geistMono,
  },
  geistPixelSquare: {
    label: "Geist Pixel Square",
    font: GeistPixelSquare,
  },
  jetBrainsMono: {
    label: "JetBrains Mono",
    font: jetBrainsMono,
  },
  notoSerif: {
    label: "Noto Serif",
    font: notoSerif,
  },
  robotoSlab: {
    label: "Roboto Slab",
    font: robotoSlab,
  },
  merriweather: {
    label: "Merriweather",
    font: merriweather,
  },
  lora: {
    label: "Lora",
    font: lora,
  },
  playfairDisplay: {
    label: "Playfair Display",
    font: playfairDisplay,
  },
} as const;

export type FontKey = keyof typeof fontRegistry;

export const fontKeys = Object.keys(fontRegistry) as FontKey[];

export const fontVars = Object.values(fontRegistry)
  .map(({ font }) => font.variable)
  .join(" ");

export const fontOptions = fontKeys.map((key) => ({
  key,
  label: fontRegistry[key].label,
}));
