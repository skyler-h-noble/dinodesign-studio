/** imagetracerjs ships no types; only the call the Brand add-on makes is declared. */
declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToSVG(imgd: { width: number; height: number; data: Uint8ClampedArray }, options?: Record<string, unknown>): string;
  };
  export default ImageTracer;
}
