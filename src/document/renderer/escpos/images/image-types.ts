/** Decoded pixel data, always normalized to 4 bytes (RGBA) per pixel regardless of source format. */
export interface DecodedImage {
  width: number;
  height: number;
  /** Row-major, 4 bytes per pixel (R, G, B, A). */
  data: Buffer;
}
