import type { Flag } from "@/lib/data/schema";
import { flagPath } from "@/lib/flag-files";

/*
 * Flags come from Wikimedia Commons but are served from our own origin (public/flags, filled by
 * `pnpm mirror:flags`), so a page makes no third-party requests. Licence and attribution travel
 * with each record and are shown on the politics card.
 */

type Props = {
  flag: Flag;
  /** True when the state is on the withheld list or the record says so (PO-4). */
  withheld: boolean;
  /** Empty when the state's name is written next to the flag. */
  alt: string;
  /** About twice the displayed width; the nearest mirrored size at least this wide is used. */
  width?: number;
  className?: string;
};

export function FlagImage({ flag, withheld, alt, width = 64, className = "" }: Props) {
  const box = `shrink-0 rounded-[2px] border border-black/25 ${className}`;
  if (withheld || flag.withheld) {
    // A neutral placeholder; the state's name beside it carries the meaning.
    return <span role={alt ? "img" : undefined} aria-label={alt || undefined} className={`inline-block bg-edge ${box}`} />;
  }
  return (
    // A plain <img>: the pages are static and the renditions are prebuilt PNGs.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flagPath(flag.file, width)} alt={alt} loading="lazy" decoding="async" className={`bg-fill object-cover ${box}`} />
  );
}

/** Stands where a flag would be when none is documented (PRD §7.7). The words beside it say so. */
export function NoFlagMark({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-[2px] border border-dashed ${className}`} />;
}
