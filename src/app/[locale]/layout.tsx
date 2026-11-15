import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Vazirmatn } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { TopBar } from "@/components/top-bar";
import { directions, routing } from "@/i18n/routing";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const vazirmatn = Vazirmatn({ variable: "--font-vazirmatn", subsets: ["arabic"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    // Absolute URLs for link previews (NF-6). SITE_URL wins; Vercel sets the other two.
    metadataBase: new URL(
      process.env.SITE_URL ??
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000"),
    ),
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "32x32" },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("shell");

  return (
    <html
      lang={locale}
      dir={directions[locale]}
      className={`${inter.variable} ${vazirmatn.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <a
          href={`#timeline-${locale}`}
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          {t("skipToTimeline")}
        </a>
        <NextIntlClientProvider>
          <TopBar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
