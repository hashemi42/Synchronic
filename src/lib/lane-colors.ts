/**
 * Lane hues, the same values as `--hue` per `[data-country]` in globals.css (a unit test keeps
 * them in step), and the lane's main colour as sRGB hex for places CSS does not reach: the link
 * preview image (NF-6).
 */
export const LANE_HUES: Record<string, number> = {
  iran: 150,
  uk: 265,
  russia: 25,
  turkey: 350,
  france: 240,
  germany: 85,
  china: 50,
  india: 305,
  japan: 330,
};

/** oklch(L C h) → "#rrggbb", clipped to sRGB. */
export function oklchToHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return `#${linear
    .map((v) => {
      const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(Math.max(srgb, 0), 1) * 255).toString(16).padStart(2, "0");
    })
    .join("")}`;
}

/** The lane's first shade, `--color-lane-1: oklch(0.5 0.12 var(--hue))`. */
export const laneColor = (country: string) => oklchToHex(0.5, 0.12, LANE_HUES[country] ?? 260);
