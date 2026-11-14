"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { DEFAULTS, toSearch, useTimelineState } from "@/lib/url-state";

const labels = { en: "EN", fa: "فا" } as const;
const names = { en: "English", fa: "فارسی" } as const;

/** Switching language keeps the comparison: year, lanes and anchor travel in the query. */
export function LanguageSwitch({ legend }: { legend: string }) {
  const locale = useLocale();
  const state = useTimelineState();
  const href = state === DEFAULTS ? "/" : `/?${toSearch(state)}`;

  return (
    <ul aria-label={legend} className="flex items-center rounded-full border border-edge p-0.5">
      {routing.locales.map((l) => (
        <li key={l}>
          <Link
            href={href}
            locale={l}
            lang={l}
            aria-label={names[l]}
            aria-current={l === locale ? "true" : undefined}
            className={`flex h-8 min-w-10 items-center justify-center rounded-full px-3 text-sm font-medium ${
              l === locale ? "bg-ink text-white" : "text-ink-2 hover:bg-fill"
            }`}
          >
            {labels[l]}
          </Link>
        </li>
      ))}
    </ul>
  );
}
