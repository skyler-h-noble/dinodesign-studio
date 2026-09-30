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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface ScaledPreviewProps {
  /** Drawn on the SIZED box, not around it. A frame outside the scaler spans
   *  the container while the content sits at its own smaller width, so the
   *  empty remainder reads as part of the design — the same mistake the box
   *  width fixed one layer in. */
  frame?: boolean;
  /** The width to lay out at — the breakpoint's own lower bound. */
  width: number;
  /** The device's height, so the frame is a SCREEN rather than a strip.
   *
   *  Without it the box is only as tall as the nav, and a top bar and a
   *  bottom bar end up stacked against each other with no page between —
   *  which is the one arrangement that tells you nothing about either. With
   *  it the content starts at the top and the bottom bar sits where a thumb
   *  would actually find it. */
  height?: number;
  children: ReactNode;
  /** Never scale UP. A mobile layout at 375px inside a 900px card would be
   *  magnified into something no device shows. */
  maxScale?: number;
  onScale?: (scale: number) => void;
  /** Crop anything outside the simulated viewport. Default on.
   *
   *  Turn it OFF while something is deliberately floating out of the bar — an
   *  open menu, a drawer — or the box crops it to the bar's own height and the
   *  panel is simply not there, with nothing on screen to say why. The box's
   *  height is COMPUTED from the untransformed content, so an absolutely
   *  positioned panel never counted towards it and never will. */
  clip?: boolean;
  /** Custom properties for the simulated viewport.
   *
   *  The nav's metrics land here rather than at :root so the size picker can
   *  rewrite them — which is what switching a Component-Size mode does in
   *  Figma, and what makes the preview show the size that was chosen. */
  style?: CSSProperties;
}

export default function ScaledPreview(
  { width, height: deviceHeight, children, maxScale = 1, onScale, frame, clip = true,
    style }: ScaledPreviewProps,
) {
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
      /* A transform does not affect layout, so the wrapper keeps the
         untransformed height and would leave a gap beneath. The box takes the
         scaled height instead — COMPUTED, not measured, and that is the fix
         rather than a shortcut.
         
         getBoundingClientRect reports the TRANSFORMED height, so reading it
         here raced the transform: the new scale had been handed to React but
         not yet painted, so the number came back from the PREVIOUS one. Wrong
         in both directions — too tall on the way down, and too short on the
         way back up, where overflow:hidden then cropped the bar.
         
         offsetHeight is the untransformed height and does not move when the
         scale does, so multiplying it is exact and has no ordering to get
         wrong. */
      /* A stated device height wins over the measured one. Measuring gives
         the height of the CONTENT, which is the nav — so a 1920x1080 desktop
         would come back 64px tall and the page would have nowhere to be. */
      const natural = deviceHeight ?? inner.current?.offsetHeight;
      if (natural) setHeight(Math.ceil(natural * next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width, deviceHeight, maxScale, onScale]);

  /* Three layers, and each earns its place.
     
     OUTER is full width purely to measure what is available. INNER BOX is the
     simulated viewport at its scaled size — this is what was missing: without
     it the box stayed full width while the content sat at its own smaller
     width, so a 600px preview drew a 600px bar inside a 1450px frame and the
     empty remainder read as part of the design. SCALED is the content at its
     true width, transformed down. */
  const boxWidth = Math.round(width * scale);

  return (
    <div ref={outer} style={{ width: '100%', ...style }}>
      <div style={{
        width: boxWidth,
        maxWidth: '100%',
        height,
        overflow: clip ? 'hidden' : 'visible',
        /* Only while something is escaping. A stacking context that outlives
           the panel would put the whole preview above the controls under it
           for no reason. */
        ...(clip ? {} : { position: 'relative' as const, zIndex: 2 }),
        border: frame ? '1px solid var(--Border)' : undefined,
        boxSizing: 'content-box',
      }}>
        <div
          ref={inner}
          style={{
            width,
            /* The device's full height, so the nav sits at the TOP of a
               screen rather than being vertically centred in a box that
               hugs it. Anything the nav does not occupy is page. */
            ...(deviceHeight ? { height: deviceHeight } : {}),
            display: 'flex',
            flexDirection: 'column',
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
