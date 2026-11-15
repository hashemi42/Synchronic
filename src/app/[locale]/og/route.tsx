import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { shapeLine, svgDataUri, type Weight } from "@/lib/og-text";
import { describeComparison } from "@/lib/share";
import { parseTimelineParams } from "@/lib/url-params";

/*
 * NF-6: the preview image of a comparison link, 1200 × 630, in Vazirmatn (both scripts).
 *
 * The image renderer joins Persian letters but has no right-to-left layout and measures Persian
 * runs wrongly, so in the Persian image every line is shaped with harfbuzz, ordered with the
 * Unicode bidirectional algorithm and drawn as SVG paths (src/lib/og-text.ts). English text is
 * left to the renderer.
 */
const fonts = Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/Vazirmatn-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/Vazirmatn-Bold.ttf")),
]);

const INK = "#161616";
const INK_2 = "#55534f";
const INK_3 = "#7a7772";
const CANVAS = "#f6f5f2";
const WIDTH = 1200;
const PAD = 64;
/** Room for text beside a lane's colour bar. */
const TEXT_WIDTH = WIDTH - 2 * PAD - 30;

type Text = { text: string; size: number; weight?: Weight; color?: string; maxWidth?: number };

/** One piece of text: shaped paths in Persian, plain text in English. */
async function textFor(rtl: boolean, { text, size, weight = 400, color = INK, maxWidth }: Text): Promise<{ node: ReactNode; width: number }> {
  if (rtl) {
    const shaped = await shapeLine(text, { size, weight, color, dir: "rtl", maxWidth });
    // eslint-disable-next-line @next/next/no-img-element -- the image renderer takes a plain <img>
    return { node: <img src={svgDataUri(shaped.svg)} width={shaped.width} height={shaped.height} alt="" />, width: shaped.width };
  }
  return {
    node: (
      // The renderer cannot take an undefined style value, so maxWidth is only set when given.
      <div style={{ display: "flex", fontSize: size, fontWeight: weight, color, lineHeight: 1.25, overflow: "hidden", whiteSpace: "nowrap", ...(maxWidth ? { maxWidth } : {}) }}>
        {text}
      </div>
    ),
    width: 0,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const share = describeComparison(parseTimelineParams(request.nextUrl.searchParams), locale);
  if (!share) return new Response("Not found", { status: 404 });
  const rtl = locale === "fa";
  const [regular, bold] = await fonts;
  const t = (piece: Text) => textFor(rtl, piece);

  const year = await t({ text: share.year, size: 56, weight: 700 });
  const yearSecondary = share.yearSecondary ? await t({ text: share.yearSecondary, size: 28, color: INK_3 }) : null;
  const subtitle = share.anchor ? await t({ text: share.title, size: 24, color: INK_3, maxWidth: WIDTH - 2 * PAD }) : null;
  const more = share.moreText ? await t({ text: share.moreText, size: 24, color: INK_3 }) : null;
  const lanes = await Promise.all(
    share.lanes.map(async (lane) => {
      const country = await t({ text: lane.country, size: 28, weight: 700 });
      const state = await t({ text: lane.state, size: 22, color: INK_3, maxWidth: Math.max(TEXT_WIDTH - country.width - 14, 120) });
      const ruler = lane.ruler ? (lane.title && !lane.ruler.startsWith(lane.title) ? `${lane.ruler} · ${lane.title}` : lane.ruler) : "—";
      return { lane, country, state, ruler: await t({ text: ruler, size: 26, color: INK_2, maxWidth: TEXT_WIDTH }) };
    }),
  );
  const row = rtl ? "row-reverse" : "row";
  const edge = rtl ? "flex-end" : "flex-start";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: CANVAS,
          padding: `44px ${PAD}px`,
          fontFamily: "Vazirmatn",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: row, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>Synchronic</div>
          <div style={{ display: "flex", flexDirection: row, alignItems: rtl ? "center" : "baseline", gap: 16 }}>
            {year.node}
            {yearSecondary?.node}
          </div>
        </div>
        {subtitle && <div style={{ display: "flex", justifyContent: edge, marginTop: 4 }}>{subtitle.node}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24, flex: 1, overflow: "hidden" }}>
          {lanes.map(({ lane, country, state, ruler }) => (
            <div key={lane.id} style={{ display: "flex", flexDirection: row, alignItems: "stretch", gap: 20 }}>
              <div style={{ width: 10, borderRadius: 5, background: lane.color }} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: edge, gap: 2, flex: 1 }}>
                <div style={{ display: "flex", flexDirection: row, alignItems: rtl ? "center" : "baseline", gap: 14 }}>
                  {country.node}
                  {state.node}
                </div>
                {ruler.node}
              </div>
            </div>
          ))}
        </div>
        {more && <div style={{ display: "flex", justifyContent: edge }}>{more.node}</div>}
      </div>
    ),
    {
      width: WIDTH,
      height: 630,
      fonts: [
        { name: "Vazirmatn", data: regular, weight: 400, style: "normal" },
        { name: "Vazirmatn", data: bold, weight: 700, style: "normal" },
      ],
      // Data changes only with a deploy, so previews can be cached for a day.
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
