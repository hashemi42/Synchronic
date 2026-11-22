import { covers } from "@/lib/data/query";
import { isBeside } from "@/lib/data/kinds";
import type { CountryFile, LanePeriod, Localized, OfficeTerm, Person, State } from "@/lib/data/schema";
import type { Range } from "@/lib/time";

/**
 * One segment of a lane's ruler row: a person's unbroken time in power under
 * one title, across the states of the lane. `start === end` means the reign
 * began and ended within that year.
 */
export type Reign = {
  person: string;
  title: Localized;
  start: number;
  end: number | null;
  office?: OfficeTerm["office"];
  notes?: Localized[];
  /**
   * The true years of a reign of which this segment shows only part. Use `wholeOf` to write years.
   * - A ruler of another lane's state: Mahmud II ruled Ottoman Greece to 1830 but reigned to 1839.
   * - A term in several segments, because its state lost the lane for a time: a king of 1935–1947
   *   whose country was occupied in 1941–1944. Each of its segments has the same years here.
   */
  whole?: { start: number; end: number | null };
};

/** The years to write for a reign; its own `start` and `end` are the years to draw. */
export const wholeOf = (r: { start: number; end: number | null; whole?: { start: number; end: number | null } }) => r.whole ?? r;

export type LaneModel = {
  file: CountryFile;
  states: Map<string, State>;
  persons: Map<string, Person>;
  /** The lane without rival governments and parallel states, oldest first. */
  mainline: LanePeriod[];
  /** The ruler row: heads of state, or de facto leaders where a state has them. */
  reigns: Reign[];
  /** Heads of government (PO-1), built the same way. */
  governments: Reign[];
  /**
   * Formal heads of state (R4). The same as `reigns` except where a party leader rules: there the
   * ruler row shows the leader, and the card adds the formal head of state from here.
   */
  heads: Reign[];
  /** Other formal offices (R8), such as Iran's presidents of 1980–1989. */
  others: Reign[];
  /** Years in which a reign begins: the stops of the "reign" step. */
  boundaries: number[];
};

const INF = Number.POSITIVE_INFINITY;

/**
 * Turns office terms into one row of segments along the lane. Terms are cut to
 * the years their state held the lane, so a ruler who began in a parallel
 * government (Atatürk in Ankara, 1920) joins the row when that government
 * becomes the main one. Segments of one person under one title that meet at a
 * change of state (George III in 1801, Nehru in 1950) are joined. A term that a
 * break in the lane leaves in separate segments stays so, but is one reign to write.
 */
function buildSegments(mainline: LanePeriod[], pick: (state: string) => OfficeTerm[]): Reign[] {
  const pieces: (Reign & { term: OfficeTerm })[] = [];
  for (const period of mainline) {
    if (!period.state) continue;
    const periodEnd = period.end ?? INF;
    // The first period only marks where the lane's data begins, so a reign
    // already under way then keeps its true first year.
    const periodStart = period === mainline[0] ? -INF : period.start;
    for (const term of pick(period.state)) {
      const start = Math.max(term.start, periodStart);
      const end = Math.min(term.end ?? INF, periodEnd);
      const withinOneYear = term.start === term.end && term.start >= periodStart && term.start < periodEnd;
      if (start < end || withinOneYear) {
        pieces.push({
          term,
          person: term.person,
          title: term.title,
          start,
          end: end === INF ? null : end,
          office: term.office,
          ...(term.note ? { notes: [term.note] } : {}),
          ...(period.kind === "ruled-by" && (term.start !== start || (term.end ?? INF) !== end)
            ? { whole: { start: term.start, end: term.end } }
            : {}),
        });
      }
    }
  }
  pieces.sort((a, b) => a.start - b.start || (a.end ?? INF) - (b.end ?? INF));

  const segments: Reign[] = [];
  const segmentsOf = new Map(pieces.map(({ term }) => [term, new Set<Reign>()]));
  for (const { term, ...piece } of pieces) {
    const prev = segments.findLast((r) => r.person === piece.person);
    if (prev && prev.title.en === piece.title.en && prev.end === piece.start && prev.start !== prev.end) {
      if (prev.whole || piece.whole) prev.whole = { start: wholeOf(prev).start, end: wholeOf(piece).end };
      prev.end = piece.end;
      if (piece.notes) prev.notes = [...(prev.notes ?? []), ...piece.notes];
      segmentsOf.get(term)!.add(prev);
    } else {
      segments.push(piece);
      segmentsOf.get(term)!.add(piece);
    }
  }

  // One term in several segments: its state lost the lane for a time and held it again.
  for (const [term, split] of segmentsOf) {
    if (split.size === 1) continue;
    const [first] = split;
    const years = [term, ...[...split].map(wholeOf)];
    const end = Math.max(...years.map((r) => r.end ?? INF));
    // Changed in place, so that a segment which an earlier term ties to `first` follows.
    const whole = Object.assign(first.whole ?? {}, { start: Math.min(...years.map((r) => r.start)), end: end === INF ? null : end });
    for (const segment of split) segment.whole = whole;
  }
  return segments;
}

