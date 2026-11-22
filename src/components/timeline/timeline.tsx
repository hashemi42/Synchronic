"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/segmented";
import type { CalendarLocale } from "@/lib/calendar";
import type { CountryFile, Presets, WorldPeriod } from "@/lib/data/schema";
import type { CountrySummary } from "@/lib/data/summary";
import { followYear, panWindow, RANGE, stepYear, zoomWindow, type Range, type Step } from "@/lib/time";
import { setTimelineState, useTimelineState } from "@/lib/url-state";
import { AddCountry } from "./add-country";
import { Lane } from "./lane";
import { LaneHandle } from "./lane-handle";
import { moveBy, moveTo } from "@/lib/reorder";
import { buildLaneModel, reignAt, wholeOf, type LaneModel, type Reign } from "./model";
import type { EraContext } from "./context-strip";
import { TimeDock } from "./time-dock";
import { seedCountryFiles, useCountryFiles } from "./use-country-files";
import { TimeAxis } from "./time-axis";
import { WorldRow } from "./world-row";
import { ZoomControls } from "./zoom-controls";

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
  world,
  urls,
  locale,
  withheld,
  presets,
}: {
  /** Full data for the default lanes, so the first paint needs no request. */
  initialFiles: CountryFile[];
  summaries: CountrySummary[];
  world: WorldPeriod[];
  /** id → URL of each country's full data. */
  urls: Record<string, string>;
  locale: CalendarLocale;
  withheld: readonly string[];
  presets: Presets;
}) {
  const t = useTranslations();
  const { year, lanes: laneIds, anchor: anchorId, view: zoom } = useTimelineState();
  const view = zoom ?? RANGE;
  const [step, setStep] = useState<Step>("year");
  const [mode, setMode] = useState<Mode>("year");
  const maxLanes = useMaxLanes();
  // Ids from useId: Next.js keeps the previous page in the DOM, hidden, so a
  // fixed id could resolve to the hidden copy.
  const uid = useId();
  const zoomHintId = `${uid}-zoom-hint`;
  const reorderHintId = `${uid}-reorder-hint`;

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
        // The comparison is with the whole reign, also where this lane shows only part of it.
        anchor = { ...found, ...wholeOf(found) };
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
  // TD-2: the dynasties on the all-time strip belong to the anchor's country, else the first lane.
  const contextModel = ordered[0];
  const context: EraContext | null = contextModel
    ? {
        id: contextModel.file.country.id,
        country: contextModel.file.country.name[locale],
        eras: contextModel.mainline.map((p) => {
          const s = p.state ? contextModel.states.get(p.state) : undefined;
          return {
            key: `${p.state ?? p.kind}-${p.start}`,
            name: p.label?.[locale] ?? s?.name[locale] ?? p.note?.[locale] ?? "",
            start: p.start,
            end: p.end,
            hatched: p.kind === "no-state",
          };
        }),
      }
    : null;
  const anchorName = anchor && anchorLane ? (anchorLane.persons.get(anchor.person)?.name[locale] ?? anchor.person) : null;

  // A year outside the zoomed window pulls the window along with it.
  const setYear = (next: number) => setTimelineState({ year: next, ...(zoom ? { view: followYear(zoom, next) } : {}) });
  const setView = (next: Range | null) => setTimelineState({ view: next });

  // IN-10: Ctrl+scroll (and trackpad pinch, which browsers report the same way)
  // zooms around the year under the pointer; Shift+scroll or a sideways swipe
  // moves the window; two fingers pinch on touch screens.
  const lanesRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });
  useEffect(() => {
    const el = lanesRef.current;
    if (!el) return;
    const track = () => el.querySelector<HTMLElement>("[data-time-track]")?.getBoundingClientRect();
    const yearAtX = (x: number) => {
      const rect = track();
      const v = viewRef.current;
      if (!rect) return (v.from + v.to) / 2;
      const ratio = Math.min(Math.max((x - rect.left) / rect.width, 0), 1);
      return v.from + ratio * (v.to - v.from + 1);
    };
    // Small wheel steps add up until they move the window by a whole year.
    let factor = 1;
    let shift = 0;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        factor *= Math.exp(e.deltaY * 0.004);
        const next = zoomWindow(v, factor, yearAtX(e.clientX));
        if (next.from !== v.from || next.to !== v.to) {
          factor = 1;
          setTimelineState({ view: next });
        }
        return;
      }
      const sideways = e.shiftKey ? e.deltaY || e.deltaX : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      const rect = track();
      if (!sideways || !rect) return;
      e.preventDefault();
      shift += (sideways / rect.width) * (v.to - v.from + 1);
      if (Math.abs(shift) >= 1) {
        const next = panWindow(v, Math.trunc(shift));
        shift -= Math.trunc(shift);
        setTimelineState({ view: next });
      }
    };
    let pinch: { distance: number; view: Range; focus: number } | null = null;
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2)
        pinch = {
          distance: distance(e.touches),
          view: viewRef.current,
          focus: yearAtX((e.touches[0].clientX + e.touches[1].clientX) / 2),
        };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const next = zoomWindow(pinch.view, pinch.distance / distance(e.touches), pinch.focus);
      setTimelineState({ view: next });
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);
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

  // IN-9: reorder lanes by keyboard or drag. The anchor lane stays first.
  const pinned = anchorLane ? 1 : 0;
  const [drag, setDrag] = useState<{ id: string; slot: number } | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const focusAfterMove = useRef<string | null>(null);
  useEffect(() => {
    // A moved element can lose focus as it changes place; put it back on the grip.
    if (!focusAfterMove.current) return;
    lanesRef.current?.querySelector<HTMLElement>(`[data-lane-handle="${focusAfterMove.current}"]`)?.focus();
    focusAfterMove.current = null;
  });
  const commitOrder = (id: string, next: string[]) => {
    if (next.join() === laneOrder.join()) return;
    setTimelineState({ lanes: next });
    focusAfterMove.current = id;
    setMoveMessage(
      t("reorder.moved", {
        country: countries.get(id)?.name[locale] ?? id,
        position: next.indexOf(id) + 1,
        total: next.length,
      }),
    );
  };
  const startDrag = (id: string, e: ReactPointerEvent<HTMLButtonElement>) => {
    const handle = e.currentTarget;
    const from = laneOrder.indexOf(id);
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
    let slot = from;
    setDrag({ id, slot });
    // The slot is a gap between lanes: 0 is above the first, n below the last.
    const slotAt = (y: number) => {
      const sections = [...(lanesRef.current?.querySelectorAll<HTMLElement>("[data-lane-id]") ?? [])];
      const index = sections.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      return Math.max(index === -1 ? sections.length : index, pinned);
    };
    const onMove = (ev: PointerEvent) => {
      slot = slotAt(ev.clientY);
      setDrag({ id, slot });
      // Scroll when the pointer nears the top or bottom of the window.
      if (ev.clientY < 72) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - 72) window.scrollBy(0, 12);
    };
    const finish = (commit: boolean) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      setDrag(null);
      if (commit) commitOrder(id, moveTo(laneOrder, id, slot > from ? slot - 1 : slot, pinned));
      else setMoveMessage(t("reorder.cancelled"));
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") finish(false);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
  };
  // Where the dragged lane would land, unless that is where it already is.
  const dropEdgeFor = (index: number): "before" | "after" | null => {
    if (!drag) return null;
    const from = laneOrder.indexOf(drag.id);
    if (drag.slot === from || drag.slot === from + 1) return null;
    if (drag.slot === index) return "before";
    if (drag.slot === laneOrder.length && index === laneOrder.length - 1) return "after";
    return null;
  };

  const applyPreset = (ids: string[]) =>
    setTimelineState({ lanes: ids, ...(anchorLane && !ids.includes(anchorLane.file.country.id) ? { anchor: null } : {}) });

  // A-7: announce the rulers at the cursor, once scrubbing settles.
  const message = ordered
    .map((model) => {
      const country = model.file.country.name[locale];
      const reign = reignAt(model, year);
      const period = model.mainline.find((p) => p.start <= year && (p.end === null || year < p.end));
      return reign
        ? t("lane.announce", {
            country,
            ruler: model.persons.get(reign.person)?.name[locale] ?? reign.person,
            title: reign.title[locale],
            state: period?.label?.[locale] ?? model.states.get(period?.state ?? "")?.name[locale] ?? country,
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

        <div className="flex flex-wrap items-center gap-3">
        <ZoomControls view={view} zoomed={zoom !== null} year={year} locale={locale} anchor={anchor} onView={setView} />
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
      </div>

      <div
        ref={lanesRef}
        aria-describedby={zoomHintId}
        className="divide-y divide-hairline rounded-float-lg bg-surface shadow-float"
      >
        <WorldRow periods={world} year={year} range={view} locale={locale} anchor={anchor} />
        {laneOrder.length === 0 && <p className="p-6 text-center text-ink-2">{t("lane.empty")}</p>}
        {laneOrder.map((id, index) => {
          const model = models.get(id);
          if (model)
            return (
              <Lane
                key={id}
                handle={
                  <LaneHandle
                    id={id}
                    country={model.file.country.name[locale]}
                    position={index + 1}
                    total={laneOrder.length}
                    pinned={index < pinned}
                    onMove={(stepBy) => commitOrder(id, moveBy(laneOrder, id, stepBy, pinned))}
                    onDragStart={(e) => startDrag(id, e)}
                    hintId={reorderHintId}
                  />
                }
                dragging={drag?.id === id}
                dropEdge={dropEdgeFor(index)}
                model={model}
                year={year}
                range={view}
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
            <section
              key={id}
              data-lane-id={id}
              aria-labelledby={`${uid}-lane-${id}`}
              aria-busy={!failed.includes(id)}
              className="p-4"
            >
              <h3 id={`${uid}-lane-${id}`} className="text-sm font-semibold">
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
        {laneOrder.length > 0 && <TimeAxis view={view} locale={locale} />}
      </div>

      <p id={zoomHintId} className="mt-2 hidden text-2xs text-ink-3 sm:block">
        {t("zoom.hint")}
      </p>

      <TimeDock
        view={zoom}
        context={context}
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
      <p aria-live="assertive" className="sr-only">
        {moveMessage}
      </p>
      <p id={reorderHintId} hidden>
        {t("reorder.hint")}
      </p>
    </div>
  );
}
