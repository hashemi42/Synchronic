"use client";

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FlagImage } from "@/components/flag-image";
import { displayYear, type CalendarLocale } from "@/lib/calendar";
import { covers } from "@/lib/data/query";
import type { Presets } from "@/lib/data/schema";
import type { CountrySummary } from "@/lib/data/summary";
import { OPEN_SEARCH_EVENT } from "@/lib/site";
import { buildSearchIndex, searchCountries } from "@/lib/search";
import { prefetchCountryFile } from "./use-country-files";

type Props = {
  countries: Map<string, CountrySummary>;
  urls: Record<string, string>;
  /** Ids of the lanes on screen, in order. */
  lanes: string[];
  max: number;
  year: number;
  locale: CalendarLocale;
  presets: Presets;
  /** The anchor's country, or the first lane: whose "often compared with" list to offer. */
  compareWith: string | null;
  onToggle: (id: string) => void;
  onPreset: (ids: string[]) => void;
};

/** AC-1 … AC-5: the Add-country dialog, with its trigger and lane counter. */
export function AddCountry({ countries, urls, lanes, max, year, locale, presets, compareWith, onToggle, onPreset }: Props) {
  const t = useTranslations("add");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const index = useMemo(() => buildSearchIndex([...countries.values()]), [countries]);
  const results = searchCountries(index, query);
  const current = Math.min(active, Math.max(results.length - 1, 0));
  const full = lanes.length >= max;
  const nameOf = (id: string) => countries.get(id)?.name[locale] ?? id;
  const counter = t("counter", { count: lanes.length, max });

  // AC-2: what that land was in the selected year.
  const preview = (country: CountrySummary) => {
    const period = country.mainline.find((p) => covers(p, year));
    const state = (period?.name ?? period?.note)?.[locale];
    const reign = country.reigns.find((r) => covers(r, year));
    const name = reign?.name[locale] ?? "";
    // "Emperor Taishō", not "Emperor Emperor Taishō".
    const ruler = reign ? (name.startsWith(reign.title[locale]) ? name : `${reign.title[locale]} ${name}`) : null;
    return [state, ruler].filter(Boolean).join(" · ");
  };

  // Start loading the highlighted country, so it is usually there by the time it is added.
  const highlighted = results[current];
  useEffect(() => {
    if (highlighted) prefetchCountryFile(highlighted, urls[highlighted]);
  }, [highlighted, urls]);

  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, listId]);

  const open = () => {
    setQuery("");
    setActive(0);
    dialog.current?.showModal();
  };
  // SH-1: the top bar's search trigger and ⌘K / Ctrl+K open the same dialog.
  const openFromShell = useEffectEvent(() => {
    if (!dialog.current?.open) open();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openFromShell();
      }
    };
    window.addEventListener(OPEN_SEARCH_EVENT, openFromShell);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, openFromShell);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // The browser returns focus to the trigger when a modal dialog closes (AC-4).
  const close = () => dialog.current?.close();

  const toggle = (id: string) => {
    if (lanes.includes(id) || !full) onToggle(id);
  };

  const suggestions = (compareWith ? (presets.oftenCompared[compareWith] ?? []) : []).filter(
    (id) => countries.has(id) && !lanes.includes(id),
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          className="flex h-10 items-center gap-2 rounded-full bg-ink ps-3 pe-4 text-sm font-medium text-white hover:bg-ink-2"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          {t("trigger")}
        </button>
        <span className="text-sm text-ink-3">{counter}</span>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto mt-[8vh] w-[min(34rem,calc(100vw-2rem))] max-w-none rounded-float-lg bg-surface p-0 text-ink shadow-float backdrop:bg-ink/40"
      >
        <div className="flex max-h-[80vh] flex-col">
          <header className="flex items-center justify-between gap-3 px-4 pt-4">
            <h2 id={titleId} className="text-base font-semibold">
              {t("title")}
            </h2>
            <div className="flex items-center gap-2">
              <span aria-live="polite" className={`text-sm ${full ? "font-medium text-ink" : "text-ink-3"}`}>
                {counter}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label={t("close")}
                title={t("close")}
                className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-fill hover:text-ink"
              >
                <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          <div className="px-4 pt-3">
            <input
              ref={input}
              autoFocus
              // Not type="search": there Escape clears the field before it closes the dialog.
              type="text"
              inputMode="search"
              enterKeyHint="done"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results.length > 0 ? `${listId}-${current}` : undefined}
              aria-autocomplete="list"
              aria-label={t("search")}
              placeholder={t("search")}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setActive(Math.min(current + 1, results.length - 1));
                else if (e.key === "ArrowUp") setActive(Math.max(current - 1, 0));
                else if (e.key === "Home" && results.length > 0) setActive(0);
                else if (e.key === "End" && results.length > 0) setActive(results.length - 1);
                else if (e.key === "Enter" && results[current]) toggle(results[current]);
                else return;
                e.preventDefault();
              }}
              className="h-11 w-full rounded-lg border border-edge bg-surface px-3 text-base placeholder:text-ink-3"
            />
            <p className="mt-1.5 text-2xs text-ink-3">{t("hint")}</p>
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            <ul
              id={listId}
              role="listbox"
              aria-multiselectable="true"
              aria-label={t("results", { year: displayYear(Math.abs(year), locale) })}
            >
              {results.map((id, i) => {
                const country = countries.get(id)!;
                const added = lanes.includes(id);
                const blocked = !added && full;
                // AC-5: today's flag appears only here, never on a lane.
                const flag = country.flag;
                return (
                  <li
                    key={id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={added}
                    aria-disabled={blocked || undefined}
                    data-country={id}
                    onClick={() => {
                      toggle(id);
                      input.current?.focus();
                    }}
                    onPointerMove={() => setActive(i)}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${
                      i === current ? "bg-fill outline-2 -outline-offset-2 outline-ink" : ""
                    } ${blocked ? "cursor-not-allowed" : ""}`}
                  >
                    {flag ? (
                      <FlagImage flag={flag} withheld={false} alt="" width={64} className="h-5 w-7" />
                    ) : (
                      <span aria-hidden="true" className="h-5 w-7 shrink-0 rounded-[2px] bg-lane-soft" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{nameOf(id)}</span>
                      <span className="block truncate text-xs text-ink-2">
                        <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span> {preview(country)}
                      </span>
                    </span>
                    <span
                      className={`flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium ${
                        added ? "bg-ink text-white" : blocked ? "text-ink-3" : "border border-edge text-ink"
                      }`}
                    >
                      {added ? t("added") : blocked ? t("limit") : t("add")}
                    </span>
                  </li>
                );
              })}
            </ul>
            {results.length === 0 && <p className="px-2 py-6 text-center text-sm text-ink-2">{t("none", { query })}</p>}

            {query.trim() === "" && (
              <div className="mt-2 space-y-3 border-t border-hairline px-2 pt-3">
                {suggestions.length > 0 && compareWith && (
                  <section>
                    <h3 className="text-2xs font-medium tracking-wide text-ink-3 uppercase">
                      {t("oftenCompared", { country: nameOf(compareWith) })}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {suggestions.map((id) => (
                        <button
                          key={id}
                          type="button"
                          aria-disabled={full}
                          onClick={() => toggle(id)}
                          className="flex h-8 items-center gap-1 rounded-full border border-edge px-3 text-sm font-medium hover:bg-fill aria-disabled:cursor-not-allowed aria-disabled:text-ink-3"
                        >
                          <span aria-hidden="true">+</span> {nameOf(id)}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <h3 className="text-2xs font-medium tracking-wide text-ink-3 uppercase">{t("presets")}</h3>
                  <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                    {presets.presets.map((preset) => {
                      const ids = preset.countries.filter((id) => countries.has(id)).slice(0, max);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            onPreset(ids);
                            close();
                          }}
                          className="rounded-lg border border-edge px-3 py-2 text-start hover:bg-fill"
                        >
                          <span className="block text-sm font-semibold">{preset.name[locale]}</span>
                          <span className="block truncate text-xs text-ink-2">{ids.map(nameOf).join(locale === "fa" ? "، " : ", ")}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
