"use client";

/**
 * Timeline state in the URL (SH-2): ?year=1919&lanes=iran,uk,russia&anchor=ahmad-shah-qajar
 *
 * A small store rather than `useSearchParams`, so pages stay fully static:
 * the server renders the defaults and the browser adopts the URL on hydration.
 * The store updates on every change; the URL is written at most every 250 ms,
 * because browsers rate-limit history.replaceState while a slider is dragged.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_LANES } from "./defaults";
import { clampYear, DEFAULT_YEAR } from "./time";

export type TimelineState = { year: number; lanes: string[]; anchor: string | null };

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const DEFAULTS: TimelineState = { year: DEFAULT_YEAR, lanes: DEFAULT_LANES, anchor: null };
const WRITE_DELAY = 250;

let state: TimelineState | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function read(): TimelineState {
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  const anchor = params.get("anchor");
  return {
    year: params.has("year") && Number.isInteger(year) && year !== 0 ? clampYear(year) : DEFAULTS.year,
    lanes: params.has("lanes")
      ? [...new Set((params.get("lanes") ?? "").split(",").filter((id) => ID.test(id)))]
      : DEFAULTS.lanes,
    anchor: anchor && ID.test(anchor) ? anchor : null,
  };
}

/** The query string for a state, leaving other parameters untouched. */
export function toSearch(next: TimelineState, current = ""): string {
  const params = new URLSearchParams(current);
  params.set("year", String(next.year));
  params.set("lanes", next.lanes.join(","));
  if (next.anchor) params.set("anchor", next.anchor);
  else params.delete("anchor");
  // Ids are plain ASCII, so the commas between lanes can stay readable.
  return params.toString().replaceAll("%2C", ",");
}

function write() {
  writeTimer = null;
  if (!state) return;
  const search = toSearch(state, window.location.search);
  try {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${search}${window.location.hash}`);
  } catch {
    // Rate-limited by the browser; the next change writes again.
  }
}

const emit = () => listeners.forEach((listener) => listener());

function onPopState() {
  state = read();
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("popstate", onPopState);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("popstate", onPopState);
  };
}

const getSnapshot = () => (state ??= read());
const getServerSnapshot = () => DEFAULTS;

export function setTimelineState(patch: Partial<TimelineState>) {
  const current = getSnapshot();
  const next = { ...current, ...patch };
  if (next.year === current.year && next.anchor === current.anchor && next.lanes.join() === current.lanes.join()) return;
  state = next;
  emit();
  writeTimer ??= setTimeout(write, WRITE_DELAY);
}

export function useTimelineState(): TimelineState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
