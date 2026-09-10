/**
 * Render at a breakpoint's real width, shown scaled to fit.
 *
 * ── Why scale rather than shrink ──────────────────────────────────────────
 * A desktop layout has to LAY OUT at desktop width or it is not the layout
 * being previewed: put a 1280px nav in a 600px box and the tabs wrap, items
 * collapse, and what is on screen is the tablet arrangement wearing a desktop
 * label. Every judgement made from it would be about the wrong design.
 *
 * So the content is given its true width and the whole thing is transformed
 * down. Proportions, wrapping and overflow are all decided at the real width;
 * only the pixels shown are smaller.
 *
 * The scale is measured from the container rather than assumed, because the
 * card it sits in is itself responsive — a hardcoded ratio would be wrong on
 * every screen but the one it was picked on.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ScaledPreviewProps {
  /** Drawn on the SIZED box, not around it. A frame outside the scaler spans
   *  the container while the content sits at its own smaller width, so the
   *  empty remainder reads as part of the design — the same mistake the box
   *  width fixed one layer in. */
  frame?: boolean;
  /** The width to lay out at — the breakpoint's own lower bound. */
  width: number;
  children: ReactNode;
  /** Never scale UP. A mobile layout at 375px inside a 900px card would be
   *  magnified into something no device shows. */
  maxScale?: number;
  onScale?: (scale: number) => void;
}

export default function ScaledPreview({ width, children, maxScale = 1, onScale, frame }: ScaledPreviewProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;

    const measure = () => {
      const available = el.clientWidth;
      const next = Math.min(maxScale, available / width);
      setScale(next);
      onScale?.(next);
      /* A transform does not affect layout, so the wrapper keeps the untransformed
         height and leaves a gap beneath. Measuring the content and applying the
         scaled height is what closes it. */
      /* getBoundingClientRect reports the TRANSFORMED height, which is what
         the box needs — offsetHeight would give the untransformed one and
         leave a gap under a scaled-down preview. */
      const h = inner.current?.getBoundingClientRect().height;
      if (h) setHeight(h);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width, maxScale, onScale]);

  /* Three layers, and each earns its place.
     
     OUTER is full width purely to measure what is available. INNER BOX is the
     simulated viewport at its scaled size — this is what was missing: without
     it the box stayed full width while the content sat at its own smaller
     width, so a 600px preview drew a 600px bar inside a 1450px frame and the
     empty remainder read as part of the design. SCALED is the content at its
     true width, transformed down. */
  const boxWidth = Math.round(width * scale);

  return (
    <div ref={outer} style={{ width: '100%' }}>
      <div style={{
        width: boxWidth,
        maxWidth: '100%',
        height,
        overflow: 'hidden',
        border: frame ? '1px solid var(--Border)' : undefined,
        boxSizing: 'content-box',
      }}>
        <div
          ref={inner}
          style={{
            width,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
