import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/timeline/timeline";
import { routing } from "@/i18n/routing";
import { getAllCountryFiles, getPresets, getWorldPeriods } from "@/lib/data/load";
import { summarize } from "@/lib/data/summary";
import { DEFAULT_LANES } from "@/lib/defaults";
import { describeComparison } from "@/lib/share";
import { RANGE } from "@/lib/time";
import { parseTimelineParams, previewQuery } from "@/lib/url-params";
import manifest from "@/generated/data-manifest.json";
import withheld from "../../../data/policy/withheld.json";

/**
 * NF-6: a shared comparison link previews as itself, "Iran, United Kingdom and Russia in 1919",
 * with an image of who ruled each. The page stays prerendered; only this metadata is computed
 * per request, and it is ready before the HTML for the bots that read link previews.
 */
export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") query.set(key, value);
  const state = parseTimelineParams(query);
  const share = describeComparison(state, locale);
  if (!share) return {};
  const image = `/${locale}/og?${previewQuery(state)}`;
  return {
    title: `${share.title} — Synchronic`,
    description: share.description,
    openGraph: {
      title: share.title,
      description: share.description,
      siteName: "Synchronic",
      type: "website",
      locale: locale === "fa" ? "fa_IR" : "en_GB",
      images: [{ url: image, width: 1200, height: 630, alt: share.title }],
    },
    twitter: { card: "summary_large_image", title: share.title, description: share.description, images: [image] },
  };
}

/** Marks the page as reading the request, so its metadata can; the content itself stays static. */
async function RequestMarker() {
  await connection();
  return null;
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations("home");
  const files = getAllCountryFiles();
  // NF-2: every page carries a summary of each country and the full data of the
  // default lanes only; the rest is fetched when a lane is added.
  const summaries = files.map((file) => summarize(file, RANGE.to));
  const initialFiles = files.filter((file) => DEFAULT_LANES.includes(file.country.id));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-10 pb-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">{t("tagline")}</h1>
      <p className="mt-3 max-w-2xl text-ink-2">{t("intro")}</p>

      <section id={`timeline-${locale}`} aria-labelledby={`timeline-heading-${locale}`} className="mt-8 scroll-mt-4">
        <h2 id={`timeline-heading-${locale}`} className="sr-only">
          {t("timeline")}
        </h2>
        <Timeline
          initialFiles={initialFiles}
          summaries={summaries}
          world={getWorldPeriods()}
          urls={manifest.countries}
          locale={locale} withheld={withheld.states} presets={getPresets()} />
      </section>
      <Suspense>
        <RequestMarker />
      </Suspense>
    </main>
  );
}
