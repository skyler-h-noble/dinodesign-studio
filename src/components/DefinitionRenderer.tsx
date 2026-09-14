/**
 * Render a ComponentDefinition as React.
 *
 * The second compiler. toAddonSpec turns a definition into Figma nodes; this
 * turns the same definition into elements — so a preview built with it is not
 * a drawing of the component, it IS the component, and no hand-written copy
 * of the layout can drift from the spec.
 *
 * That was the objection to a live preview and this is what answers it: there
 * is one layout, described once, compiled twice.
 *
 * ── Where the surface goes ────────────────────────────────────────────────
 * A definition stores a surface LEVEL, not a paint, because the two targets
 * put it in different places. Figma names the variable group; here it becomes
 * a data-surface attribute and the fill is a plain var(--Background). Setting
 * the attribute is also the only correct way to paint in this codebase — it
 * exposes the whole paired token set rather than one colour.
 *
 * ── What this cannot do ───────────────────────────────────────────────────
 * Behaviour. A definition has no focus management, no keyboard handling and no
 * open/close state, so neither compiler can produce them; React owns those
 * around whatever this renders. A preview is honest about that by rendering
 * slots as empty regions rather than miming controls that do nothing.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ComponentDefinition, NodeDef, Sizing, TokenRef } from '../utils/addOns/defineComponent';

/* A custom property cannot contain a space, so a Figma variable that has one
   — Component-Size holds `App-Bar Height` — hyphenates on the way to CSS.
   navMetricsCSS emits the hyphenated name for exactly this reason; without
   the same conversion here the reference came out `var(--App-Bar Height)`,
   which is invalid and silently resolves to nothing. */
const tok = (t: TokenRef | undefined): string | undefined =>
  t ? `var(--${t.token.split('/').pop()!.replace(/ /g, '-')})` : undefined;

const JUSTIFY: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between',
};
const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };

/** hug/fill/fixed map onto flex, not onto widths. A measured pixel here would
 *  pin a component built to adapt. */
/** hug/fill/fixed map onto flex, and WHICH flex depends on the parent.
 *
 *  This assumed width was always the main axis — `fill` became `flex: 1` and
 *  height became alignSelf. In a ROW that is right. In a COLUMN it is exactly
 *  inverted: `flex: 1` grows the main axis, which is vertical there, so a bar
 *  declared width:'fill' height:'hug' grew to half the screen. A 64px app bar
 *  rendered 556px tall and split the frame with the page, and nothing about
 *  the definition was wrong.
 *
 *  So the parent's direction comes in, and each axis is classified as main or
 *  cross before being translated. */
function sizeStyle(node: NodeDef, parentDirection: 'row' | 'column'): CSSProperties {
  const s: CSSProperties = {};
  const apply = (v: Sizing | undefined, axis: 'width' | 'height') => {
    if (!v) return;
    const isMain = parentDirection === 'row' ? axis === 'width' : axis === 'height';
    if (v === 'fill') {
      if (isMain) {
        s.flex = '1 1 0%';
        if (axis === 'width') s.minWidth = 0; else s.minHeight = 0;
      } else {
        s.alignSelf = 'stretch';
      }
    } else if (v === 'hug') {
      /* Explicitly refuse to grow OR shrink on the main axis. A bar that hugs
         must not be stretched by a tall sibling, and must not be squeezed by
         one either. */
      if (isMain) s.flex = '0 0 auto';
    } else {
      s[axis] = tok(v.fixed);
      s.flexShrink = 0;
    }
  };
  apply(node.width, 'width');
  apply(node.height, 'height');
  return s;
}

