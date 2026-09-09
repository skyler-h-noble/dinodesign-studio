/**
 * A diagram of a nav layout, not a rendering of it.
 *
 * Deliberately schematic. Drawing the real component here would be a second
 * implementation of the layout, and the two would disagree the moment either
 * changed — the failure the shared-definition architecture exists to prevent.
 * A diagram promises only what it is: where the parts sit relative to each
 * other.
 *
 * Every colour is a token, so the previews follow the brand rather than being
 * grey boxes that look the same in every design system.
 */
import type { NavLayout, NavOptions } from '../utils/addOns/navDefinition';

const W = 200;
const H = 96;

/** Shapes stand for kinds of content, so a layout reads at a glance:
 *  a filled square is the brand, a bar is navigation, circles are actions. */
const Brand = ({ x, y }: { x: number; y: number }) => (
  <rect x={x} y={y} width={16} height={16} rx={3} fill="var(--Buttons-Primary-Button)" />
);
const Tab = ({ x, y, w = 22 }: { x: number; y: number; w?: number }) => (
  <rect x={x} y={y + 5} width={w} height={6} rx={3} fill="var(--Text-Quiet)" />
);
const Dot = ({ x, y }: { x: number; y: number }) => (
  <circle cx={x + 6} cy={y + 8} r={6} fill="var(--Border)" />
);

function RightGroup({ x, y, options }: { x: number; y: number; options: NavOptions }) {
  const items = [options.search, options.actions, options.avatar].filter(Boolean).length || 1;
  return (
    <>
      {Array.from({ length: items }, (_, i) => (
        <Dot key={i} x={x - i * 16} y={y} />
      ))}
    </>
  );
}

export default function NavLayoutPreview(
  { layout, options }: { layout: NavLayout; options: NavOptions },
) {
  const o = { ...options, layout };
  const barY = layout === 'hero' ? 60 : 12;
  const right = W - 22;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`${layout} nav layout`}
      style={{ display: 'block', borderRadius: 'var(--Card-Radius, 8px)' }}
    >
      {/* The page. */}
      <rect x="0" y="0" width={W} height={H} rx="6" fill="var(--Background)" stroke="var(--Border)" />

      {/* Hero: a filled block the tab strip sits under.
          --Border-Variant, because this is DECORATION — the token documented as
          carrying no contrast requirement. --Hover is a state and --Container a
          surface; borrowing either to shade a diagram gives it a meaning it
          does not have, and surfaces are supposed to come from data-surface
          rather than being named directly. */}
      {layout === 'hero' && (
        <rect x="6" y="6" width={W - 12} height="46" rx="4" fill="var(--Border-Variant)" />
      )}

      {/* Rail: full height down the side, which is why it is drawn outside the bar. */}
      {layout === 'rail' && (
        <rect x="6" y="6" width="28" height={H - 12} rx="4" fill="var(--Border-Variant)" />
      )}

      {/* The bar itself. On hero it sits below and is the part that sticks. */}
      <rect
        x={layout === 'rail' ? 40 : 6}
        y={barY}
        width={(layout === 'rail' ? W - 46 : W - 12)}
        height="28"
        rx="4"
        fill="transparent"
        stroke={layout === 'hero' ? 'var(--Border)' : 'none'}
      />

      {layout === 'brand-left' && (
        <>
          <Brand x={14} y={barY + 6} />
          <Tab x={44} y={barY} /><Tab x={72} y={barY} /><Tab x={100} y={barY} />
          <RightGroup x={right} y={barY + 6} options={o} />
        </>
      )}

      {layout === 'brand-centre' && (
        <>
          <Tab x={14} y={barY} w={14} /><Tab x={34} y={barY} w={14} />
          <Brand x={W / 2 - 8} y={barY + 6} />
          <RightGroup x={right} y={barY + 6} options={o} />
        </>
      )}

      {layout === 'rail' && (
        <>
          <Tab x={12} y={20} w={16} /><Tab x={12} y={36} w={16} /><Tab x={12} y={52} w={16} />
          <Brand x={48} y={barY + 6} />
          <RightGroup x={right} y={barY + 6} options={o} />
        </>
      )}

      {layout === 'hero' && (
        <>
          {/* Condensed: brand and actions animate in once the hero is past,
              so they are drawn faintly — present, but not yet. */}
          {o.condensed && <g opacity="0.45"><Brand x={14} y={barY + 6} /></g>}
          <Tab x={o.condensed ? 38 : 14} y={barY} />
          <Tab x={o.condensed ? 66 : 42} y={barY} />
          <Tab x={o.condensed ? 94 : 70} y={barY} />
          <g opacity={o.condensed ? 0.45 : 1}>
            <RightGroup x={right} y={barY + 6} options={o} />
          </g>
        </>
      )}
    </svg>
  );
}
