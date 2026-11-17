/**
 * Mirrors every flag the data uses into public/flags, as PNG renditions at the widths in
 * src/lib/flag-files.ts, so the site serves its own images (no third-party requests or cookies).
 * Flags that are withheld (content policy §7.3) are never downloaded.
 *
 * Licence and attribution stay in each country file's `flags[]` and are shown on the politics card.
 * Existing files are kept; delete one to fetch it again.
 *
 * Run: pnpm mirror:flags
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { FLAG_WIDTHS, flagSlug } from "../src/lib/flag-files";

const UA = { "User-Agent": "SynchronicDataPipeline/0.1 (open-source history timeline)" };
const root = process.cwd();
const out = path.join(root, "public/flags");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const exists = (p: string) => stat(p).then(() => true, () => false);

async function download(file: string, width: number): Promise<Uint8Array> {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: UA, redirect: "follow" });
    if (res.ok) {
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) throw new Error(`${file}: expected an image, got ${type}`);
      return new Uint8Array(await res.arrayBuffer());
    }
    if (res.status === 429 || res.status >= 500) await sleep(2000 * (attempt + 1));
    else throw new Error(`${file} @${width}: HTTP ${res.status}`);
  }
  throw new Error(`${file} @${width}: gave up after retries`);
}

async function main() {
  const dir = path.join(root, "data/merged");
  const files = new Map<string, boolean>(); // file → withheld
  for (const name of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const data = JSON.parse(await readFile(path.join(dir, name), "utf8"));
    for (const flag of data.flags as { file: string; withheld?: boolean }[]) {
      files.set(flag.file, (files.get(flag.file) ?? false) || !!flag.withheld);
    }
  }
  const slugs = new Map<string, string>();
  for (const file of files.keys()) {
    const slug = flagSlug(file);
    if (slugs.has(slug) && slugs.get(slug) !== file) throw new Error(`Slug clash: ${file} and ${slugs.get(slug)}`);
    slugs.set(slug, file);
  }

  await mkdir(out, { recursive: true });
  let fetched = 0;
  let kept = 0;
  let skipped = 0;
  for (const [file, withheld] of files) {
    if (withheld) {
      skipped++;
      continue;
    }
    for (const width of FLAG_WIDTHS) {
      const target = path.join(out, `${flagSlug(file)}-${width}.png`);
      if (await exists(target)) {
        kept++;
        continue;
      }
      await writeFile(target, await download(file, width));
      fetched++;
      console.log(`↓ ${path.basename(target)}`);
      await sleep(400);
    }
  }
  console.log(`${fetched} fetched, ${kept} kept, ${skipped} withheld file(s) skipped → ${path.relative(root, out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
