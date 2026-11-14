"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

type Props = {
  id: string;
  country: string;
  position: number;
  total: number;
  /** The anchor lane stays first and cannot be moved (IN-9). */
  pinned: boolean;
  onMove: (step: -1 | 1) => void;
  onDragStart: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  /** Id of the text that explains the arrow keys. */
  hintId: string;
};

/**
 * IN-9: the grip that moves a lane. Drag it with a mouse or finger, or focus
 * it and press ↑ or ↓.
 */
export function LaneHandle({ id, country, position, total, pinned, onMove, onDragStart, hintId }: Props) {
  const t = useTranslations("reorder");
  if (pinned) {
    return (
      <span
        title={t("pinned")}
        className="flex size-6 shrink-0 items-center justify-center text-anchor"
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" className="size-3.5">
          <path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13.1l.7-4L2.2 6.3l4-.6z" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return (
    <button
      type="button"
      data-lane-handle={id}
      aria-label={t("handle", { country, position, total })}
      aria-describedby={hintId}
      title={t("tooltip")}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onDragStart(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") onMove(-1);
        else if (e.key === "ArrowDown") onMove(1);
        else return;
        e.preventDefault();
      }}
      className="-my-1 -ms-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-3 hover:bg-fill hover:text-ink active:cursor-grabbing"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true" fill="currentColor">
        <circle cx="6" cy="4" r="1.25" />
        <circle cx="10" cy="4" r="1.25" />
        <circle cx="6" cy="8" r="1.25" />
        <circle cx="10" cy="8" r="1.25" />
        <circle cx="6" cy="12" r="1.25" />
        <circle cx="10" cy="12" r="1.25" />
      </svg>
    </button>
  );
}
