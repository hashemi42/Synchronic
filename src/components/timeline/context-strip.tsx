"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { displayRange, type CalendarLocale } from "@/lib/calendar";
import type { Range } from "@/lib/time";
import { createScale } from "./model";
import { useElementWidth } from "./use-element-width";

export type Era = { key: string; name: string; start: number; end: number | null; hatched: boolean };

export type EraContext = { id: string; country: string; eras: Era[] };

const SHADES = ["bg-lane-1", "bg-lane-2", "bg-lane-3"] as const;

type Props = {
  context: EraContext;
  range: Range;
  year: number;
  locale: CalendarLocale;
  /** Jumps to the first year of an era. */
  onJump: (year: number) => void;
};

/**
 * TD-2: the context strip. It sits on the all-time track and shows the dynasties and states of the
 * anchor's country (or the first lane), so a big jump is one press. Like the lanes, an era narrower
 * than 24 px is drawn but is not a button (WCAG 2.5.8); the lanes and the slider reach it instead.
 */
export function ContextStrip({ context, range, year, locale, onJump }: Props) {
  const t = useTranslations("dock");
  const present = useTranslations("lane")("present");
  const scale = createScale(range);
  const ref = useRef<HTMLOListElement>(null);
  const width = useElementWidth(ref);
  const wideEnough = (e: Era) => width === null || (parseFloat(scale.box(e).width) / 100) * width >= 24;
  const from = (e: Era) => Math.max(e.start, range.from);

  return (
    <ol
      ref={ref}
      data-country={context.id}
      data-era-strip
      aria-label={t("eras", { country: context.country })}
      // Short screens keep the dock compact: the lanes and the slider still do everything the strip does.
      className="relative mb-1 h-6 overflow-x-clip [@media(max-height:44rem)]:hidden"
    >
      {context.eras.map((era, i) => {
        const current = year >= era.start && (era.end === null || year < era.end);
        const label = `${era.name}${locale === "fa" ? "،" : ","} ${displayRange(era, locale, present)}`;
        const tone = era.hatched ? "hatched text-ink-2" : `${SHADES[i % SHADES.length]} text-white`;
        return (
          <li key={era.key} style={scale.box(era)} className="absolute inset-y-0">
            {wideEnough(era) ? (
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                aria-label={t("jumpTo", { era: label })}
                title={label}
                onClick={() => onJump(from(era))}
                className={`flex size-full items-center overflow-hidden rounded border-2 px-1.5 text-2xs font-medium focus-visible:z-10 ${tone} ${
                  current ? "border-ink" : "border-surface"
                }`}
              >
                <span dir="auto" className="truncate">
                  {era.name}
                </span>
              </button>
            ) : (
              <div title={label} className={`size-full rounded border-2 ${tone} ${current ? "border-ink" : "border-surface"}`}>
                <span className="sr-only">{label}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
