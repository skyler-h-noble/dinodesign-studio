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
    ...sizeStyle(node),
    // Sticky is a node property because only part of a nav sticks — the hero
    // scrolls away while the strip stays.
    ...(node.sticky ? { position: 'sticky' as const, top: 0, zIndex: 1 } : {}),
    /* Overlay: out of flow, pinned to a corner. The parent is given
       position:relative below — without that it would anchor to whatever
       ancestor happens to be positioned, which is usually the page. */
    ...(node.overlay ? {
      position: 'absolute' as const,
      zIndex: 1,
      top: node.overlay.anchor.startsWith('top') ? 'var(--Sizing-2, 8px)' : undefined,
      bottom: node.overlay.anchor.startsWith('bottom') ? 'var(--Sizing-2, 8px)' : undefined,
      left: node.overlay.anchor.endsWith('left') ? 'var(--Sizing-3, 12px)' : undefined,
      right: node.overlay.anchor.endsWith('right') ? 'var(--Sizing-3, 12px)' : undefined,
    } : {}),
    // A parent of any overlay has to establish the containing block.
    ...((node.children || []).some((c) => c.overlay) ? { position: 'relative' as const } : {}),
    // The surface's own fill. data-surface below is what makes this resolve.
    ...(node.surface ? { background: 'var(--Background)' } : {}),
  };

  const surfaceAttrs = node.surface ? { 'data-surface': node.surface } : {};

  if (node.kind === 'text') {
    return <span key={key} style={style}>{node.text}</span>;
  }

  if (node.kind === 'slot') {
    const supplied = opts.slots?.[node.name];
    if (supplied) return <div key={key} style={style} {...surfaceAttrs}>{supplied}</div>;
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

  return (
    <div key={key} style={style} {...surfaceAttrs}>
      {(node.children || []).map((c, i) => renderNode(c, opts, `${node.name}-${i}`))}
    </div>
  );
}

export default function DefinitionRenderer(
  { definition, ...opts }: { definition: ComponentDefinition } & RenderOptions,
) {
  return <>{renderNode(definition.root, opts)}</>;
}
