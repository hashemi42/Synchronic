"use client";

import { useId, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { OPEN_SEARCH_EVENT, REPO_URL } from "@/lib/site";

const noop = () => () => {};
const isApplePlatform = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** SH-1: the search trigger. It opens the Add-country dialog, which also answers to ⌘K / Ctrl+K. */
export function SearchTrigger() {
  const t = useTranslations("shell");
  const apple = useSyncExternalStore(noop, isApplePlatform, () => false);

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
      className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border border-edge px-2.5 text-sm font-medium text-ink-2 hover:bg-fill sm:px-3"
    >
      <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <span className="sr-only sm:not-sr-only">{t("search")}</span>
      <kbd dir="ltr" aria-hidden="true" className="hidden rounded border border-edge px-1.5 font-sans text-2xs text-ink-3 md:inline">
        {apple ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

/** SH-1: the view switch. The map is phase 1, so it is shown, named and not yet usable. */
export function ViewSwitch() {
  const t = useTranslations("shell");
  const soonId = useId();

  return (
    <div role="group" aria-label={t("view")} className="flex rounded-full border border-edge p-0.5">
      <span
        aria-current="page"
        className="flex h-8 items-center rounded-full bg-ink px-3 text-sm font-medium text-white"
      >
        {t("viewInfographic")}
      </span>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={soonId}
        title={t("soon")}
        className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-3"
      >
        {t("viewMap")}
        <span id={soonId} className="rounded-full bg-fill px-1.5 text-2xs text-ink-2">
          {t("soon")}
        </span>
      </button>
    </div>
  );
}

export function GithubLink() {
  const t = useTranslations("shell");
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("github")}
      title={t("github")}
      className="flex size-10 items-center justify-center rounded-full text-ink-2 hover:bg-fill hover:text-ink"
    >
      <svg viewBox="0 0 16 16" className="size-5" aria-hidden="true" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.6 7.6 0 018 4.58c.68 0 1.36.09 2 .26 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
  );
}
