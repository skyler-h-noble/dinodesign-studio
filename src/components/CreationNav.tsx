import { useEffect, useRef } from 'react';
import { Button, H3 } from '@omni-design/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';

interface TopBarProps {
  designSystemName: string;
  onBack: () => void;
  themed?: boolean;
}

/**
 * Publish a bar's real height as a CSS variable.
 *
 * The constants below are a FALLBACK, not the answer. A bar's height is its
 * padding plus a Button, and --Button-Height is brand-generated, so there is no
 * number that is right for every design: the bottom reserve of 120 is larger
 * than the bar on this brand, which left the sidebars stopping short of it with
 * a strip of page between. Reserving MORE than the bar is just as wrong as
 * reserving less; it only fails more quietly, as a gap instead of an overlap.
 *
 * A ResizeObserver is what makes it correct for a brand nobody has made yet.
 * Written to :root rather than passed as props because the consumers are
 * several components deep and none of them are children of the bars.
 */
function usePublishedHeight(ref: React.RefObject<HTMLDivElement | null>, cssVar: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const write = () => {
      document.documentElement.style.setProperty(cssVar, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    /* Cleared on unmount so a page without the creation chrome does not inherit
       a reserve for bars that are not there. */
    return () => { ro.disconnect(); document.documentElement.style.removeProperty(cssVar); };
  }, [ref, cssVar]);
}

/** What a stage should subtract to fill the space between the two bars. */
export const CREATION_CHROME =
  'calc(var(--creation-top-h, 49px) + var(--creation-bottom-h, 120px))';

export function CreationTopBar({ designSystemName, onBack, themed }: TopBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  usePublishedHeight(ref, '--creation-top-h');
  const handleCancel = () => {
    const ok = window.confirm('Cancel and leave this design? Unsaved changes will be lost.');
    if (ok) window.location.href = '/';
  };
  return (
    <div
      ref={ref}
      data-theme={themed ? 'Brand-App-Bar' : 'App-Bar'}
      data-surface="Surface"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'var(--Background, #fff)',
        borderBottom: '1px solid var(--Border, #e0e0e0)',
        minHeight: 48,
      }}
    >
      <Button
        variant="ghost"
        size="small"
        onClick={onBack}
        startIcon={<ArrowBackIcon style={{ fontSize: 16 }} />}
        sx={{ color: 'var(--Text)', textDecoration: 'none' }}
      >
        Back
      </Button>
      <H3 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{designSystemName}</H3>
      <Button
        variant="ghost"
        size="small"
        onClick={handleCancel}
        startIcon={<CloseIcon style={{ fontSize: 18 }} />}
        sx={{ color: 'var(--Text)', textDecoration: 'none' }}
      >
        Cancel
      </Button>
    </div>
  );
}

interface BottomBarProps {
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
  themed?: boolean;
}

/**
 * Fallbacks only — used until the ResizeObserver above has written the real
 * heights, and by anything rendering without the bars mounted.
 *
 * They are not the answer and must not be treated as one. 120 was a reserve
 * LARGER than the bar on this brand, which is why the sidebars stopped short
 * of it with a strip of page between: reserving too much fails as a gap,
 * reserving too little as an overlap, and only one of those looks like a bug.
 */
export const CREATION_TOP_BAR_HEIGHT = 49;      // 48 minHeight + 1px border
export const CREATION_BOTTOM_BAR_RESERVE = 120;

export function CreationBottomBar({ onNext, nextLabel = 'Continue', disabled, themed }: BottomBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  usePublishedHeight(ref, '--creation-bottom-h');
  return (
    <div
      ref={ref}
      data-theme={themed ? 'Brand-Nav-Bar' : 'Nav-Bar'}
      data-surface="Surface"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '12px 24px',
        background: 'var(--Background, #fff)',
        borderTop: '1px solid var(--Border, #e0e0e0)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Button
        variant="default"
        size="medium"
        onClick={onNext}
        disabled={disabled}
        style={{ minWidth: 200, padding: '12px 32px', fontWeight: 700 }}
      >
        {nextLabel}
      </Button>
    </div>
  );
}
