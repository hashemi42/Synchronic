/**
 * Text for the link-preview images (NF-6), drawn as SVG paths. The image renderer joins Persian
 * letters but lays text out left to right and measures it wrongly, so Persian lines are shaped here
 * instead: the Unicode bidirectional algorithm (bidi-js) orders the runs, harfbuzz shapes each run
 * (and mirrors brackets in right-to-left runs itself), and each glyph's outline becomes a path.
 * Server only.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import bidiFactory from "bidi-js";
import type { HarfBuzz, HbFace, HbFont } from "harfbuzzjs";

export type Weight = 400 | 700;
type Shaper = { hb: HarfBuzz; fonts: Record<Weight, { font: HbFont; face: HbFace }> };

const FONT_FILES: Record<Weight, string> = { 400: "Vazirmatn-Regular.ttf", 700: "Vazirmatn-Bold.ttf" };
const bidi = bidiFactory();

let shaper: Promise<Shaper> | null = null;
function load(): Promise<Shaper> {
  shaper ??= (async () => {
    // A CommonJS module whose export is a promise, loaded as such (it is not bundled).
    const hb = await (createRequire(import.meta.url)("harfbuzzjs") as Promise<HarfBuzz>);
    const entries = await Promise.all(
      ([400, 700] as Weight[]).map(async (weight) => {
        const data = await readFile(join(process.cwd(), "src/assets/fonts", FONT_FILES[weight]));
        const face = hb.createFace(hb.createBlob(new Uint8Array(data)), 0);
        return [weight, { face, font: hb.createFont(face) }] as const;
      }),
    );
    return { hb, fonts: Object.fromEntries(entries) as Shaper["fonts"] };
  })();
  return shaper;
}

type Run = { level: number; text: string };

/** Splits a line into runs in visual order (left to right), each in the order harfbuzz expects. */
export function visualRuns(text: string, base: "ltr" | "rtl"): Run[] {
  const embedding = bidi.getEmbeddingLevels(text, base);
  const chars = [...text];
  const order = chars.map((_, i) => i);
  for (const [from, to] of bidi.getReorderSegments(text, embedding)) {
    const segment = order.slice(from, to + 1).reverse();
    order.splice(from, segment.length, ...segment);
  }
  const runs: { level: number; idx: number[] }[] = [];
  for (const i of order) {
    const level = embedding.levels[i];
    const last = runs.at(-1);
    if (last && last.level === level) last.idx.push(i);
    else runs.push({ level, idx: [i] });
  }
  // A right-to-left run is listed right to left in visual order; harfbuzz wants it in logical order,
  // and mirrors its brackets when told the run is right to left.
  return runs.map((run) => {
    const idx = run.level % 2 ? [...run.idx].reverse() : run.idx;
    return { level: run.level, text: idx.map((i) => chars[i]).join("") };
  });
}

export type ShapedLine = { svg: string; width: number; height: number };

/**
 * One line of text as an SVG image of the given font size, `size * 1.45` tall. When `maxWidth` is
 * given and the line is wider, whole words are dropped from its end and "…" added.
 */
export async function shapeLine(
  text: string,
  { size, weight = 400, color = "#161616", dir = "rtl", maxWidth }: { size: number; weight?: Weight; color?: string; dir?: "ltr" | "rtl"; maxWidth?: number },
): Promise<ShapedLine> {
  const { hb, fonts } = await load();
  const { font, face } = fonts[weight];
  const scale = size / face.upem;
  const height = Math.ceil(size * 1.45);
  const baseline = size * 1.08;

  const draw = (line: string) => {
    let x = 0;
    const paths: string[] = [];
    for (const run of visualRuns(line, dir)) {
      const buffer = hb.createBuffer();
      buffer.addText(run.text);
      buffer.guessSegmentProperties();
      buffer.setDirection(run.level % 2 ? "rtl" : "ltr");
      hb.shape(font, buffer);
      for (const glyph of buffer.json()) {
        const d = font.glyphToPath(glyph.g);
        if (d) {
          const gx = ((x + glyph.dx) * scale).toFixed(2);
          const gy = (baseline - glyph.dy * scale).toFixed(2);
          paths.push(`<path transform="translate(${gx} ${gy}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" d="${d}"/>`);
        }
        x += glyph.ax;
      }
      buffer.destroy();
    }
    return { paths, width: Math.ceil(x * scale) };
  };

  let line = text;
  let shaped = draw(line);
  if (maxWidth !== undefined && shaped.width > maxWidth) {
    const words = text.split(" ");
    while (words.length > 1 && shaped.width > maxWidth) {
      words.pop();
      line = `${words.join(" ")}…`;
      shaped = draw(line);
    }
  }
  const width = Math.max(shaped.width, 1);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="${color}">${shaped.paths.join("")}</svg>`,
    width,
    height,
  };
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
