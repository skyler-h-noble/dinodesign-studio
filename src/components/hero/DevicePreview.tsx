/**
 * The hero at desktop, tablet and phone sizes at once — each rendered at the
 * device's real width with its data-device set, so the design system's own
 * type sizes and --Margin apply, then scaled down to fit. What is drawn is
 * the exported HTML, unchanged.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Caption, VStack } from '@omni-design/components';
import type { DeviceMode } from '../../utils/deviceChrome';

export type HeroPlatform = 'ios' | 'android';

export interface HeroDevice {
  key: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  label: string;
  /** The CSS data-device value; Desktop is the :root default and sets none. */
  cssDevice: string | null;
  /** The Devices-Type mode, for the margin. */
  mode: DeviceMode;
  width: number;
  height: number;
  /** The size class's margin, from the same Figma table. */
  margin: number;
}

/* The four breakpoints the portfolio plugin renders — Desktop 1440, Laptop
   1024, Tablet 768, Mobile 320 — each drawn with the Omni device whose type it
   stands for. Omni switches type on data-device, not on width, so Desktop and
   Laptop share the desktop ramp; the platform toggle decides which tablet and
   phone ramp the two narrow ones wear. Margins are Figma's: Desktop Default
   64, Desktop Narrow 32 for the laptop, tablets 24, phones 16. */
export function heroBreakpoints(platform: HeroPlatform): HeroDevice[] {
  const ios = platform === 'ios';
  return [
    { key: 'desktop', label: 'Desktop · 1440', cssDevice: null, mode: 'Desktop', width: 1440, height: 900, margin: 64 },
    { key: 'laptop', label: 'Laptop · 1024', cssDevice: null, mode: 'Desktop', width: 1024, height: 768, margin: 32 },
    { key: 'tablet', label: `Tablet · 768 · ${ios ? 'iOS' : 'Android'}`, cssDevice: ios ? 'IOS-Tablet' : 'Android-Tablet', mode: ios ? 'IOS-Tablet-Vertical' : 'Android-Tablet-Vertical', width: 768, height: 1024, margin: 24 },
    { key: 'mobile', label: `Mobile · 320 · ${ios ? 'iOS' : 'Android'}`, cssDevice: ios ? 'IOS-Mobile' : 'Android-Mobile', mode: ios ? 'IOS-Mobile' : 'Android-Mobile', width: 320, height: 568, margin: 16 },
  ];
}

export function DeviceFrame({ device, html, screen, showLabel = true }: { device: HeroDevice; html: string; screen: boolean; showLabel?: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ k: 0.25, h: 0 });
  useLayoutEffect(() => {
    const o = outer.current; const i = inner.current;
    if (!o || !i) return;
    const measure = () => setFit((f) => {
      const k = o.clientWidth / device.width;
      const h = i.offsetHeight;
      return f.k === k && f.h === h ? f : { k, h };
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o); ro.observe(i);
    return () => ro.disconnect();
  }, [device.width]);
  return (
    <VStack spacing={0.5}>
      {showLabel && <Caption color="quiet">{device.label} ({Math.round(fit.k * 100)}%)</Caption>}
      {/* Layout primitive: the scaled screen. */}
      <div ref={outer} className="hero-device" style={{ height: fit.h * fit.k }}>
        <div
          ref={inner}
          className={'hero-device__screen' + (screen ? ' hero-device__screen--full' : '')}
          data-device={device.cssDevice || undefined}
          data-hero-device={device.key}
          style={{
            width: device.width,
            transform: `scale(${fit.k})`,
            /* The size class's margin. Set as --Margin too: a system's CSS
               knows the device but not the size class, so the frame states it,
               as a Figma frame in that Device-Sizes mode would. */
            '--Margin': `${device.margin}px`,
            '--omni-hero-margin': `${device.margin}px`,
            '--hero-screen-h': `${device.height}px`,
          } as CSSProperties}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </VStack>
  );
}

export const DEVICE_PREVIEW_CSS = `
.hero-device {
  /* Rounded at the top only: a hero opens the screen, and the page carries
     on below it, so its bottom edge is a straight cut. */
  position: relative; overflow: hidden; border-radius: 10px 10px 0 0;
  box-shadow: 0 0 0 1px var(--Border-Variant);
}
.hero-device__screen { transform-origin: 0 0; }
/* A full-screen hero fills the device's screen, not the studio's window. */
.hero-device__screen--full .omni-hero { min-height: var(--hero-screen-h) !important; }
`;
