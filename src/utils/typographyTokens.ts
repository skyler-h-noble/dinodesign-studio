// typography-tokens.css — the shipped static file plus the per-design build.
//
// The Desktop ramp is generated from the user's chosen faces (see
// ./typeScale.ts); IOS-Mobile / IOS-Tablet / Android pass through from the
// static file untouched.
import typographyTokensRaw from '../../public/files/typography-tokens.css?raw';
import { buildTypographyTokensCSS as spliceDesktopBlock } from './cssgen/generateTypographyTokensCSS';
import type { TypographyStyle } from '../types';

/** The static file, verbatim. Kept for tooling that wants the shipped ramp. */
export const typographyTokensCSS = typographyTokensRaw;

/** typography-tokens.css for one design system. */
export function buildTypographyTokensCSS(typography: TypographyStyle[] | null | undefined): string {
  return spliceDesktopBlock(typographyTokensRaw, typography);
}
