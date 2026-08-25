import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Body } from '@dynodesign/components';

// MISSING-LIB-COMPONENT: AvatarMenu
// Needed for: top-nav account dropdown (Account / My Designs / Sign Out)
// Used by AppHeader and LandingPage. Same portal pattern is repeated in
// MyDesignsPage's ellipsis menu. The lib's legacy Menu requires a Dropdown
// context and silently returns null when used standalone, so a portal-based
// dropdown is the right primitive.

interface AvatarDropdownProps {
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null };
  onSignOut: () => void;
}

export default function AvatarDropdown({ user, onSignOut }: AvatarDropdownProps) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const open = anchorRect !== null;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setAnchorRect(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnchorRect(null); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  const items: Array<{ label: string; onClick?: () => void; divider?: boolean }> = [
    { label: 'Account', onClick: () => { window.location.href = '/account'; } },
    { label: 'My Designs', onClick: () => { window.location.href = '/my-designs'; } },
    { divider: true, label: '' },
    { label: 'Sign Out', onClick: onSignOut },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAnchorRect(open ? null : e.currentTarget.getBoundingClientRect());
        }}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Avatar
          src={user.photoURL || undefined}
          alt={user.displayName || user.email || 'Account'}
          size="small"
        >
          {!user.photoURL ? initial : undefined}
        </Avatar>
      </button>
      {open && anchorRect && createPortal(
        <div
          ref={panelRef}
          role="menu"
          /* Portalled to document.body, so it inherits no data-theme and has to
             declare its own. Background comes from --Background, which
             data-surface resolves; the panel never names a surface token. */
          data-theme="Brand"
          data-surface="Container"
          style={{
            position: 'absolute',
            top: anchorRect.bottom + window.scrollY + 4,
            right: window.innerWidth - anchorRect.right - window.scrollX,
            minWidth: 180,
            background: 'var(--Background)',
            border: '1px solid var(--Border)',
            borderRadius: 'var(--Style-Border-Radius, 6px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
            padding: '4px 0',
            zIndex: 1300,
            color: 'var(--Text)',
            fontFamily: 'inherit',
          }}
        >
          {items.map((item, i) => item.divider ? (
            <div
              key={`divider-${i}`}
              style={{ height: 1, background: 'var(--Border, #d4d4d4)', margin: '4px 0' }}
            />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setAnchorRect(null); item.onClick?.(); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 14px',
                background: 'transparent',
                border: 'none',
                color: 'var(--Text)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--Hover, rgba(0,0,0,0.05))')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Body component="span" style={{ display: 'block' }}>{item.label}</Body>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
