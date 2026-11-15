/** The parts of harfbuzzjs (https://github.com/harfbuzz/harfbuzzjs) the link-preview images use. */
declare module "harfbuzzjs" {
  export type HbGlyph = { g: number; cl: number; ax: number; ay: number; dx: number; dy: number };
  export type HbBuffer = {
    addText(text: string): void;
    guessSegmentProperties(): void;
    setDirection(direction: "ltr" | "rtl" | "ttb" | "btt"): void;
    json(): HbGlyph[];
    destroy(): void;
  };
  export type HbFace = { upem: number };
  export type HbFont = { glyphToPath(glyph: number): string };
  export type HarfBuzz = {
    createBlob(data: ArrayBuffer | Uint8Array): unknown;
    createFace(blob: unknown, index: number): HbFace;
    createFont(face: HbFace): HbFont;
    createBuffer(): HbBuffer;
    shape(font: HbFont, buffer: HbBuffer): void;
  };
  const harfbuzz: Promise<HarfBuzz>;
  export default harfbuzz;
}
