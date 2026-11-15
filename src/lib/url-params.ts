/**
 * Reading timeline state from a query string (SH-2). Shared by the browser store and by the server,
 * which needs it for link previews (NF-6).
 */
import { DEFAULT_LANES } from "./defaults";
import { clampYear, DEFAULT_YEAR, isFullRange, MIN_SPAN, RANGE, type Range } from "./time";

/** `view` is the zoomed time window (IN-10); null shows the whole range. */
export type TimelineState = { year: number; lanes: string[]; anchor: string | null; view: Range | null };

export const DEFAULTS: TimelineState = { year: DEFAULT_YEAR, lanes: DEFAULT_LANES, anchor: null, view: null };

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseTimelineParams(params: URLSearchParams): TimelineState {
  const year = Number(params.get("year"));
  const anchor = params.get("anchor");
  const from = clampYear(Number(params.get("from")));
  const to = clampYear(Number(params.get("to")));
  const zoomed =
    params.has("from") && params.has("to") && to - from + 1 >= MIN_SPAN && !isFullRange({ from, to }, RANGE);
  return {
    year: params.has("year") && Number.isInteger(year) && year !== 0 ? clampYear(year) : DEFAULTS.year,
    lanes: params.has("lanes")
      ? [...new Set((params.get("lanes") ?? "").split(",").filter((id) => ID.test(id)))]
      : DEFAULTS.lanes,
    anchor: anchor && ID.test(anchor) ? anchor : null,
    view: zoomed ? { from, to } : null,
  };
}

/** The part of the state a link preview depends on, as a query string: year, lanes and anchor. */
export function previewQuery(state: TimelineState): string {
  const params = new URLSearchParams({ year: String(state.year), lanes: state.lanes.join(",") });
  if (state.anchor) params.set("anchor", state.anchor);
  return params.toString().replaceAll("%2C", ",");
}
