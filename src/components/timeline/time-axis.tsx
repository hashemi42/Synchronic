import { formatYear, type CalendarLocale } from "@/lib/calendar";
import { ticksFor, type Range } from "@/lib/time";
import { createScale } from "./model";

/** The years under the lanes, denser as the window narrows. */
export function TimeAxis({ view, locale }: { view: Range; locale: CalendarLocale }) {
  const scale = createScale(view);
  const { step, labelEvery } = ticksFor(view);
  const ticks: number[] = [];
  for (let y = Math.ceil(view.from / step) * step; y <= view.to + 1; y += step) ticks.push(y);

  return (
    <div className="grid gap-x-4 px-4 pt-1 pb-3 md:grid-cols-[1fr_15rem]" aria-hidden="true">
      <div dir="ltr" className="relative h-6 overflow-x-clip">
        {ticks.map((y) => {
          const labelled = y % labelEvery === 0;
          return (
            <div key={y} style={{ insetInlineStart: `${scale.pct(y)}%` }} className="absolute top-0">
              <div className={`w-px ${labelled ? "h-2 bg-edge" : "h-1 bg-hairline"}`} />
              {labelled && (
                <span className="year absolute top-2 -translate-x-1/2 text-2xs whitespace-nowrap text-ink-3">
                  {formatYear(y, locale)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
