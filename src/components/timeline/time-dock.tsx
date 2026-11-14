"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/segmented";
import { formatYear, formatYearRange, hijriEquivalents, type CalendarLocale } from "@/lib/calendar";
import { clampYear, parseYearInput, STEPS, type Range, type Step } from "@/lib/time";
import { createScale, type Reign } from "./model";

type Props = {
  year: number;
  range: Range;
  step: Step;
  locale: CalendarLocale;
  anchor: { term: Reign; name: string } | null;
  onYear: (year: number) => void;
  /** Move by the current step: direction ±1, `times` steps. */
  onMove: (direction: 1 | -1, times?: number) => void;
  onStep: (step: Step) => void;
  onClearAnchor: () => void;
};

export function TimeDock({ year, range, step, locale, anchor, onYear, onMove, onStep, onClearAnchor }: Props) {
  const t = useTranslations();
  const hijri = hijriEquivalents(year);
  const era = year < 0 ? "bce" : "ce";

  // TD-1 / A-7: the slider announces the year in every calendar.
  const valueText = [
    `${formatYear(year, locale)} ${t(`calendar.${era}Long`)}`,
    hijri && `${formatYearRange(hijri.sh, locale)} ${t("calendar.shLong")}`,
    hijri && `${formatYearRange(hijri.ah, locale)} ${t("calendar.ahLong")}`,
  ]
    .filter(Boolean)
    .join(", ");

  const yr = (y: number | null) => (y === null ? t("lane.present") : formatYear(y, locale));

  return (
    <section
      aria-label={t("dock.label")}
      className="sticky bottom-4 z-20 mt-6 rounded-float-lg border border-hairline bg-surface p-3 shadow-float sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="flex items-baseline gap-2">
            <YearField year={year} range={range} locale={locale} label={t("dock.yearField")} onYear={onYear} />
            <span className="year text-lg font-semibold">{t(`calendar.${era}`)}</span>
          </span>
          {hijri && (
            <span className="year flex gap-x-3 text-sm text-ink-3">
              <span>
                {formatYearRange(hijri.sh, locale)} {t("calendar.sh")}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {formatYearRange(hijri.ah, locale)} {t("calendar.ah")}
              </span>
            </span>
          )}
        </div>

        {anchor && (
          <span className="flex h-8 items-center gap-1 rounded-full border border-anchor bg-anchor-soft ps-3 pe-1 text-sm">
            <span className="size-2 shrink-0 rounded-full bg-anchor" aria-hidden="true" />
            <span className="font-medium">{t("dock.anchored", { name: anchor.name })}</span>
            <span className="year text-ink-2">
              · {yr(anchor.term.start)}–{yr(anchor.term.end)}
            </span>
            <button
              type="button"
              onClick={onClearAnchor}
              aria-label={t("dock.removeAnchor")}
              title={t("dock.removeAnchor")}
              className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:bg-surface hover:text-ink"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Segmented
            legend={t("dock.step")}
            value={step}
            onChange={onStep}
            options={STEPS.map((s) => ({
              value: s,
              label: t(`dock.step${s[0].toUpperCase()}${s.slice(1)}` as "dock.stepYear"),
            }))}
          />
          {/* Time runs left → right in both languages, so back is always on the left. */}
          <span dir="ltr" className="flex gap-1">
            <StepButton label={t("dock.previous")} direction={-1} onMove={onMove} disabled={year <= range.from} />
            <StepButton label={t("dock.next")} direction={1} onMove={onMove} disabled={year >= range.to} />
          </span>
        </div>
      </div>

      <YearSlider
        year={year}
        range={range}
        locale={locale}
        anchor={anchor?.term ?? null}
        label={t("dock.slider")}
        valueText={valueText}
        onYear={onYear}
        onMove={onMove}
      />
    </section>
  );
}

function StepButton({
  label,
  direction,
  disabled,
  onMove,
}: {
  label: string;
  direction: 1 | -1;
  disabled: boolean;
  onMove: Props["onMove"];
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // aria-disabled keeps focus on the button when the range end is reached.
      aria-disabled={disabled}
      onClick={() => !disabled && onMove(direction)}
      className="flex size-10 items-center justify-center rounded-full border border-edge text-ink hover:bg-fill aria-disabled:cursor-not-allowed aria-disabled:text-edge aria-disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path
          d={direction === 1 ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function YearField({
  year,
  range,
  locale,
  label,
  onYear,
}: {
  year: number;
  range: Range;
  locale: CalendarLocale;
  label: string;
  onYear: (year: number) => void;
}) {
  // While editing, the field holds a draft; otherwise it mirrors the year.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseYearInput(draft);
    if (parsed !== null) onYear(clampYear(parsed, range));
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      value={draft ?? formatYear(year, locale)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
      className="year h-10 w-[5.5ch] box-content rounded-lg border border-edge bg-surface px-2 text-center text-2xl font-semibold"
    />
  );
}

function YearSlider({
  year,
  range,
  locale,
  anchor,
  label,
  valueText,
  onYear,
  onMove,
}: {
  year: number;
  range: Range;
  locale: CalendarLocale;
  anchor: Reign | null;
  label: string;
  valueText: string;
  onYear: (year: number) => void;
  onMove: Props["onMove"];
}) {
  const track = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const scale = createScale(range);

  const yearAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return clampYear(Math.floor(range.from + ratio * scale.span), range);
  };

  const decades: number[] = [];
  for (let y = Math.ceil(range.from / 10) * 10; y <= range.to; y += 10) decades.push(y);

  return (
    // The track is physical left → right in both languages (L-7).
    <div dir="ltr" className="mt-3 px-3">
      <div
        ref={track}
        className="relative h-11 cursor-pointer touch-pan-y select-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          onYear(yearAt(e.clientX));
          handle.current?.focus({ preventScroll: true });
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) onYear(yearAt(e.clientX));
        }}
      >
        <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-hairline" />
        {anchor && (
          <div
            style={scale.box(anchor)}
            className="absolute top-1.5 h-4 rounded-sm border-x-2 border-anchor bg-anchor-soft"
          />
        )}
        {decades.map((y) => (
          <div key={y} style={{ insetInlineStart: `${scale.pct(y)}%` }} className="absolute top-2">
            <div className={`w-px bg-edge ${y % 50 === 0 ? "h-3" : "h-2"}`} />
            {y % 50 === 0 && (
              <span className="year absolute top-4 -translate-x-1/2 text-2xs text-ink-3">{formatYear(y, locale)}</span>
            )}
          </div>
        ))}
        <div
          ref={handle}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={range.from}
          aria-valuemax={range.to}
          aria-valuenow={year}
          aria-valuetext={valueText}
          style={{ insetInlineStart: scale.cursor(year) }}
          onKeyDown={(e) => {
            // TD-5: arrows move one step, Shift+arrow ten; Home/End jump to the range ends.
            const times = e.shiftKey ? 10 : 1;
            if (e.key === "ArrowRight" || e.key === "ArrowUp") onMove(1, times);
            else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onMove(-1, times);
            else if (e.key === "PageUp") onMove(1, 10);
            else if (e.key === "PageDown") onMove(-1, 10);
            else if (e.key === "Home") onYear(range.from);
            else if (e.key === "End") onYear(range.to);
            else return;
            e.preventDefault();
          }}
          className="absolute top-0.5 size-6 -translate-x-1/2 rounded-full border-2 border-surface bg-ink shadow-float"
        />
      </div>
    </div>
  );
}