export interface RenderOptions {
  /** Which conditions are currently true. A name absent here reads as false,
   *  so a part behind an unknown condition stays hidden rather than appearing
   *  by accident. */
  conditions?: Record<string, boolean>;
  /** Content per slot name. A slot with nothing supplied renders as an empty
   *  region — visible in a preview, invisible in use. */
  slots?: Record<string, ReactNode>;
  /** Outline empty slots and label them. Preview only. */
  showSlots?: boolean;
  /** Where content stops growing inside a full-bleed band, and how it sits in
   *  the leftover space. A property of the BREAKPOINT, not of the component —
   *  the same nav is uncapped at every narrower width — which is why it comes
   *  in as a render option rather than living in the definition. */
  contentMaxWidth?: number;
  contentAlign?: 'left' | 'center';
  /** Space the ROOT reserves for its own pinned bars.
   *
   *  On the root rather than on the Page slot, and the difference is the whole
   *  fix: with the rail beside the page, insetting only the Page left the rail
   *  to slide under a bar pinned above it. Everything inside the nav has to
   *  start below the bar, not just the part that holds content. */
  insets?: { top?: string; bottom?: string; left?: string; right?: string };
}

/** Where an overlay sits.
 *
 *  A corner anchor places the panel INSIDE the parent, inset from that corner.
 *  `drop` places it under the parent's bottom edge instead, keeping only the
 *  horizontal half of the anchor — which is the difference between a menu that
 *  sits on the avatar and one that opens below it.
 *
 *  The 4px gap and the zero side offset are the library's own Menu panel, not
 *  a fresh guess: a nav's account menu that floated a different distance from
 *  its trigger than every other menu in the system would be wrong in a way
 *  nobody could name. */
function overlayStyle(overlay: NonNullable<NodeDef['overlay']>): CSSProperties {
  const [v, h] = overlay.anchor.split('-') as ['top' | 'bottom', 'left' | 'right'];

  if (overlay.drop) {
    return {
      position: 'absolute',
      /* Above the bar it drops from AND above whatever the bar sits on. The
         corner overlays sit at 1 because they float over a hero inside the
         same component; this one has to clear the page. */
      zIndex: 20,
      top: '100%',
      marginTop: 'var(--Sizing-1, 4px)',
      ...(h === 'left' ? { left: 0 } : { right: 0 }),
    };
  }

  return {
    position: 'absolute',
    zIndex: 1,
    top: v === 'top' ? 'var(--Sizing-2, 8px)' : undefined,
    bottom: v === 'bottom' ? 'var(--Sizing-2, 8px)' : undefined,
    left: h === 'left' ? 'var(--Sizing-3, 12px)' : undefined,
    right: h === 'right' ? 'var(--Sizing-3, 12px)' : undefined,
  };
}

/** Whether anything under this node leaves its box. */
function escapes(node: NodeDef): boolean {
  return (node.children || []).some((c) => !!c.overlay || escapes(c));
}

