"use client";

import { formatNumber, tickPositions, type CalendarLocale } from "@/lib/calendar";
import { clampYear, ticksFor, type Range } from "@/lib/time";
import { createScale, type Reign } from "./model";

type Props = {
  view: Range;
  range: Range;
  year: number;
  locale: CalendarLocale;
  anchor: Reign | null;
  onYear: (year: number) => void;
};

/**
 * TD-2: the detail track. While the lanes are zoomed it shows just that window, with a tick for
 * every step the window is dense enough for and labels at the round years. It is a second way to
 * scrub with a pointer; the slider above stays the one accessible control, so this is hidden from
 * assistive technology.
 */
export function DetailTrack({ view, range, year, locale, anchor, onYear }: Props) {
  const scale = createScale(view);
  const { step, labelEvery } = ticksFor(view);
  const ticks = tickPositions(view, step, locale);
  const inView = year >= view.from && year <= view.to;

  const yearAt = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return clampYear(Math.floor(view.from + ratio * scale.span), range);
  };

  return (
    <div
      aria-hidden="true"
      data-detail-track
      className="mt-1 h-10 cursor-pointer touch-pan-y select-none [@media(max-height:44rem)]:hidden"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onYear(yearAt(e.clientX, e.currentTarget));
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) onYear(yearAt(e.clientX, e.currentTarget));
      }}
    >
      <div className="relative h-full rounded-md bg-fill/70">
        {anchor && (
          <div className="absolute inset-0 overflow-hidden rounded-md">
            <div style={scale.box(anchor)} className="absolute inset-y-0 border-x-2 border-anchor bg-anchor-soft" />
          </div>
        )}
        {ticks.map(({ pos, value }) => {
          const labelled = value % labelEvery === 0;
          return (
            <div key={pos} style={{ insetInlineStart: `${scale.pct(pos)}%` }} className="absolute top-0">
              <div className={`w-px ${labelled ? "h-3 bg-edge" : "h-1.5 bg-hairline"}`} />
              {labelled && (
                <span className="year absolute top-3.5 -translate-x-1/2 text-2xs whitespace-nowrap text-ink-3">
                  {formatNumber(Math.abs(value), locale)}
                </span>
              )}
            </div>
          );
        })}
        {inView && (
          <div
            style={{ insetInlineStart: scale.cursor(year) }}
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink"
          >
            <div className="absolute -top-0.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-ink" />
          </div>
        )}
      </div>
    </div>
  );
}
