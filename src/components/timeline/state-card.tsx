"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { formatYear, type CalendarLocale } from "@/lib/calendar";
import { FlagImage } from "@/components/flag-image";
import { covers, flagFor } from "@/lib/data/query";
import type { LanePeriod } from "@/lib/data/schema";
import { governmentAt, overlaps, reignAt, type LaneModel, type Reign } from "./model";

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
  const yr = (y: number | null) => (y === null ? t("lane.present") : formatYear(y, locale));
  const years = (r: { start: number; end: number | null }) =>
    r.start === r.end ? yr(r.start) : `${yr(r.start)}–${yr(r.end)}`;
  const nameOf = (person: string) => model.persons.get(person)?.name[locale] ?? person;

  // Content policy §7.3: the consensus label leads, the official name sits beneath.
  const name = period.label?.[locale] ?? state?.name[locale] ?? t("card.noState");
  const official = period.officialName?.[locale] ?? state?.officialName?.[locale];
  const kind = period.kind === "occupation" ? t("card.occupation") : period.kind === "no-state" ? t("card.noState") : null;

  const atCursor = covers(period, year);
  const current = atCursor ? reignAt(model, year) : null;
  const rulers = model.reigns.filter((r) => overlaps(r, period));
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
        {flag && (
          <FlagImage flag={flag} withheld={hidden} alt={hidden ? t("card.flagWithheld") : t("card.flagOf", { state: name })} width={160} className="mb-3 block h-12 w-20" />
        )}
        <p className="flex items-start gap-2 font-semibold">
          <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-lane-1" />
          {name}
        </p>
        {official && official !== name && <p className="mt-0.5 text-ink-2">{official}</p>}
        <p className="year mt-1 text-xs text-ink-3">
          {kind && <span className="font-sans">{kind} · </span>}
          {years(period)}
        </p>

        <dl className="mt-3 space-y-2 border-t border-hairline pt-3">
          {atCursor ? (
            <Row label={t("card.headOfStateIn", { year: yr(year) })}>
              {current ? (
                <>
                  <span className="block font-medium">{nameOf(current.person)}</span>
                  <span className="block text-ink-2">
                    {current.title[locale]} · <span className="year">{years(current)}</span>
                  </span>
                </>
              ) : (
                t("lane.noRuler")
              )}
            </Row>
          ) : (
            <Row label={t("card.headsOfState")}>{summary(rulers, t("lane.noRuler"))}</Row>
          )}
          {/* PO-1: head of government, where the office existed. */}
          {government ? (
            (government.current || government.others.length > 0) && (
              <Row label={t("card.headOfGovernmentIn", { year: yr(year) })}>
                {government.current ? (
                  <>
                    <span className="block font-medium">{nameOf(government.current.person)}</span>
                    <span className="block text-ink-2">
                      {government.current.title[locale]} · <span className="year">{years(government.current)}</span>
                    </span>
                  </>
                ) : (
                  t("card.noGovernment")
                )}
                {government.others.length > 0 && (
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {t("card.alsoInYear", { year: yr(year), names: list(government.others) })}
                  </span>
                )}
              </Row>
            )
          ) : (
            governments.length > 0 && (
              <Row label={t("card.headsOfGovernment")}>{summary(governments, t("card.noGovernment"))}</Row>
            )
          )}
          {state?.system && <Row label={t("card.system")}>{state.system[locale]}</Row>}
          {state?.capital && <Row label={t("card.capital")}>{state.capital[locale]}</Row>}
          {flag && (
            <Row label={t("card.flag")}>
              {hidden ? (
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-medium tracking-wide text-ink-3 uppercase">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
