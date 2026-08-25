// FontChip — a selectable specimen. The "Ag" is set in the family being
// offered, so the choice is made by looking rather than by reading a name.
//
// MISSING-LIB-COMPONENT: Button variant="chip" (or a FontChip component)
// Needed for: every font/preset picker in the typography step — Display and
//   Body pools, the "Closest to your image" ranking, and the Header's mood
//   presets. The lib Button's size padding is tuned for a short text label, so
//   a three-part row (glyph · name · score) fills the box edge to edge.
// Proposed API: <Button variant="chip" preview={<span/>} meta="88%" selected>
//   Lora
// </Button>  — content left, meta right, truncating label, selected state via
//   the border + a tint of the button colour.
// Lib-track: add to @omni-design/components/src/components/Button/ as a variant,
//   or a dedicated Chip-style component if Button's API can't carry `meta`.

import type { ReactNode } from 'react';

export interface FontChipProps {
  /** Rendered large on the left, in the face being offered. */
  preview: ReactNode;
  /** The family name. Truncates rather than wrapping, so rows stay even. */
  label: string;
  /** Right-aligned trailing value — the match score, when there is one. */
  meta?: string;
  selected?: boolean;
  /** Marks the single best match so the ranking reads at a glance. */
  best?: boolean;
  title?: string;
  /** Unavailable, but still SHOWN. Used when Italic is on and this family ships
   *  no italic: removing it would hide the cost of the choice, so the chip stays
   *  visible and inert and the user can see what the toggle rules out. */
  disabled?: boolean;
  onClick: () => void;
}

export function FontChip({
  preview, label, meta, selected = false, best = false, title, disabled = false, onClick,
}: FontChipProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={selected}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        minHeight: 44,
        padding: '8px 14px',
        // Fixed 8px for the same reason as the highlight: a playful brand sets
        // --Style-Border-Radius to 100 and the chips become stadiums.
        borderRadius: 8,
        opacity: disabled ? 0.38 : 1,
        // Selected reads as a FILLED default button; the rest as outlines. The
        // selected chip previously differed only by a tinted --Hover background
        // and a coloured edge, which is the same weight as a hover state and did
        // not survive a glance down a list of ten.
        //
        // The fill uses the Default button tokens, so the chosen face is shown
        // in the brand's own primary action colour rather than a UI grey.
        border: `1px solid ${selected
          ? 'var(--Buttons-Default-Border, var(--Buttons-Default-Button))'
          : 'var(--Border)'}`,
        background: selected ? 'var(--Buttons-Default-Button)' : 'transparent',
        color: selected ? 'var(--Buttons-Default-Text)' : 'var(--Text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        font: 'inherit',
      }}
    >
      {/* The specimen. Fixed width so every label starts at the same x. */}
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, minWidth: 34 }}>
        {preview}
      </span>
      <span style={{
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 13,
      }}>
        {label}
      </span>
      {meta && (
        <span style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: best ? 700 : 400,
          color: best ? 'var(--Buttons-Primary-Button)' : 'var(--Quiet)',
        }}>
          {meta}
        </span>
      )}
    </button>
  );
}
