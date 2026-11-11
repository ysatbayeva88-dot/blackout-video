import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Montserrat (OFL) is bundled in public/fonts so renders work offline.
for (const weight of ["800", "900"]) {
  for (const subset of ["latin", "cyrillic"]) {
    loadFont({
      family: "Montserrat",
      url: staticFile(`fonts/montserrat-${subset}-${weight}-normal.woff2`),
      weight,
      unicodeRange: subset === "cyrillic" ? "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" : "U+0000-00FF, U+2000-206F",
    });
  }
}

