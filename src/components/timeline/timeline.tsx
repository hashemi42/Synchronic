"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/segmented";
import { formatYear, type CalendarLocale } from "@/lib/calendar";
import type { CountryFile, Presets } from "@/lib/data/schema";
import type { CountrySummary } from "@/lib/data/summary";
import { RANGE, stepYear, type Step } from "@/lib/time";
import { setTimelineState, useTimelineState } from "@/lib/url-state";
import { AddCountry } from "./add-country";
import { Lane } from "./lane";
import { buildLaneModel, reignAt, type LaneModel, type Reign } from "./model";
import { TimeDock } from "./time-dock";
import { seedCountryFiles, useCountryFiles } from "./use-country-files";

type Mode = "year" | "reign";

/** Lane models are built once per loaded file. */
const modelCache = new WeakMap<CountryFile, LaneModel>();
const modelOf = (file: CountryFile) => {
  let model = modelCache.get(file);
  if (!model) modelCache.set(file, (model = buildLaneModel(file)));
  return model;
};

/** IN-9: at most ten lanes on desktop, four on a phone. */
const PHONE = "(max-width: 639px)";
const subscribePhone = (listener: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const useMaxLanes = () =>
  useSyncExternalStore(subscribePhone, () => (window.matchMedia(PHONE).matches ? 4 : 10), () => 10);

export function Timeline({
  initialFiles,
  summaries,
  urls,
  locale,
  withheld,
  presets,
}: {
  /** Full data for the default lanes, so the first paint needs no request. */
  initialFiles: CountryFile[];
  summaries: CountrySummary[];
  /** id → URL of each country's full data. */
  urls: Record<string, string>;
  locale: CalendarLocale;
  withheld: readonly string[];
  presets: Presets;
}) {
  const t = useTranslations();
  const { year, lanes: laneIds, anchor: anchorId } = useTimelineState();
  const [step, setStep] = useState<Step>("year");
  const [mode, setMode] = useState<Mode>("year");
  const maxLanes = useMaxLanes();

  seedCountryFiles(initialFiles);
  const countries = useMemo(() => new Map(summaries.map((c) => [c.id, c])), [summaries]);
  // Unknown ids in the URL are ignored rather than shown as an error.
  const validIds = laneIds.filter((id) => countries.has(id));
  const { files: loaded, failed, retry } = useCountryFiles(validIds, urls);
  const models = new Map(loaded.map((file) => [file.country.id, modelOf(file)]));
  const selected = validIds.map((id) => models.get(id)).filter((m): m is LaneModel => m !== undefined);

  let anchor: Reign | null = null;
  let anchorLane: LaneModel | null = null;
  if (anchorId) {
    for (const model of selected) {
      const found = model.reigns.find((r) => r.person === anchorId && r.start !== r.end);
      if (found) {
        anchor = found;
        anchorLane = model;
        break;
      }
    }
  }
  // IN-9: the anchor lane stays first.
  const ordered = anchorLane ? [anchorLane, ...selected.filter((m) => m !== anchorLane)] : selected;
  // Lanes in display order, by id; a lane whose data is still on its way keeps its place.
  const laneOrder = anchorLane
    ? [anchorLane.file.country.id, ...validIds.filter((id) => id !== anchorLane.file.country.id)]
    : validIds;
  const anchorName = anchor && anchorLane ? (anchorLane.persons.get(anchor.person)?.name[locale] ?? anchor.person) : null;

  const setYear = (next: number) => setTimelineState({ year: next });
  const boundaries = ordered[0]?.boundaries ?? [];
  const move = (direction: 1 | -1, times = 1) =>
    setYear(stepYear(year, direction, step, { boundaries, range: RANGE, times }));

  const toggleLane = (id: string) => {
    if (laneIds.includes(id)) {
      const removesAnchor = anchorLane?.file.country.id === id;
      setTimelineState({ lanes: laneIds.filter((l) => l !== id), ...(removesAnchor ? { anchor: null } : {}) });
    } else if (validIds.length < maxLanes) {
      setTimelineState({ lanes: [...validIds, id] });
    }
  };

  const applyPreset = (ids: string[]) =>
    setTimelineState({ lanes: ids, ...(anchorLane && !ids.includes(anchorLane.file.country.id) ? { anchor: null } : {}) });

  // A-7: announce the rulers at the cursor, once scrubbing settles.
  const message = ordered
    .map((model) => {
      const country = model.file.country.name[locale];
      const reign = reignAt(model, year);
      const state = model.mainline.find((p) => p.start <= year && (p.end === null || year < p.end))?.state;
      return reign
        ? t("lane.announce", {
            country,
            ruler: model.persons.get(reign.person)?.name[locale] ?? reign.person,
            title: reign.title[locale],
            state: (state && model.states.get(state)?.name[locale]) || country,
          })
        : t("lane.announceNone", { country });
    })
    .join(". ");
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(message), 400);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <AddCountry
          countries={countries}
          urls={urls}
          lanes={validIds}
          max={maxLanes}
          year={year}
          locale={locale}
          presets={presets}
          compareWith={laneOrder[0] ?? null}
          onToggle={toggleLane}
          onPreset={applyPreset}
        />

        {/* Always rendered, so anchoring a ruler does not shift the lanes. */}
        <Segmented<Mode>
          legend={t("lane.compare")}
          value={anchor ? mode : "year"}
          onChange={setMode}
          options={[
            { value: "year", label: t("lane.singleYear") },
            { value: "reign", label: t("lane.wholeReign"), disabled: !anchor },
          ]}
        />
      </div>

      <div className="divide-y divide-hairline rounded-float-lg bg-surface shadow-float">
        {laneOrder.length === 0 && <p className="p-6 text-center text-ink-2">{t("lane.empty")}</p>}
        {laneOrder.map((id) => {
          const model = models.get(id);
          if (model)
            return (
              <Lane
                key={id}
                model={model}
                year={year}
                range={RANGE}
                locale={locale}
                anchor={anchor}
                mode={anchor ? mode : "year"}
                withheld={withheld}
                onAnchor={(person) => setTimelineState({ anchor: person })}
                onRemove={() => toggleLane(id)}
              />
            );
          const country = countries.get(id)!.name[locale];
          return (
            <section key={id} aria-labelledby={`lane-${id}`} aria-busy={!failed.includes(id)} className="p-4">
              <h3 id={`lane-${id}`} className="text-sm font-semibold">
                {country}
              </h3>
              {failed.includes(id) ? (
                <p className="mt-2 flex items-center gap-3 text-sm text-ink-2">
                  {t("lane.loadFailed")}
                  <button
                    type="button"
                    onClick={() => retry(id)}
                    className="h-8 rounded-full border border-edge px-3 text-sm font-medium text-ink hover:bg-fill"
                  >
                    {t("lane.retry")}
                  </button>
                </p>
              ) : (
                <>
                  <span className="sr-only">{t("lane.loading")}</span>
                  <div aria-hidden="true" className="mt-2 h-8 rounded-md bg-fill" />
                  <div aria-hidden="true" className="mt-1 h-7 rounded bg-fill" />
                </>
              )}
            </section>
          );
        })}
        {laneOrder.length > 0 && (
          <div dir="ltr" className="grid gap-x-4 px-4 py-2 md:grid-cols-[1fr_15rem]" aria-hidden="true">
            <div className="year flex justify-between text-2xs text-ink-3">
              <span>{formatYear(RANGE.from, locale)}</span>
              <span dir="auto">{t("lane.present")}</span>
            </div>
          </div>
        )}
      </div>

      <TimeDock
        year={year}
        range={RANGE}
        step={step}
        locale={locale}
        anchor={anchor && anchorName ? { term: anchor, name: anchorName } : null}
        onYear={setYear}
        onMove={move}
        onStep={setStep}
        onClearAnchor={() => setTimelineState({ anchor: null })}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
