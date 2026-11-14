"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { displayYear, type CalendarLocale } from "@/lib/calendar";
import { frame, RANGE, zoomWindow, type Range } from "@/lib/time";
import type { Reign } from "./model";

type Props = {
  view: Range;
  zoomed: boolean;
  year: number;
  locale: CalendarLocale;
  anchor: Reign | null;
  onView: (view: Range | null) => void;
};

/** IN-10: zoom buttons. Ctrl+scroll and pinch on the lanes do the same. */
export function ZoomControls({ view, zoomed, year, locale, anchor, onView }: Props) {
  const t = useTranslations("zoom");
  const zoomIn = useRef<HTMLButtonElement>(null);
  // Zoom around the cursor while it is in view, otherwise around the middle.
  const focus = year >= view.from && year <= view.to ? year : (view.from + view.to) / 2;
  const span = view.to - view.from + 1;
  const canZoomIn = span > 10;
  const button =
    "flex size-10 items-center justify-center rounded-full border border-edge text-ink hover:bg-fill aria-disabled:cursor-not-allowed aria-disabled:text-edge aria-disabled:hover:bg-transparent";

  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-1.5">
      <span className="year me-1 text-sm text-ink-2" aria-live="polite">
        <span className="sr-only">{t("showing")} </span>
        {displayYear(view.from, locale)}–{displayYear(view.to, locale)}
      </span>
      <button
        type="button"
        aria-label={t("out")}
        title={t("out")}
        aria-disabled={!zoomed}
        onClick={() => zoomed && onView(zoomWindow(view, 2, focus))}
        className={button}
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        ref={zoomIn}
        aria-label={t("in")}
        title={t("in")}
        aria-disabled={!canZoomIn}
        onClick={() => canZoomIn && onView(zoomWindow(view, 0.5, focus))}
        className={button}
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
      {anchor && (
        <button
          type="button"
          onClick={() => onView(frame(anchor, RANGE))}
          className="flex h-10 items-center rounded-full border border-anchor bg-anchor-soft px-3 text-sm font-medium hover:bg-surface"
        >
          {t("fitReign")}
        </button>
      )}
      {zoomed && (
        <button
          type="button"
          onClick={() => {
            onView(null);
            // This button disappears once the whole range shows; keep focus nearby.
            zoomIn.current?.focus();
          }}
          className="flex h-10 items-center rounded-full px-3 text-sm font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
