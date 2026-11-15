import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { describeComparison, type ShareLane } from "@/lib/share";
import { parseTimelineParams } from "@/lib/url-params";

/*
 * NF-6: the preview image of a comparison link, 1200 × 630. Vazirmatn covers both scripts.
 *
 * The image renderer shapes Arabic letters but has no bidirectional layout, and it measures a
 * Persian run wider than it draws it. Persian text is therefore laid out word by word, right to
 * left, which keeps the order right at the cost of slightly uneven spaces between words.
 */
const fonts = Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/Vazirmatn-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/Vazirmatn-Bold.ttf")),
]);

const INK = "#161616";
const INK_2 = "#55534f";
const INK_3 = "#7a7772";
const CANVAS = "#f6f5f2";

function Words({ text, rtl, size, weight = 400, color = INK }: { text: string; rtl: boolean; size: number; weight?: number; color?: string }) {
  const style = { fontSize: size, fontWeight: weight, color, lineHeight: 1.25 };
  if (!rtl) return <div style={{ display: "flex", ...style }}>{text}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", flexWrap: "wrap", columnGap: size * 0.28, ...style }}>
      {text.split(/\s+/).map((word, i) => (
        <span key={i}>{word}</span>
      ))}
    </div>
  );
}

function Lane({ lane, rtl }: { lane: ShareLane; rtl: boolean }) {
  const ruler = lane.ruler ? (lane.title && !lane.ruler.startsWith(lane.title) ? `${lane.ruler} · ${lane.title}` : lane.ruler) : "—";
  return (
    <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "stretch", gap: 20 }}>
      <div style={{ width: 10, borderRadius: 5, background: lane.color }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: rtl ? "flex-end" : "flex-start", gap: 2, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "baseline", gap: 14 }}>
          <Words text={lane.country} rtl={rtl} size={28} weight={700} />
          <Words text={lane.state} rtl={rtl} size={22} color={INK_3} />
        </div>
        <Words text={ruler} rtl={rtl} size={26} color={INK_2} />
      </div>
    </div>
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const share = describeComparison(parseTimelineParams(request.nextUrl.searchParams), locale);
  if (!share) return new Response("Not found", { status: 404 });
  const rtl = locale === "fa";
  const [regular, bold] = await fonts;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: CANVAS,
          padding: "44px 64px",
          fontFamily: "Vazirmatn",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>Synchronic</div>
          <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", alignItems: "baseline", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 56, fontWeight: 700 }}>{share.year}</div>
            {share.yearSecondary && <Words text={share.yearSecondary} rtl={rtl} size={28} color={INK_3} />}
          </div>
        </div>
        {share.anchor && (
          <div style={{ display: "flex", justifyContent: rtl ? "flex-end" : "flex-start", marginTop: 4 }}>
            <Words text={share.title} rtl={rtl} size={24} color={INK_3} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24, flex: 1, overflow: "hidden" }}>
          {share.lanes.map((lane) => (
            <Lane key={lane.id} lane={lane} rtl={rtl} />
          ))}
        </div>
        {share.moreText && (
          <div style={{ display: "flex", justifyContent: rtl ? "flex-end" : "flex-start" }}>
            <Words text={share.moreText} rtl={rtl} size={24} color={INK_3} />
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
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
