import type { Flag } from "@/lib/data/schema";

/** Flags are served by Wikimedia Commons; licence and attribution travel with each record. */
const src = (file: string, width: number) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

type Props = {
  flag: Flag;
  /** True when the state is on the withheld list or the record says so (PO-4). */
  withheld: boolean;
  /** Empty when the state's name is written next to the flag. */
  alt: string;
  /** Rendered pixel width of the request; pick about twice the displayed width. */
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
    // A plain <img>: the pages are static and the files are SVGs scaled by Commons.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src(flag.file, width)} alt={alt} loading="lazy" decoding="async" className={`bg-fill object-cover ${box}`} />
  );
}
