"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { displayRange, displayYear, gregorianRange, type CalendarLocale } from "@/lib/calendar";
import { FlagImage, NoFlagMark } from "@/components/flag-image";
import { covers, flagFor, noFlagsFor } from "@/lib/data/query";
import type { LanePeriod } from "@/lib/data/schema";
import { fold } from "@/lib/search";
import { governmentAt, headAt, othersAt, overlaps, reignAt, sameTerm, wholeOf, type LaneModel, type Reign } from "./model";

type Props = {
  id: string;
  model: LaneModel;
  period: LanePeriod;
  year: number;
  locale: CalendarLocale;
  /** State ids whose symbols are not displayed (content policy §7.6). */
  withheld: readonly string[];
  style: CSSProperties;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

/**
 * PO-1: the politics card for one state in a lane. It holds no controls, so it
 * is described to assistive technology through the pill's aria-describedby.
 */
export function StateCard({ id, model, period, year, locale, withheld, style, onPointerEnter, onPointerLeave }: Props) {
  const t = useTranslations();
  const state = period.state ? model.states.get(period.state) : undefined;
  // L-4: Solar Hijri first in Persian, with the Gregorian years after it.
  const yr = (y: number | null) => (y === null ? t("lane.present") : displayYear(y, locale));
  const years = (of: Parameters<typeof wholeOf>[0]) => {
    const r = wholeOf(of);
    const g = gregorianRange(r, locale, t("lane.present"));
    return g ? `${displayRange(r, locale, t("lane.present"))} · ${g} ${t("lane.ceShort")}` : displayRange(r, locale, t("lane.present"));
  };
  const nameOf = (person: string) => model.persons.get(person)?.name[locale] ?? person;

  // Content policy §7.3: the consensus label leads, the official name sits beneath.
  const name = period.label?.[locale] ?? state?.name[locale] ?? t("card.noState");
  // Land governed by a state of another lane (Ottoman Greece): the state's own official name,
  // capital, system and flag are the ruler's, not this land's, so the card names the ruler instead.
  const ruled = period.kind === "ruled-by";
  const official = period.officialName?.[locale] ?? (ruled ? undefined : state?.officialName?.[locale]);
  const kind =
    period.kind === "occupation" ? t("card.occupation")
    : period.kind === "no-state" ? t("card.noState")
    : ruled && state ? t("lane.ruledBy", { state: state.name[locale] })
    : null;

  const atCursor = covers(period, year);
  const current = atCursor ? reignAt(model, year) : null;
  const rulers = model.reigns.filter((r) => overlaps(r, period));
  // R4: where a party leader rules, the card names the leader and the formal head of state apart.
  const ledByLeader = atCursor ? current?.office === "leader" : rulers.some((r) => r.office === "leader");
  const head = ledByLeader && atCursor ? headAt(model, year) : null;
  const heads = ledByLeader ? model.heads.filter((r) => overlaps(r, period)) : [];
  // R8: other offices, such as Iran's presidents of 1980–1989, under their own title.
  const otherOffices = atCursor ? othersAt(model, year) : model.others.filter((r) => overlaps(r, period));
  const otherTitles = [...new Map(otherOffices.map((r) => [r.title.en, r.title])).values()];
  const government = atCursor ? governmentAt(model, year) : null;
  const governments = model.governments.filter((g) => overlaps(g, period));
  const list = (people: Reign[]) => [...new Set(people.map((p) => nameOf(p.person)))].join(locale === "fa" ? "، " : ", ");
  const summary = (people: Reign[], none: string) =>
    people.length === 0
      ? none
      : people.length === 1
        ? nameOf(people[0].person)
        : t("card.rulersSummary", { count: people.length, first: nameOf(people[0].person), last: nameOf(people.at(-1)!.person) });
  const flag = flagFor(model.file, period, year);
  const hidden = !!state && (withheld.includes(state.id) || !!flag?.withheld);
  const noFlags = noFlagsFor(model.file, period, year);
  // One term that is both offices (the President of the United States) gets one row, not two.
  const combined = atCursor
    ? !ledByLeader && sameTerm(current, government?.current ?? null)
    : !ledByLeader && rulers.length > 0 && rulers.length === governments.length && rulers.every((r, i) => sameTerm(r, governments[i]));
  const also = government && government.others.length > 0 && (
    <span className="mt-0.5 block text-xs text-ink-3">
      {t("card.alsoInYear", { year: yr(year), names: list(government.others) })}
    </span>
  );

  return (
    <div
      id={id}
      role="tooltip"
      data-country={model.file.country.id}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="absolute top-9 z-30 w-72 max-w-full rounded-float border border-hairline bg-surface p-4 text-start text-sm shadow-float"
    >
      <div dir={locale === "fa" ? "rtl" : "ltr"}>
        {!flag && noFlags.length > 0 && <NoFlagMark className="mb-3 !block h-12 w-20 border-edge" />}
        {flag && (
          <FlagImage flag={flag} withheld={hidden} alt={hidden ? t("card.flagWithheld") : t("card.flagOf", { state: ruled && state ? state.name[locale] : name })} width={160} className="mb-3 block h-12 w-20" />
        )}
        <p className="flex items-start gap-2 font-semibold">
          <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-lane-1" />
          {name}
        </p>
        {official && fold(official) !== fold(name) && <p className="mt-0.5 text-ink-2">{official}</p>}
        <p className="year mt-1 text-xs text-ink-3">
          {kind && <span className="font-sans">{kind} · </span>}
          {years(period)}
        </p>

        <dl className="mt-3 space-y-2 border-t border-hairline pt-3">
          {atCursor ? (
            <Row label={t(ledByLeader ? "card.leaderIn" : combined ? "card.bothIn" : "card.headOfStateIn", { year: yr(year) })}>
              {current ? (
                <>
                  <span className="block font-medium">{nameOf(current.person)}</span>
                  <span className="block text-ink-2">
                    {current.title[locale]} · <span className="year">{years(current)}</span>
                  </span>
                  <Notes of={current} locale={locale} />
                </>
              ) : (
                t("lane.noRuler")
              )}
              {combined && also}
            </Row>
          ) : (
            <Row label={t(ledByLeader ? "card.leaders" : combined ? "card.both" : "card.headsOfState")}>
              {summary(rulers, t("lane.noRuler"))}
            </Row>
          )}
          {ledByLeader &&
            (atCursor ? (
              <Row label={t("card.headOfStateIn", { year: yr(year) })}>
                {head ? (
                  <>
                    <span className="block font-medium">{nameOf(head.person)}</span>
                    <span className="block text-ink-2">
                      {head.title[locale]} · <span className="year">{years(head)}</span>
                    </span>
                    <Notes of={head} locale={locale} />
                  </>
                ) : (
                  t("card.noHeadOfState")
                )}
              </Row>
            ) : (
              heads.length > 0 && <Row label={t("card.headsOfState")}>{summary(heads, t("card.noHeadOfState"))}</Row>
            ))}
          {otherTitles.map((title) => {
            const holders = otherOffices.filter((r) => r.title.en === title.en);
            return atCursor ? (
              <Row key={title.en} label={t("card.otherIn", { title: title[locale], year: yr(year) })}>
                {holders.map((r) => (
                  <span key={`${r.person}-${r.start}`} className="block">
                    <span className="font-medium">{nameOf(r.person)}</span>{" "}
                    <span className="year text-ink-2">{years(r)}</span>
                    <Notes of={r} locale={locale} />
                  </span>
                ))}
              </Row>
            ) : (
              <Row key={title.en} label={title[locale]}>
                {summary(holders, "")}
              </Row>
            );
          })}
          {/* PO-1: head of government, where the office existed. */}
          {combined ? null : government ? (
            (government.current || government.others.length > 0) && (
              <Row label={t("card.headOfGovernmentIn", { year: yr(year) })}>
                {government.current ? (
                  <>
                    <span className="block font-medium">{nameOf(government.current.person)}</span>
                    <span className="block text-ink-2">
                      {government.current.title[locale]} · <span className="year">{years(government.current)}</span>
                    </span>
                    <Notes of={government.current} locale={locale} />
                  </>
                ) : (
                  t("card.noGovernment")
                )}
                {also}
              </Row>
            )
          ) : (
            governments.length > 0 && (
              <Row label={t("card.headsOfGovernment")}>{summary(governments, t("card.noGovernment"))}</Row>
            )
          )}
          {!ruled && state?.system && <Row label={t("card.system")}>{state.system[locale]}</Row>}
          {!ruled && state?.capital && <Row label={t("card.capital")}>{state.capital[locale]}</Row>}
          {(flag || noFlags.length > 0) && (
            <Row label={t("card.flag")}>
              {!flag ? null : hidden ? (
                t("card.flagWithheld")
              ) : (
                <>
                  {flag.name && <span className="block">{flag.name[locale]}</span>}
                  <span className="year">{years(flag)}</span>
                  {/* PO-3: anything short of a documented flag says so. */}
                  {flag.certainty !== "documented" && <span> · {t(`card.${flag.certainty}`)}</span>}
                  <span className="mt-0.5 block text-2xs text-ink-3">
                    {t("card.imageCredit", { attribution: flag.attribution, license: flag.license })}
                  </span>
                </>
              )}
              {/* PRD §7.7: years with no documented flag say so, never a blank. */}
              {noFlags.map((n) => (
                <span key={n.start} className="block">
                  {t("lane.noFlag")} · <span className="year">{years(n)}</span>
                  {n.note && <span className="block text-xs text-ink-3">{n.note[locale]}</span>}
                </span>
              ))}
            </Row>
          )}
        </dl>

        {period.note && period.kind !== "no-state" && (
          <p className="mt-3 border-t border-hairline pt-3 text-ink-2">{period.note[locale]}</p>
        )}
      </div>
    </div>
  );
}

/** Where sources disagree about a term, what each says (PRD §7.4). */
function Notes({ of, locale }: { of: Reign; locale: CalendarLocale }) {
  return of.notes?.map((note) => (
    <span key={note.en} className="mt-0.5 block text-xs text-ink-3">
      {note[locale]}
    </span>
  ));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-medium tracking-wide text-ink-3 uppercase">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
