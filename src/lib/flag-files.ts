/** Flags are mirrored into public/flags (pnpm mirror:flags), so no page loads images from another site. */
export const FLAG_WIDTHS = [96, 320] as const;
export type FlagWidth = (typeof FLAG_WIDTHS)[number];

/** A Commons file name as a safe file stem: "Flag of Japan (1870–1999).svg" → "flag-of-japan-1870-1999". */
export function flagSlug(file: string): string {
  return file
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The smallest mirrored size that is still at least as wide as requested. */
export function flagWidth(requested: number): FlagWidth {
  return FLAG_WIDTHS.find((w) => w >= requested) ?? FLAG_WIDTHS[FLAG_WIDTHS.length - 1];
}

export const flagPath = (file: string, requested: number) => `/flags/${flagSlug(file)}-${flagWidth(requested)}.png`;
