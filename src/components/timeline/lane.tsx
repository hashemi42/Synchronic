"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatYear, type CalendarLocale } from "@/lib/calendar";
import { FlagImage } from "@/components/flag-image";
import { covers, flagFor, periodsAt, termAt } from "@/lib/data/query";
import type { Range } from "@/lib/time";
import { createScale, governmentAt, overlaps, reignAt, type LaneModel, type Reign } from "./model";
import { StateCard } from "./state-card";

type Props = {
  model: LaneModel;
  year: number;
  range: Range;
  locale: CalendarLocale;
  /** The anchored reign; it may belong to another lane. */
  anchor: Reign | null;
  /** "reign" lists every ruler during the anchor's reign instead of the single year (IN-4). */
  mode: "year" | "reign";
  withheld: readonly string[];
  onAnchor: (person: string | null) => void;
  onRemove: () => void;
};

const SHADES = ["bg-lane-1", "bg-lane-2", "bg-lane-3"] as const;

export function Lane({ model, year, range, locale, anchor, mode, withheld, onAnchor, onRemove }: Props) {
  const t = useTranslations("lane");
  const cardId = useId();

  // PO-1: the politics card opens on hover, focus or tap, and stays while the
  // pointer is over it. Escape or a press elsewhere dismisses it.
  const [openCard, setOpenCard] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = (index: number) => {
    cancelClose();
    setOpenCard(index);
  };
  const hideSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenCard(null), 150);
  };
  useEffect(() => {
    if (openCard === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenCard(null);
    const onPress = (e: PointerEvent) => {
      if (!laneRef.current?.contains(e.target as Node)) setOpenCard(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [openCard]);
  useEffect(() => cancelClose, []);

  const { file, states, persons, mainline, reigns } = model;
  const scale = createScale(range);
  const yr = (y: number | null) => (y === null ? t("present") : formatYear(y, locale));
  const years = (r: { start: number; end: number | null }) =>
    r.start === r.end ? yr(r.start) : `${yr(r.start)}–${yr(r.end)}`;
  const nameOf = (person: string) => persons.get(person)?.name[locale] ?? person;

  const { main, rivals } = periodsAt(file, year);
  const state = main?.state ? states.get(main.state) : undefined;
  const reign = reignAt(model, year);
  const government = governmentAt(model, year).current;
  const flag = main ? flagFor(file, main, year) : null;
  const country = file.country.name[locale];
  const headingId = `lane-${file.country.id}`;
  const duringReign = anchor && mode === "reign" ? reigns.filter((r) => overlaps(r, anchor)) : null;

  return (
    <section
      aria-labelledby={headingId}
      data-country={file.country.id}
      className="grid gap-x-4 gap-y-3 p-4 md:grid-cols-[1fr_15rem]"
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 id={headingId} className="text-sm font-semibold">
            {country} <span className="font-normal text-ink-3">· {t("landOfToday", { country })}</span>
          </h3>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("remove", { country })}
            title={t("remove", { country })}
            className="-my-1 flex size-6 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-fill hover:text-ink"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div ref={laneRef} data-time-track dir="ltr" className="relative mt-2">
          {/* IN-4: the anchor's reign as a tinted band behind both rows, on every lane. */}
          {anchor && (
            <div
              aria-hidden="true"
              style={scale.box(anchor)}
              className="absolute -inset-y-1 rounded-sm border-x-2 border-anchor bg-anchor-soft"
            />
          )}

          <ol aria-label={t("states", { country })} className="relative h-8 overflow-x-clip">
            {mainline.map((period, i) => {
              const s = period.state ? states.get(period.state) : undefined;
              const name = period.label?.[locale] ?? s?.name[locale] ?? period.note?.[locale] ?? "";
              const flag = flagFor(file, period, year);
              return (
                <li key={`${period.state}-${period.start}`} style={scale.box(period)} className="absolute inset-y-0">
                  <button
                    type="button"
                    aria-describedby={openCard === i ? cardId : undefined}
                    aria-expanded={openCard === i}
                    onPointerEnter={(e) => e.pointerType === "mouse" && show(i)}
                    onPointerLeave={(e) => e.pointerType === "mouse" && hideSoon()}
                    onFocus={() => show(i)}
                    onBlur={hideSoon}
                    onClick={() => show(i)}
                    className={`@container flex size-full cursor-default items-center gap-1.5 overflow-hidden rounded-md border-2 border-surface px-2 text-xs font-medium focus-visible:z-10 ${
                      period.kind === "no-state" ? "hatched text-ink-2" : `${SHADES[i % SHADES.length]} text-white`
                    }`}
                  >
                    {/* IN-2: the historical flag, once the pill is wide enough to hold it. */}
                    {flag && (
                      <FlagImage
                        flag={flag}
                        withheld={!!s && withheld.includes(s.id)}
                        alt=""
                        width={48}
                        className="hidden h-3.5 w-5 @[5rem]:block"
                      />
                    )}
                    <span dir="auto" className="truncate">
                      {name}
                    </span>
                    <span className="sr-only">, {years(period)}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <ol aria-label={t("rulers", { country })} className="relative mt-1 h-7 overflow-x-clip">
            {reigns
              .filter((r) => r.start !== r.end)
              .map((r) => {
                const name = nameOf(r.person);
                const current = covers(r, year);
                const anchored = anchor?.person === r.person && anchor.start === r.start;
                const inReign = anchor ? overlaps(r, anchor) : false;
                return (
                  <li key={`${r.person}-${r.start}`} style={scale.box(r)} className="absolute inset-y-0">
                    <button
                      type="button"
                      aria-pressed={anchored}
                      aria-current={current ? "true" : undefined}
                      aria-label={t("anchorTo", { name, years: years(r) })}
                      title={`${name} · ${r.title[locale]} · ${years(r)}`}
                      onClick={() => onAnchor(anchored ? null : r.person)}
                      className={`flex size-full cursor-pointer items-center overflow-hidden rounded border-2 px-1 text-2xs focus-visible:z-10 ${
                        anchored ? "border-anchor" : "border-surface"
                      } ${
                        current
                          ? "bg-ink font-medium text-white"
                          : inReign
                            ? "bg-surface font-medium text-ink hover:bg-fill"
                            : "bg-fill text-ink-2 hover:bg-hairline"
                      }`}
                    >
                      <span dir="auto" className="truncate">
                        {name}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ol>

          {openCard !== null && mainline[openCard] && (
            <StateCard
              id={cardId}
              model={model}
              period={mainline[openCard]}
              year={year}
              locale={locale}
              withheld={withheld}
              // Starts under its pill, but never runs past the lane's right edge.
              style={{ left: `clamp(0px, ${scale.pct(mainline[openCard].start)}%, calc(100% - 18rem))` }}
              onPointerEnter={cancelClose}
              onPointerLeave={hideSoon}
            />
          )}

          {/* IN-3: the cursor marks the selected year. */}
          {year >= range.from && year <= range.to && <div
            aria-hidden="true"
            style={{ insetInlineStart: scale.cursor(year) }}
            className="pointer-events-none absolute -inset-y-1 z-10 w-0.5 -translate-x-1/2 bg-ink"
          />}
        </div>
      </div>

      {/* IN-5: right column */}
      <div className="border-hairline text-sm md:border-s md:ps-4">
        {duringReign ? (
          <ol className="space-y-1">
            {duringReign.length === 0 && <li className="text-ink-2">{t("noRuler")}</li>}
            {duringReign.map((r) => (
              <li key={`${r.person}-${r.start}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{nameOf(r.person)}</span>
                <span className="year text-xs text-ink-2">{years(r)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <dl>
            <dt className="sr-only">{t("headOfState")}</dt>
            <dd>
              <span className="block font-semibold">{reign ? nameOf(reign.person) : t("noRuler")}</span>
              {reign && (
                <span className="block text-ink-2">
                  {reign.title[locale]} · <span className="year">{years(reign)}</span>
                </span>
              )}
              {government && (
                <span className="mt-1 block text-xs text-ink-2">
                  <span className="sr-only">{t("headOfGovernment")}: </span>
                  {government.title[locale]} <span className="font-medium text-ink">{nameOf(government.person)}</span>
                </span>
              )}
              {(state || main?.note) && (
                <span className="mt-1 flex items-center gap-2 text-ink-2">
                  {flag ? (
                    <FlagImage flag={flag} withheld={!!state && withheld.includes(state.id)} alt="" width={48} className="h-3.5 w-5" />
                  ) : (
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-lane-1" />
                  )}
                  {state ? state.name[locale] : main?.note?.[locale]}
                </span>
              )}
            </dd>
            {rivals.map((rival) => {
              const rivalState = rival.state ? states.get(rival.state) : undefined;
              const rivalTerm = rivalState ? termAt(file, rivalState.id, year) : null;
              const rivalFlag = flagFor(file, rival, year);
              return (
                <div key={`${rival.state}-${rival.start}`} className="mt-2 border-t border-hairline pt-2">
                  <dt className="text-2xs font-medium tracking-wide text-ink-3 uppercase">{t("rival")}</dt>
                  <dd className="text-ink-2" title={rival.note?.[locale]}>
                    {rivalTerm && <span className="block font-medium text-ink">{nameOf(rivalTerm.person)}</span>}
                    <span className="flex flex-wrap items-center gap-x-2">
                      {rivalFlag && <FlagImage flag={rivalFlag} withheld={!!rival.state && withheld.includes(rival.state)} alt="" width={48} className="h-3.5 w-5" />}
                      {rivalState?.name[locale]} · <span className="year">{years(rival)}</span>
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </section>
  );
}
