// schema.ts — the code → Figma IR: what the plugin's "Build from code" step
// consumes. docs/code-to-figma.md is the prose version of this file; keep the
// two in step (the doc names this file as the source of truth).
//
// Plain JSON, no functions, keys in a fixed order, so the same recorded state
// produces the same bytes.

export const C2F_SCHEMA = 'omni-code2figma-ir/1';

export type Status = 'clean' | 'lossy' | 'needsTable' | 'unmapped';

/**
 * What the CODE said about a component, in a small comparable form: the
 * export, the props that matter to the design (lib defaults dropped) and its
 * text. Informational for the plugin (it may stash it in plugin data); the
 * round-trip test compares it with what Figma → code gives back.
 */
export interface Signature {
  c: string;
  p: Record<string, string | number | boolean>;
  t?: string;
}

/** A spacing number, and the Sizing variable to bind it to when it is on the scale. */
export interface Space {
  px: number;
  /** "Sizing-2" — a FLOAT variable in the Sizing collection. Absent = off the scale; draw the px. */
  variable?: string;
}

export type Align = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | 'BASELINE';

export interface Layout {
  /** GRID needs Figma's grid auto-layout; see `gridFallback` for older Figma. */
  mode: 'VERTICAL' | 'HORIZONTAL' | 'GRID';
  itemSpacing?: Space;
  /** GRID only: row gap (itemSpacing is the column gap). */
  rowSpacing?: Space;
  padding?: { top: Space; right: Space; bottom: Space; left: Space };
  /** primaryAxisAlignItems. Absent = MIN. */
  primary?: Align;
  /** counterAxisAlignItems. Absent = MIN. */
  counter?: Align;
  wrap?: true;
  /** GRID only. */
  columns?: number;
  /** GRID only: HORIZONTAL + wrap with each child FIXED at its span's width. */
  gridFallback?: { mode: 'HORIZONTAL'; wrap: true };
}

export interface Sizing {
  /** layoutSizingHorizontal / Vertical. Absent = HUG (or the component's own). */
  h?: 'FILL' | 'FIXED' | 'HUG';
  v?: 'FILL' | 'FIXED' | 'HUG';
  /** px for a FIXED axis. */
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * Variable modes set ON this node (setExplicitVariableModeForCollection),
 * keyed by the EXACT collection name in the template (".Theme", "Surface",
 * "Buttons", "Component-Size", ".Elevation", "Icons & Avatars", ".Modes",
 * "Devices-Type"). Value = exact mode name.
 */
export type Modes = Record<string, string>;

interface Base {
  /** Stable within one IR: the child-index path ("0.3.1"). */
  id: string;
  /** Layer name to give the node. */
  name: string;
  status: Status;
  /** Where it came from in the code: the lib export, icon, or HTML tag. */
  source: string;
  sizing?: Sizing;
  modes?: Modes;
  /** layoutPositioning ABSOLUTE at this offset inside the parent. */
  absolute?: { x?: number; y?: number };
  /** Why the node is lossy / needs a table / unmapped, and what was normalized. */
  notes?: string[];
}

export interface FrameNode extends Base {
  kind: 'frame';
  layout: Layout;
  /** Bind the frame's fill to this COLOR variable ("Background"). Absent = no fill. */
  fill?: { variable: string };
  /** The span this frame takes in a GRID parent. */
  gridColumnSpan?: number;
  children: Node[];
}

export interface InstanceNode extends Base {
  kind: 'instance';
  /** The component set (or lone component), by its name in the template. */
  component: { set: string; key?: string };
  /** Variant axes → exact value. Every axis the set has is given. */
  variant: Record<string, string>;
  /** BOOLEAN / TEXT component properties by bare name ("start-icon", "Icon name"); the plugin adds the "#id" suffix. */
  properties?: Record<string, boolean | string>;
  /** Text layers without a TEXT property, by role: the plugin finds the layer (see docs) and sets characters. */
  text?: Record<string, string>;
  /** Instances nested inside this one that need their own variant / text (icons in a button). */
  nested?: Array<{ role: string; node: InstanceNode }>;
  /** Children to append into a SLOT of the instance, by slot name. */
  slots?: Record<string, Node[]>;
  /** Image to fill the named layer (or the instance's slot) with. */
  image?: ImageFill;
  /** What the code said that has no Figma home, kept for the designer (aria-label, href). */
  pluginData?: Record<string, string>;
  code?: Signature;
}

export interface TextNode extends Base {
  kind: 'text';
  characters: string;
  /** Exact local text style name ("Body-Medium"). */
  textStyle: string;
  /** Bind the text fill to this COLOR variable ("Quiet", "Text-Primary"). Absent = the style's own. */
  fill?: { variable: string };
  align?: 'LEFT' | 'CENTER' | 'RIGHT';
  decoration?: 'STRIKETHROUGH' | 'UNDERLINE';
  code?: Signature;
}

export interface ImageFill {
  src: string;
  alt?: string;
  scaleMode: 'FILL' | 'FIT';
}

export interface ImageNode extends Base {
  kind: 'image';
  image: ImageFill;
}

/** A labeled frame where nothing in the template draws this yet. */
export interface PlaceholderNode extends Base {
  kind: 'placeholder';
  /** The component the code used. */
  component: string;
  /** A template set that exists for it but has no prop table yet. */
  figmaSet?: string;
  reason: string;
  layout: Layout;
  children: Node[];
}

export type Node = FrameNode | InstanceNode | TextNode | ImageNode | PlaceholderNode;

export interface Coverage {
  /** Drawn nodes, by status. Pass-through components (providers) are not counted. */
  clean: number;
  lossy: number;
  needsTable: number;
  unmapped: number;
  counted: number;
  /** clean / counted. */
  cleanRatio: number;
  /** Nodes drawn as their system equivalent (spacer, Subtitle) — counted in clean. */
  normalized: number;
  /** cleanRatio with normalized nodes counted as lossy, as the 2026-11-06 prototype did. */
  cleanRatioStrict: number;
  byComponent: Record<string, Partial<Record<Status, number>>>;
}

export interface ReportEntry { id: string; source: string; message: string }

export interface C2FDocument {
  schema: typeof C2F_SCHEMA;
  app: string;
  state: {
    name: string;
    route: string;
    description?: string;
    viewport: { name: string; width: number; height: number };
    mode: 'light' | 'dark';
  };
  /** Where the live variant names came from. */
  library: { fileKey: string; capturedAt: string };
  /** The top-level frame: one page state at one viewport. */
  root: FrameNode;
  coverage: Coverage;
  /** Every normalization made, so the designer knows where Figma and code differ on purpose. */
  normalizations: ReportEntry[];
  /** Every node drawn as a placeholder, with the reason. */
  placeholders: ReportEntry[];
}
