import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";

export const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});
