// typography-tokens.css — the shipped static file plus the per-design build.
//
// The Desktop ramp is generated from the user's chosen faces (see
// ./typeScale.ts); IOS-Mobile / IOS-Tablet / Android pass through from the
// static file untouched.
/* Lives in src/, NOT public/. Vite treats publicDir as copy-verbatim and does
   not run it through the transform pipeline, so `?raw` from there resolved to
   an EMPTY STRING under vitest while working in a real build — the shape where
   a test of this pipeline passes on no input at all. Nothing fetches the file
   by URL, so src/ is where it belongs. */
import typographyTokensRaw from '../assets/typography-tokens.css?raw';
import { buildTypographyTokensCSS as spliceDesktopBlock } from './cssgen/generateTypographyTokensCSS';
import type { TypographyStyle } from '../types';

/** The static file, verbatim. Kept for tooling that wants the shipped ramp. */
export const typographyTokensCSS = typographyTokensRaw;

/** typography-tokens.css for one design system. */
export function buildTypographyTokensCSS(typography: TypographyStyle[] | null | undefined): string {
  return spliceDesktopBlock(typographyTokensRaw, typography);
}
