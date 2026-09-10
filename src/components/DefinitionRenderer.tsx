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

const tok = (t: TokenRef | undefined): string | undefined =>
  t ? `var(--${t.token.split('/').pop()})` : undefined;

const JUSTIFY: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between',
};
const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };

/** hug/fill/fixed map onto flex, not onto widths. A measured pixel here would
 *  pin a component built to adapt. */
function sizeStyle(node: NodeDef): CSSProperties {
  const s: CSSProperties = {};
  const apply = (v: Sizing | undefined, axis: 'width' | 'height') => {
    if (!v) return;
    if (v === 'fill') {
      if (axis === 'width') { s.flex = '1 1 0%'; s.minWidth = 0; }
      else { s.alignSelf = 'stretch'; }
    } else if (v === 'hug') {
      if (axis === 'width') s.flex = '0 0 auto';
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

function renderNode(node: NodeDef, opts: RenderOptions, key?: string): ReactNode {
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
    /* A radius that does not clip is a radius on the background only: a row
       hovering at the top of a rounded panel paints square corners over it.
       Not applied when something underneath is meant to hang outside — a menu
       inside a rounded frame would be clipped away by the very rule that
       tidies its corners. */
    ...(node.radius && !escapes(node) ? { overflow: 'hidden' as const } : {}),
    ...sizeStyle(node),
    // Sticky is a node property because only part of a nav sticks — the hero
    // scrolls away while the strip stays.
    ...(node.sticky ? { position: 'sticky' as const, top: 0, zIndex: 1 } : {}),
    /* Overlay: out of flow, pinned to a corner — or hung under the parent
       entirely, which is what a dropdown does. The parent is given
       position:relative below; without that it would anchor to whatever
       ancestor happens to be positioned, which is usually the page. */
    ...(node.overlay ? overlayStyle(node.overlay) : {}),
    // A parent of any overlay has to establish the containing block.
    ...((node.children || []).some((c) => c.overlay) ? { position: 'relative' as const } : {}),
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
      return (
        <div key={key} style={{ ...style, alignItems: cross }} {...surfaceAttrs}>
          <div style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: column ? 'column' : 'row',
            alignItems: cross,
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

  const children = (node.children || []).map((c, i) => renderNode(c, opts, `${node.name}-${i}`));

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
  return <>{renderNode(definition.root, opts)}</>;
}
