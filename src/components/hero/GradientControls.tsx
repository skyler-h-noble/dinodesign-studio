/**
 * Visual gradient controls for the Hero Generator: an angle dial and a stop
 * bar. Both are drag- and keyboard-operable and read as sliders to assistive
 * tech; every color is a token, so they wear whichever system is loaded.
 *
 * MISSING-LIB-COMPONENT tags in this file:
 *   - AngleDial
 *   - GradientStopBar
 *   - AlignmentGrid
 *   - MeshPad
 */
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// MISSING-LIB-COMPONENT: AngleDial
// Needed for: picking a linear gradient's angle by dragging a knob, as well as typing it
// Proposed API: <AngleDial value={deg} onChange={(deg) => …} size={44} label="Angle" step={1} />
// Lib-track: add to @omni-design/components/src/components/AngleDial/
export function AngleDial({ value, onChange, label = 'Angle', size = 44 }: {
  value: number; onChange: (deg: number) => void; label?: string; size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** CSS angles: 0° points up, clockwise. */
  const fromPointer = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    // Snap to 15° with Shift, as design tools do.
    const raw = (deg + 360) % 360;
    onChange(Math.round(e.shiftKey ? Math.round(raw / 15) * 15 : raw) % 360);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 15 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange((value + step) % 360); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange((value - step + 360) % 360); }
    if (e.key === 'Home') { e.preventDefault(); onChange(0); }
  };
  const rad = (value * Math.PI) / 180;
  const reach = size / 2 - 9;
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)} degrees`}
      onKeyDown={onKey}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); fromPointer(e); }}
      onPointerMove={(e) => { if (e.buttons) fromPointer(e); }}
      className="hero-dial"
      style={{ width: size, height: size }}
    >
      {/* The direction line, centre to dot. */}
      <span className="hero-dial__line" style={{ width: reach, transform: `rotate(${value - 90}deg)` }} aria-hidden="true" />
      <span className="hero-dial__dot" style={{ left: size / 2 + Math.sin(rad) * reach - 4, top: size / 2 - Math.cos(rad) * reach - 4 }} aria-hidden="true" />
    </div>
  );
}

export interface BarStop { pos: number; color: string; label: string }

// MISSING-LIB-COMPONENT: GradientStopBar
// Needed for: placing gradient stops by dragging handles along a preview of the gradient
// Proposed API: <GradientStopBar stops={[{ pos, color, label }]} selected={i} onSelect={i => …} onMove={(i, pos) => …} onAdd={pos => …} />
// Lib-track: add to @omni-design/components/src/components/GradientStopBar/
export function GradientStopBar({ stops, selected, onSelect, onMove, onAdd, canAdd }: {
  stops: BarStop[]; selected: number;
  onSelect: (i: number) => void; onMove: (i: number, pos: number) => void; onAdd: (pos: number) => void; canAdd: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const posAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1);
  };
  const sorted = [...stops].map((s, i) => ({ ...s, i })).sort((a, b) => a.pos - b.pos);
  const fill = `linear-gradient(to right, ${sorted.map((s) => `${s.color} ${Math.round(s.pos * 100)}%`).join(', ')})`;
  return (
    <div className="hero-stopbar">
      <div
        ref={track}
        className="hero-stopbar__track"
        style={{ background: fill }}
        // Clicking empty track adds a stop there.
        onPointerDown={(e) => { if (e.target === track.current && canAdd) onAdd(posAt(e.clientX)); }}
        title={canAdd ? 'Click to add a stop' : undefined}
      >
        {stops.map((s, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={`${s.label} position`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(s.pos * 100)}
            aria-valuetext={`${Math.round(s.pos * 100)} percent`}
            className={'hero-stopbar__handle' + (i === selected ? ' is-selected' : '')}
            style={{ left: `${s.pos * 100}%`, background: s.color }}
            onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId); onSelect(i); }}
            onPointerMove={(e) => { if (e.buttons) onMove(i, posAt(e.clientX)); }}
            onFocus={() => onSelect(i)}
            onKeyDown={(e) => {
              const step = (e.shiftKey ? 10 : 1) / 100;
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onMove(i, clamp(s.pos + step, 0, 1)); }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onMove(i, clamp(s.pos - step, 0, 1)); }
            }}
          />
        ))}
      </div>
      {/* The positions, under their handles. */}
      <div className="hero-stopbar__scale" aria-hidden="true">
        {stops.map((s, i) => (
          // Centered right under its handle; the bar's side padding leaves room for the end ones.
          <span key={i} className={'hero-stopbar__pos' + (i === selected ? ' is-selected' : '')} style={{ left: `${s.pos * 100}%` }}>
            {Math.round(s.pos * 100)}
          </span>
        ))}
      </div>
    </div>
  );
}

export type GridV = 'top' | 'center' | 'bottom';
export type GridH = 'left' | 'center' | 'right';
const GRID_V: GridV[] = ['top', 'center', 'bottom'];
const GRID_H: GridH[] = ['left', 'center', 'right'];
const V_NAME = { top: 'Top', center: 'Middle', bottom: 'Bottom' };
const H_NAME = { left: 'left', center: 'center', right: 'right' };

// MISSING-LIB-COMPONENT: AlignmentGrid
// Needed for: picking one of nine positions (top-left … bottom-right) in one control — the photo's crop and the text's position
// Proposed API: <AlignmentGrid label="Photo crop" v="center" h="left" onChange={(v, h) => …} cell={28} />
// Lib-track: add to @omni-design/components/src/components/AlignmentGrid/
export function AlignmentGrid({ label, v, h, onChange, cell = 28 }: {
  label: string; v: GridV; h: GridH; onChange: (v: GridV, h: GridH) => void;
  /** Each cell's side in px — never under 24, WCAG 2.5.8's minimum target. */
  cell?: number;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = GRID_V.indexOf(v) * 3 + GRID_H.indexOf(h);
  const go = (i: number) => {
    onChange(GRID_V[Math.floor(i / 3)], GRID_H[i % 3]);
    refs.current[i]?.focus();
  };
  // One tab stop for the group; arrows move inside it, as in any radio group.
  const onKey = (e: KeyboardEvent) => {
    const r = Math.floor(at / 3), c = at % 3;
    const next = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1] }[e.key as 'ArrowUp'];
    if (!next) return;
    e.preventDefault();
    go(clamp(next[0], 0, 2) * 3 + clamp(next[1], 0, 2));
  };
  return (
    <div role="radiogroup" aria-label={label} className="hero-align" style={{ gridTemplateColumns: `repeat(3, ${Math.max(24, cell)}px)`, gridTemplateRows: `repeat(3, ${Math.max(24, cell)}px)` }} onKeyDown={onKey}>
      {GRID_V.flatMap((rv) => GRID_H.map((ch) => {
        const i = GRID_V.indexOf(rv) * 3 + GRID_H.indexOf(ch);
        const on = i === at;
        const name = rv === 'center' && ch === 'center' ? 'Center' : `${V_NAME[rv]} ${H_NAME[ch]}`;
        return (
          // Intentional raw <button>: one cell of a 3×3 radio grid, which no lib component lays out.
          <button
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={name}
            title={name}
            tabIndex={on ? 0 : -1}
            className={'hero-align__cell' + (on ? ' is-selected' : '')}
            onClick={() => go(i)}
          >
            <span className="hero-align__mark" aria-hidden="true" />
          </button>
        );
      }))}
    </div>
  );
}

export interface PadBlob { x: number; y: number; spread: number; color: string; label: string }

// MISSING-LIB-COMPONENT: MeshPad
// Needed for: placing a mesh gradient's blobs by dragging them on a preview of the mesh
// Proposed API: <MeshPad background={css} blobs={[{ x, y, spread, color, label }]} selected={i} onSelect={i => …} onMove={(i, x, y) => …} />
// Lib-track: add to @omni-design/components/src/components/MeshPad/
export function MeshPad({ background, blobs, selected, onSelect, onMove }: {
  background: string; blobs: PadBlob[]; selected: number;
  onSelect: (i: number) => void; onMove: (i: number, x: number, y: number) => void;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const at = (e: PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
  };
  const round = (v: number) => Math.round(v * 100) / 100;
  return (
    <div ref={pad} className="hero-meshpad" style={{ background }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          role="slider"
          tabIndex={0}
          aria-label={`${b.label} position`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(b.x * 100)}
          aria-valuetext={`${Math.round(b.x * 100)}% across, ${Math.round(b.y * 100)}% down`}
          className={'hero-meshpad__blob' + (i === selected ? ' is-selected' : '')}
          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, background: b.color }}
          onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); onSelect(i); }}
          onPointerMove={(e) => { if (e.buttons) { const [x, y] = at(e); onMove(i, round(x), round(y)); } }}
          onFocus={() => onSelect(i)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 0.1 : 0.01;
            const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key as 'ArrowLeft'];
            if (!d) return;
            e.preventDefault();
            onMove(i, round(clamp(b.x + d[0], 0, 1)), round(clamp(b.y + d[1], 0, 1)));
          }}
        >
          {/* The blob's reach, so its size reads on the pad. */}
          <span className="hero-meshpad__reach" style={{ width: `${b.spread * 200}cqw`, height: `${b.spread * 200}cqh` }} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

/** Styles for the controls — tokens only. */
export const GRADIENT_CONTROLS_CSS = `
.hero-dial {
  position: relative; flex: none; border-radius: 50%; cursor: grab; touch-action: none;
  border: 2px solid var(--Border); background: var(--Background);
  box-shadow: inset 0 1px 3px rgb(0 0 0 / 0.08);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.hero-dial:hover { border-color: var(--Text); }
.hero-dial:active { cursor: grabbing; }
.hero-dial:focus-visible { outline: 3px solid var(--Focus-Visible); outline-offset: 2px; }
.hero-dial__line {
  position: absolute; left: 50%; top: 50%; height: 2px; border-radius: 1px;
  background: var(--Quiet, var(--Text)); transform-origin: 0 50%; opacity: 0.5;
}
.hero-dial__dot {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  background: var(--Text); box-shadow: 0 0 0 2px var(--Background);
}

.hero-stopbar { padding: 6px 16px 0; }
.hero-stopbar__track {
  position: relative; height: 24px; border-radius: 12px; cursor: copy; touch-action: none;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
}
.hero-stopbar__handle {
  position: absolute; top: -6px; width: 14px; height: 36px; margin-left: -7px;
  border-radius: 7px; cursor: grab; touch-action: none;
  border: 2px solid var(--Text); box-shadow: 0 0 0 2px var(--Background), 0 2px 6px rgb(0 0 0 / 0.25);
  transition: box-shadow 120ms ease, transform 120ms ease;
}
.hero-stopbar__handle:hover { transform: scaleY(1.06); }
.hero-stopbar__handle:active { cursor: grabbing; }
.hero-stopbar__handle.is-selected { box-shadow: 0 0 0 2px var(--Background), 0 0 0 6px var(--Border-Variant), 0 2px 6px rgb(0 0 0 / 0.25); }
.hero-stopbar__handle:focus-visible { outline: 3px solid var(--Focus-Visible); outline-offset: 4px; }
.hero-stopbar__scale { position: relative; height: 26px; margin-top: 20px; }
.hero-stopbar__pos {
  position: absolute; transform: translateX(-50%); min-width: 30px; padding: 2px 4px; border-radius: 6px;
  text-align: center; font-variant-numeric: tabular-nums; color: var(--Text);
  /* The system's own small text, not the page default. */
  font-family: var(--Body-Small-Font-Family, var(--Font-Family-Body, inherit));
  font-size: var(--Body-Small-Font-Size, 12px);
  line-height: var(--Body-Small-Line-Height, 1.4);
  border: 1px solid var(--Border-Variant); background: var(--Background);
}
.hero-stopbar__pos.is-selected { border-color: var(--Text); }
.hero-align {
  display: grid;
  padding: 4px; gap: 2px; border-radius: 10px; flex: none;
  border: 1px solid var(--Border); background: var(--Background);
}
.hero-align__cell {
  all: unset; display: grid; place-items: center; border-radius: 6px; cursor: pointer;
  transition: background 120ms ease;
}
.hero-align__cell:hover { background: var(--Hover); }
.hero-align__cell:focus-visible { outline: 3px solid var(--Focus-Visible); outline-offset: 1px; }
.hero-align__mark {
  width: 6px; height: 6px; border-radius: 50%; background: var(--Quiet, var(--Text)); opacity: 0.55;
  transition: width 140ms ease, height 140ms ease, border-radius 140ms ease, opacity 140ms ease;
}
.hero-align__cell:hover .hero-align__mark { opacity: 0.9; }
.hero-align__cell.is-selected .hero-align__mark {
  width: 70%; height: 60%; border-radius: 4px; opacity: 1; background: var(--Buttons-Default-Button, var(--Text));
}
.hero-meshpad {
  position: relative; aspect-ratio: 16 / 9; border-radius: 12px; overflow: hidden; touch-action: none;
  container-type: size; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
}
.hero-meshpad__blob {
  position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
  cursor: grab; touch-action: none; z-index: 1;
  border: 2px solid var(--Text); box-shadow: 0 0 0 2px var(--Background), 0 2px 6px rgb(0 0 0 / 0.25);
}
.hero-meshpad__blob:active { cursor: grabbing; }
.hero-meshpad__blob.is-selected { box-shadow: 0 0 0 2px var(--Background), 0 0 0 6px var(--Border-Variant), 0 2px 6px rgb(0 0 0 / 0.25); }
.hero-meshpad__blob:focus-visible { outline: 3px solid var(--Focus-Visible); outline-offset: 4px; }
.hero-meshpad__reach {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 50%;
  border: 1px dashed var(--Background); opacity: 0; pointer-events: none; transition: opacity 120ms ease;
}
.hero-meshpad__blob.is-selected .hero-meshpad__reach { opacity: 0.8; }
.hero-stop input { text-align: center; padding-left: 4px; padding-right: 4px; }
/* The percent box matches the menus beside it (medium Select, 32px). */
.hero-stop .MuiInputBase-root { height: 32px; }
.hero-stop .hero-swatch { width: 32px; height: 32px; }
.hero-swatch {
  flex: none; width: 36px; height: 36px; border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
}
.hero-swatch.is-selected { box-shadow: 0 0 0 2px var(--Background), 0 0 0 4px var(--Text); }
`;
