import { useRef, useCallback } from 'react';
import { Section } from '@omni-design/components';

/**
 * Two-axis light-position control, shared by the Shadow stage and the
 * /tune-shadows utility page. Both drive the same ShadowOptions, so the control
 * lives here rather than being written twice.
 */
// MISSING-LIB-COMPONENT: XYPad
// Needed for: two-axis light position — one drag sets both the horizontal and
//   vertical direction of the shadow, which two sliders cannot express as one
//   gesture.
// Proposed API: <XYPad x={-1..1} y={-1..1} onChange={(x, y) => void}
//   label="Light Position" quadrants dotGrid />
// Lib-track: add to @omni-design/components/src/components/XYPad/
export function LightPad({
  x, y, onChange,
}: { x: number; y: number; onChange: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromEvent = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((clientY - r.top) / r.height) * 2 - 1));
    onChange(Math.round(nx * 100) / 100, Math.round(ny * 100) / 100);
  }, [onChange]);

  const step = (dx: number, dy: number) =>
    onChange(
      Math.round(Math.max(-1, Math.min(1, x + dx)) * 100) / 100,
      Math.round(Math.max(-1, Math.min(1, y + dy)) * 100) / 100,
    );

  return (
    <Section
      surface="Surface-Dim"
      padding="0"
      style={{
        borderRadius: 8,
        border: '1px solid var(--Border-Variant)',
        /* Bounded, or a 1fr grid column on a wide screen makes this a
           1254px square. */
        width: '100%',
        maxWidth: 300,
      }}
    >
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={`Light position. Horizontal ${x.toFixed(2)}, vertical ${y.toFixed(2)}. Use arrow keys to move the light.`}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => { if (dragging.current) fromEvent(e.clientX, e.clientY); }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onKeyDown={(e) => {
          const d = e.shiftKey ? 0.01 : 0.05;
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d],
          };
          const m = moves[e.key];
          if (m) { e.preventDefault(); step(m[0], m[1]); }
        }}
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          width: '100%',
          cursor: 'crosshair',
          touchAction: 'none',
          borderRadius: 8,
          // Dot matrix + quadrant lines. Decoration only, so it takes
          // Border-Variant rather than Border.
          backgroundImage: [
            'radial-gradient(circle, var(--Border-Variant) 1px, transparent 1px)',
            'linear-gradient(to right, var(--Border-Variant) 1px, transparent 1px)',
            'linear-gradient(to bottom, var(--Border-Variant) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '10% 10%, 50% 100%, 100% 50%',
          backgroundPosition: '5% 5%, 0 0, 0 0',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${((x + 1) / 2) * 100}%`,
            top: `${((y + 1) / 2) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--Text)',
            boxShadow: '0 0 0 4px rgba(var(--Dropshadow-Color), 0.18)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </Section>
  );
}
