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
import { platformFontFamilyCSS } from './typographyPlatform';
import type { TypographyStyle } from '../types';

/** The static file, verbatim. Kept for tooling that wants the shipped ramp. */
export const typographyTokensCSS = typographyTokensRaw;

/** typography-tokens.css for one design system. */
export function buildTypographyTokensCSS(typography: TypographyStyle[] | null | undefined): string {
  /* The platform blocks go LAST on purpose.
     They define --Platform-Font-Families-*, which every face in the ramp above
     reads. Custom properties resolve at use, not at parse, so position does not
     affect correctness — but it does put the whole Omni/System table in one
     readable place at the end of the file instead of scattering six
     declarations through each device block. */
  return `${spliceDesktopBlock(typographyTokensRaw, typography)}\n\n${platformFontFamilyCSS()}\n`;
}
