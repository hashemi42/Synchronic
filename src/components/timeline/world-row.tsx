"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { displayRange, gregorianRange, type CalendarLocale } from "@/lib/calendar";
import type { WorldPeriod } from "@/lib/data/schema";
import type { Range } from "@/lib/time";
import { createScale, type Reign } from "./model";

type Props = {
  periods: WorldPeriod[];
  year: number;
  range: Range;
  locale: CalendarLocale;
  anchor: Reign | null;
};

/** IN-8: major global periods above the lanes, on the same time scale. */
export function WorldRow({ periods, year, range, locale, anchor }: Props) {
  const t = useTranslations("world");
  const headingId = useId();
  const scale = createScale(range);
  const visible = periods.filter((p) => p.last >= range.from && p.start <= range.to);
  // `last` is the final year included; the lane scale works with half-open ranges.
  const span = (p: WorldPeriod) => ({ start: p.start, end: p.last + 1 });
  const active = visible.filter((p) => p.start <= year && year <= p.last);
  const years = (p: WorldPeriod) => {
    const r = { start: p.start, end: p.last };
    const g = gregorianRange(r, locale, "");
    return g ? `${displayRange(r, locale, "")} · ${g} ${t("ceShort")}` : displayRange(r, locale, "");
  };

  return (
    <section aria-labelledby={headingId} data-world-row className="grid gap-x-4 gap-y-2 rounded-t-float-lg bg-fill/60 px-4 py-3 md:grid-cols-[1fr_15rem]">
      <div className="min-w-0">
        <h3 id={headingId} className="text-2xs font-medium tracking-wide text-ink-3 uppercase">
          {t("label")}
        </h3>
        <div data-time-track dir="ltr" className="relative mt-1.5">
          {anchor && (
            <div
              aria-hidden="true"
              style={scale.box(anchor)}
              className="absolute -inset-y-1 rounded-sm border-x-2 border-anchor bg-anchor-soft"
            />
          )}
          <ol aria-label={t("periods")} className="relative h-6 overflow-x-clip">
            {visible.map((p) => {
              const name = p.name[locale];
              return (
                <li
                  key={p.id}
                  style={scale.box(span(p))}
                  title={`${name} · ${years(p)}`}
                  className={`@container absolute inset-y-0 flex items-center overflow-hidden rounded border-2 border-fill px-1.5 text-2xs font-medium ${
                    p.kind === "war" ? "bg-ink-2 text-white" : "border-x-edge bg-surface text-ink-2"
                  }`}
                >
                  <span dir="auto" className="truncate @[7rem]:hidden">
                    {p.short[locale]}
                  </span>
                  <span dir="auto" className="hidden truncate @[7rem]:inline">
                    {name}
                  </span>
                  <span className="sr-only">
                    , {t(p.kind)}, {years(p)}
                  </span>
                </li>
              );
            })}
          </ol>
          {year >= range.from && year <= range.to && <div
            aria-hidden="true"
            style={{ insetInlineStart: scale.cursor(year) }}
            className="pointer-events-none absolute -inset-y-1 z-10 w-0.5 -translate-x-1/2 bg-ink"
          />}
        </div>
      </div>

      <p className="self-center text-sm md:border-s md:border-hairline md:ps-4">
        {active.length > 0 ? (
          active.map((p) => (
            <span key={p.id} className="block">
              <span className="font-medium">{p.name[locale]}</span>{" "}
              <span className="year text-xs text-ink-3">{years(p)}</span>
            </span>
          ))
        ) : (
          <span className="text-ink-3">{t("none")}</span>
        )}
      </p>
    </section>
  );
}