function renderNode(
  node: NodeDef, opts: RenderOptions, key?: string,
  parentDirection: 'row' | 'column' = 'column',
): ReactNode {
  /* Presence is evaluated, not baked. `visibleWhen` in the Figma spec and this
     check are the same decision on two targets — which is why the definition
     stores the condition rather than a resolved boolean. */
  if (node.presence && node.presence !== 'always') {
    if (!opts.conditions?.[node.presence.when]) return null;
  }

  const style: CSSProperties = {
    display: 'flex',
    flexDirection: node.direction === 'column' ? 'column' : 'row',
    justifyContent: node.justify ? JUSTIFY[node.justify] : undefined,
    alignItems: node.align ? ALIGN[node.align] : undefined,
    gap: tok(node.gap),
    paddingTop: tok(node.padding?.top),
    paddingRight: tok(node.padding?.right),
    paddingBottom: tok(node.padding?.bottom),
    paddingLeft: tok(node.padding?.left),
    borderRadius: tok(node.radius),
    // A hairline in the token's colour, so it follows the surface it sits on.
    border: node.border ? `1px solid ${tok(node.border)}` : undefined,
    borderBottom: node.borderBottom ? `1px solid ${tok(node.borderBottom)}` : undefined,
    /* A radius that does not clip is a radius on the background only: a row
       hovering at the top of a rounded panel paints square corners over it.
       Not applied when something underneath is meant to hang outside — a menu
       inside a rounded frame would be clipped away by the very rule that
       tidies its corners. */
    ...(node.radius && !escapes(node) ? { overflow: 'hidden' as const } : {}),
    ...sizeStyle(node, parentDirection),
    /* PINNED leaves the flow; `sticky` then says how.
     
       fixed  stays put through a scroll — an app bar that is always there
       absolute  scrolls away with the page
     
       Either way the node is out of the flow, so the page has to be inset to
       clear it — which is what contentInsets computes. A pinned bar left in
       the flow would take its own space AND be inset for, pushing the content
       down by twice the bar's height. */
    ...(node.pin ? {
      position: (node.sticky ? 'fixed' : 'absolute') as 'fixed' | 'absolute',
      zIndex: 10,
      ...(node.pin === 'top' ? { top: 0, left: 0, right: 0 } : {}),
      ...(node.pin === 'bottom' ? { bottom: 0, left: 0, right: 0 } : {}),
      ...(node.pin === 'left' ? { top: 0, bottom: 0, left: 0 } : {}),
      ...(node.pin === 'right' ? { top: 0, bottom: 0, right: 0 } : {}),
    } : node.sticky ? { position: 'sticky' as const, top: 0, zIndex: 1 } : {}),
    /* Component-Elevations, by LEVEL. The geometry is the design system's —
       --Effect-Level-N — so the bar's shadow follows the brand's own shadow
       controls rather than carrying one this file invented. */
    ...(node.elevation ? { boxShadow: `var(--Effect-Level-${node.elevation})` } : {}),
    /* Overlay: out of flow, pinned to a corner — or hung under the parent
       entirely, which is what a dropdown does. The parent is given
       position:relative below; without that it would anchor to whatever
       ancestor happens to be positioned, which is usually the page. */
    ...(node.overlay ? overlayStyle(node.overlay) : {}),
    // A parent of any overlay has to establish the containing block.
    ...((node.children || []).some((c) => c.overlay || c.pin) ? { position: 'relative' as const } : {}),
    // The surface's own fill. data-surface below is what makes this resolve.
    ...(node.surface || node.theme ? { background: 'var(--Background)', color: 'var(--Text)' } : {}),
  };

  /* Both attributes, never a named colour. data-theme and data-surface expose
     the whole matched set — Background, Text, Quiet, Border and the rest — so
     painting var(--Background) below resolves correctly. Reaching for
     var(--Surface) instead would paint the box and leave everything in it on
     the parent's tone. */
  const surfaceAttrs = {
    ...(node.surface ? { 'data-surface': node.surface } : {}),
    ...(node.theme ? { 'data-theme': node.theme } : {}),
  };

  if (node.kind === 'text') {
    return <span key={key} style={style} {...surfaceAttrs}>{node.text}</span>;
  }

  if (node.kind === 'slot') {
    const supplied = opts.slots?.[node.name];
    if (supplied) {
      /* A filled slot is a REGION, and its content sits in it at natural size.
         
         Two defaults were fighting the content. align-items defaults to
         stretch, so a tab strip grew to the slot's full height and left a tall
         empty bar; and min-width:0 — needed so a FILL slot can shrink below its
         content — let the same strip be crushed to nothing when space ran
         short, which is how four tabs rendered as four hairlines.
         
         Centring fixes the first. For the second the slot still shrinks, but
         its content does not: an item that no longer fits OVERFLOWS, which is
         visible and is the thing the breakpoint switches exist to resolve.
         Crushing hides the same problem and looks like a rendering fault. */
      /* Centring is a ROW rule. align-items is the cross axis, so on a column
         slot — a menu panel, say — the same value centres each row on its own
         width instead of letting the rows share one edge, and the inner
         wrapper's implicit row direction lays them out side by side. A panel
         built that way renders its items in a line. */
      const column = node.direction === 'column';
      const cross = column ? 'stretch' : 'center';

      /* The wrapper exists to stop an ITEM being crushed — a tab strip with
         min-width:0 collapsed to four hairlines — so it hugs and refuses to
         shrink. That is exactly wrong for a REGION, which is declared `fill`
         precisely because it should take the space it is given.
         
         So it is decided per AXIS, from what the slot itself declares. Keying
         it on one axis was not enough: the Page is fill/fill and the Hero is
         fill/hug, and testing only the height collapsed the hero to the
         intrinsic size of an empty 16:9 box — fifteen pixels wide.
         
         An item is hug on both axes, so nothing that needs the protection
         loses it. */
      const fillsX = node.width === 'fill';
      const fillsY = node.height === 'fill';
      const isRegion = fillsX || fillsY;
      return (
        <div key={key} style={{ ...style, alignItems: fillsY ? 'stretch' : cross }} {...surfaceAttrs}>
          <div style={{
            flexShrink: isRegion ? 1 : 0,
            display: 'flex',
            flexDirection: column ? 'column' : 'row',
            alignItems: fillsY ? 'stretch' : cross,
            ...(fillsX ? { width: '100%', minWidth: 0 } : {}),
            ...(fillsY ? { flex: '1 1 auto' } : {}),
          }}>
            {supplied}
          </div>
        </div>
      );
    }
    return (
      <div
        key={key}
        style={{
          ...style,
          minHeight: opts.showSlots ? 28 : undefined,
          minWidth: opts.showSlots ? 56 : undefined,
          alignItems: 'center',
          justifyContent: 'center',
          border: opts.showSlots ? '1px dashed var(--Border-Variant)' : undefined,
          borderRadius: 'var(--Sizing-1, 4px)',
          padding: opts.showSlots ? '4px 8px' : undefined,
        }}
        {...surfaceAttrs}
      >
        {opts.showSlots && (
          <span style={{
            font: 'var(--Label-ExtraSmall-Font-Size, 11px)/1 var(--Font-Families-Body, sans-serif)',
            color: 'var(--Text-Quiet)', whiteSpace: 'nowrap',
          }}>{node.name}</span>
        )}
      </div>
    );
  }

  const dir: 'row' | 'column' = node.direction === 'column' ? 'column' : 'row';
  const children = (node.children || []).map((c, i) => renderNode(c, opts, `${node.name}-${i}`, dir));

  /* A band paints edge to edge and caps what is INSIDE it. Capping the band
     itself would leave bare page either side of a floating coloured strip;
     this gives an unbroken bar with its content aligned to the rest of the
     page, which is what a content ceiling means everywhere else. */
  if (node.band && opts.contentMaxWidth) {
    return (
      <div key={key} style={style} {...surfaceAttrs}>
        <div
          style={{
            display: 'flex',
            flexDirection: style.flexDirection,
            justifyContent: style.justifyContent,
            alignItems: style.alignItems,
            gap: style.gap,
            width: '100%',
            maxWidth: opts.contentMaxWidth,
            marginLeft: opts.contentAlign === 'center' ? 'auto' : undefined,
            marginRight: opts.contentAlign === 'center' ? 'auto' : undefined,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div key={key} style={style} {...surfaceAttrs}>
      {children}
    </div>
  );
}

export default function DefinitionRenderer(
  { definition, ...opts }: { definition: ComponentDefinition } & RenderOptions,
) {
  /* The root's own parent is the preview frame, which is a column. */
  const root = renderNode(definition.root, opts, undefined, 'column');
  if (!opts.insets || !Object.keys(opts.insets).length) return <>{root}</>;

  /* A wrapper rather than padding ON the root: the root paints the nav's
     surface, and padding it would put the bar's reserved space inside that
     paint — a band of nav-coloured nothing above the content. The wrapper
     carries the space and the root keeps its own box. */
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: '1 1 auto', minHeight: 0,
      paddingTop: opts.insets.top,
      paddingBottom: opts.insets.bottom,
      paddingLeft: opts.insets.left,
      paddingRight: opts.insets.right,
      boxSizing: 'border-box',
    }}>
      {root}
    </div>
  );
}
