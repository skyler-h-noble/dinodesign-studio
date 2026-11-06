// library.ts — the live Figma library vocabulary, read from the captured file.
//
// figmaLibrary.live.json is a read-only Plugin API capture of the Omni Figma
// template (component sets with their variant axes and component properties,
// text styles, variable collections and modes). The code → Figma mapper uses
// it to spell every variant value exactly and to drop any value the live set
// does not have. Refresh it with the capture script in docs/code-to-figma.md.

import live from './figmaLibrary.live.json';

export interface LiveAxis { values: string[]; default: string }
export interface LiveProperty { type: 'BOOLEAN' | 'TEXT' | 'SLOT' | 'INSTANCE_SWAP'; default?: boolean | string }
export interface LiveSet {
  page: string;
  name: string;
  id: string;
  key: string;
  variants: number;
  defaultVariant: string | null;
  axes: Record<string, LiveAxis>;
  /** Keyed "Name#id" exactly as Figma reports it. */
  properties: Record<string, LiveProperty>;
}
export interface LiveComponent { page: string; name: string; id: string; key: string; properties: Record<string, LiveProperty> }
export interface LiveLibrary {
  capturedAt: string;
  fileKey: string;
  sets: LiveSet[];
  lone: LiveComponent[];
  textStyles: string[];
  collections: Array<{ name: string; modes: string[] }>;
  sizingVariables: string[];
}

export const LIBRARY = live as unknown as LiveLibrary;

/** A set (or lone component) by name. Set names win; trailing spaces in Figma names are ignored. */
export function findSet(name: string): LiveSet | undefined {
  const want = name.trim();
  return LIBRARY.sets.find((s) => s.name.trim() === want);
}

export function findComponent(name: string): LiveComponent | undefined {
  const want = name.trim();
  return LIBRARY.lone.find((c) => c.name.trim() === want);
}

/** Does the live set have this axis with exactly this value? */
export function hasVariantValue(setName: string, axis: string, value: string): boolean {
  const s = findSet(setName);
  return !!s?.axes[axis]?.values.includes(value);
}

/** The bare names of a set's properties of one type ("start-icon", "Padded Card Content"). */
export function propertyNames(setName: string, type: LiveProperty['type']): string[] {
  const s = findSet(setName) ?? findComponent(setName);
  if (!s) return [];
  return Object.entries(s.properties).filter(([, p]) => p.type === type).map(([k]) => k.replace(/#.*$/, ''));
}

export function hasTextStyle(name: string): boolean {
  return LIBRARY.textStyles.includes(name);
}

export function collectionModes(name: string): string[] | undefined {
  return LIBRARY.collections.find((c) => c.name === name)?.modes;
}
