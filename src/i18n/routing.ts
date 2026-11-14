import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fa"],
  defaultLocale: "en",
  // L-1: the locale is always in the path (/en/…, /fa/…).
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Text direction per locale. RTL is built in from the first component (PRD §8). */
export const directions: Record<Locale, "ltr" | "rtl"> = { en: "ltr", fa: "rtl" };
