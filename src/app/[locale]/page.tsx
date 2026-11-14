import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/timeline/timeline";
import { routing } from "@/i18n/routing";
import { getAllCountryFiles, getPresets } from "@/lib/data/load";
import { summarize } from "@/lib/data/summary";
import { DEFAULT_LANES } from "@/lib/defaults";
import { RANGE } from "@/lib/time";
import manifest from "@/generated/data-manifest.json";
import withheld from "../../../data/policy/withheld.json";

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

      <section id="timeline" aria-labelledby="timeline-heading" className="mt-8 scroll-mt-4">
        <h2 id="timeline-heading" className="sr-only">
          {t("timeline")}
        </h2>
        <Timeline
          initialFiles={initialFiles}
          summaries={summaries}
          urls={manifest.countries}
          locale={locale} withheld={withheld.states} presets={getPresets()} />
      </section>
    </main>
  );
}
