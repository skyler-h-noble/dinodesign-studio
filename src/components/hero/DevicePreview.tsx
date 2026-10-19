/**
 * The hero at desktop, tablet and phone sizes at once — each rendered at the
 * device's real width with its data-device set, so the design system's own
 * type sizes and --Margin apply, then scaled down to fit. What is drawn is
 * the exported HTML, unchanged.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type React from 'react';
import { Button, Caption, Tab, TabList, Tabs, ToggleButtonGroup, VStack } from '@omni-design/components';
import type { DeviceMode } from '../../utils/deviceChrome';
import { DEVICE_COLUMNS, DEVICE_GUTTER } from '../../utils/layoutGrid';

export type HeroPlatform = 'ios' | 'android';

export interface HeroDevice {
  key: 'desktop' | 'laptop' | 'tablet-h' | 'tablet' | 'mobile';
  label: string;
  /** A tablet's way up. CSS has one data-device per tablet, so the frame
   *  states it (data-orientation) and the page's CSS reads it — a landscape
   *  tablet is a 12-column grid, as Figma's IOS-Tablet-Horizontal is. */
  orientation?: 'portrait' | 'landscape';
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

/**
 * The Bento Grid's five devices — one per layout grid a page meets: Desktop
 * and Laptop (12 columns), a tablet held either way (12 landscape, 8
 * portrait) and a phone (4). Sizes are Figma's Default size class, so the
 * preview matches the frame the plugin builds; the laptop is Desktop Narrow.
 */
export function bentoBreakpoints(platform: HeroPlatform): HeroDevice[] {
  const ios = platform === 'ios';
  const tablet = ios ? 'IOS-Tablet' : 'Android-Tablet';
  return [
    { key: 'desktop', label: 'Desktop', cssDevice: null, mode: 'Desktop', width: 1440, height: 900, margin: 64 },
    { key: 'laptop', label: 'Laptop', cssDevice: null, mode: 'Desktop', width: 1024, height: 768, margin: 32 },
    { key: 'tablet-h', label: 'Tablet Horizontal', cssDevice: tablet, mode: ios ? 'IOS-Tablet-Horizontal' : 'Android-Tablet-Horizontal', width: 1180, height: 820, margin: 24, orientation: 'landscape' },
    { key: 'tablet', label: 'Tablet Vertical', cssDevice: tablet, mode: ios ? 'IOS-Tablet-Vertical' : 'Android-Tablet-Vertical', width: 820, height: 1180, margin: 24, orientation: 'portrait' },
    { key: 'mobile', label: 'Mobile', cssDevice: ios ? 'IOS-Mobile' : 'Android-Mobile', mode: ios ? 'IOS-Mobile' : 'Android-Mobile', width: 320, height: 568, margin: 16 },
  ];
}

/** A device's size and how far the preview scales it: "1180 × 820 · 61%". */
export const deviceSizeLabel = (d: HeroDevice, stageW: number) =>
  `${d.width} × ${d.height} · ${Math.round(Math.min(1, stageW / d.width) * 100)}%`;

/**
 * The device as a segmented control rather than tabs, so a page with its own
 * Build / Code / Export tabs does not stack two tab bars. Names only — the
 * size and scale sit on the frame itself (BreakpointStage).
 */
export function DeviceSelector({ devices, active, onActive }: { devices: HeroDevice[]; active: string; onActive: (key: string) => void }) {
  return (
    <ToggleButtonGroup value={active} onChange={(v: string) => v && onActive(v)} size="small" aria-label="Device">
      {devices.map((d) => <Button key={d.key} value={d.key} size="small">{d.label}</Button>)}
    </ToggleButtonGroup>
  );
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
          /* Desktop names itself too, so a page's no-data-device fallbacks
             (screen-width media queries) never fire inside a preview. */
          data-device={device.cssDevice || 'Desktop'}
          data-orientation={device.orientation}
          data-hero-device={device.key}
          style={{
            width: device.width,
            transform: `scale(${fit.k})`,
            /* The size class's margin. Set as --Margin too: a system's CSS
               knows the device but not the size class, so the frame states it,
               as a Figma frame in that Device-Sizes mode would. */
            '--Margin': `${device.margin}px`,
            // The layout grid for this device, for systems published before
            // their CSS carried it (the newer ones set the same numbers).
            '--Columns': String(DEVICE_COLUMNS[device.mode]),
            '--Gutter': `${DEVICE_GUTTER[device.mode]}px`,
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

/** The width of the stage a breakpoint is drawn in — for each tab's scale. */
export function useStageWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 800));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** The four breakpoint tabs, with each one's size and scale, and the platform
 *  toggle when tablet or mobile is chosen. Controlled, so a page can lay its
 *  own controls out for the chosen device. */
export function BreakpointTabs({ devices, active, onActive, platform, onPlatform, stageW, showPlatform = true }: {
  devices: HeroDevice[]; active: string; onActive: (key: string) => void;
  platform: HeroPlatform; onPlatform: (p: HeroPlatform) => void; stageW: number;
  /** Off where the platform makes no difference worth a control (the grid is the same on both). */
  showPlatform?: boolean;
}) {
  return (
    // Layout primitive: the tabs, and the platform beside them when it applies.
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <Tabs value={active} onChange={(v: string) => onActive(v)}>
        <TabList aria-label="Breakpoint">
          {devices.map((d) => (
            <Tab key={d.key} value={d.key}>{`${d.key[0].toUpperCase()}${d.key.slice(1)} · ${d.width} × ${d.height} (${Math.round(Math.min(1, stageW / d.width) * 100)}%)`}</Tab>
          ))}
        </TabList>
      </Tabs>
      {showPlatform && (active === 'tablet' || active === 'mobile') && (
        <ToggleButtonGroup value={platform} onChange={(v: string) => onPlatform(v as HeroPlatform)} size="small" aria-label="Platform">
          <Button value="ios" size="small">iOS</Button>
          <Button value="android" size="small">Android</Button>
        </ToggleButtonGroup>
      )}
    </div>
  );
}

/** One breakpoint drawn in the stage; a phone at real size, centered. With
 *  `header`, the frame is captioned with its size and scale. */
export function BreakpointStage({ device, html, stageW, screen = false, header = false }: { device: HeroDevice; html: string; stageW: number; screen?: boolean; header?: boolean }) {
  return (
    <div style={{ maxWidth: device.width, margin: device.width < stageW ? '0 auto' : undefined }}>
      <VStack spacing={0.5}>
        {header && <Caption color="quiet">{`${device.label} · ${deviceSizeLabel(device, stageW)}`}</Caption>}
        <DeviceFrame key={device.key + device.cssDevice + device.orientation} device={device} html={html} screen={screen} showLabel={false} />
      </VStack>
    </div>
  );
}