export function buildLaneModel(file: CountryFile): LaneModel {
  const mainline = file.lane.filter((p) => !isBeside(p.kind)).sort((a, b) => a.start - b.start);
  const ofState = (state: string) => file.terms.filter((term) => term.state === state);

  const reigns = buildSegments(mainline, (state) => {
    const leaders = ofState(state).filter((term) => term.office === "leader");
    return leaders.length > 0 ? leaders : ofState(state).filter((term) => term.office === "head-of-state");
  });
  const governments = buildSegments(mainline, (state) =>
    ofState(state).filter((term) => term.office === "head-of-government"),
  );
  const heads = buildSegments(mainline, (state) => ofState(state).filter((term) => term.office === "head-of-state"));
  const others = buildSegments(mainline, (state) => ofState(state).filter((term) => term.office === "other"));

  return {
    file,
    states: new Map(file.states.map((s) => [s.id, s])),
    persons: new Map(file.persons.map((p) => [p.id, p])),
    mainline,
    reigns,
    governments,
    heads,
    others,
    boundaries: [...new Set(reigns.filter((r) => r.start !== r.end).map((r) => r.start))],
  };
}

/** The ruler at a year. A reign within a single year never holds the cursor; its successor does. */
export const reignAt = (model: LaneModel, year: number) => model.reigns.find((r) => covers(r, year)) ?? null;

/** The formal head of state at a year (R4); differs from `reignAt` only where a party leader rules. */
export const headAt = (model: LaneModel, year: number) => model.heads.find((r) => covers(r, year)) ?? null;

/**
 * Whether a term that ended in `year` still counts in that year. Not where a `ruled-by` period meets
 * another state's: the officials of one country are not named beside those of the other.
 */
function carriesOver(model: LaneModel, year: number): boolean {
  const i = model.mainline.findIndex((p) => covers(p, year));
  const now = model.mainline[i];
  const before = model.mainline[i - 1];
  if (!before || now.start !== year || before.state === now.state) return true;
  return before.kind !== "ruled-by" && now.kind !== "ruled-by";
}

/** Holders of other offices at a year (R8): every term that covers it, or began or ended in it. */
export const othersAt = (model: LaneModel, year: number) =>
  model.others.filter((r) => covers(r, year) || r.start === year || (r.end === year && carriesOver(model, year)));

/**
 * The head of government at a year, and everyone else who held the office
 * during that year. Whole years are coarse: France had three heads of
 * government in 1920, and the one in office at its end is shown.
 */
export function governmentAt(model: LaneModel, year: number): { current: Reign | null; others: Reign[] } {
  const covering = model.governments.filter((g) => covers(g, year));
  const current = covering.at(-1) ?? null;
  const others = model.governments.filter(
    (g) => g !== current && (covering.includes(g) || g.start === year || (g.end === year && carriesOver(model, year))),
  );
  return { current, others };
}

/**
 * True when one term holds both offices: the same person, title and years (the President of the
 * United States). Erdoğan, President from 2014 and head of government from 2018, is two terms.
 */
export const sameTerm = (a: Reign | null, b: Reign | null) =>
  !!a && !!b && a.person === b.person && a.title.en === b.title.en && wholeOf(a).start === wholeOf(b).start && wholeOf(a).end === wholeOf(b).end;

type Span = { start: number; end: number | null };
const endOf = (r: Span) => (r.end === null ? INF : r.end === r.start ? r.start + 1 : r.end);

/** Half-open ranges overlap when each starts before the other ends. */
export const overlaps = (a: Span, b: Span) => a.start < endOf(b) && b.start < endOf(a);

/**
 * The rulers during a reign, for a list: one whose reign is in separate segments of the lane is
 * written with the same whole years each time, so they are named once.
 */
export function rulersDuring(model: LaneModel, span: Span): Reign[] {
  return model.reigns.filter((r) => overlaps(r, span)).filter((r, i, all) => all.findIndex((o) => sameTerm(o, r)) === i);
}

/**
 * Horizontal positions as percentages. Each year occupies [year, year + 1),
 * so the range is one year wider than `to - from` and the cursor sits mid-year.
 */
export function createScale(range: Range) {
  const span = range.to + 1 - range.from;
  const pct = (year: number) => ((Math.min(Math.max(year, range.from), range.to + 1) - range.from) / span) * 100;
  return {
    span,
    pct,
    cursor: (year: number) => `${pct(year + 0.5)}%`,
    box: (r: Span) => ({
      insetInlineStart: `${pct(r.start)}%`,
      width: `${pct(r.end ?? range.to + 1) - pct(r.start)}%`,
    }),
  };
}
