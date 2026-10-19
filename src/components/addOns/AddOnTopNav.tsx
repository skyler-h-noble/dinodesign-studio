/**
 * The top bar of an add-on page (Charts, Hero Generator, Bento Grid):
 *
 *   ← Your Omni Design System          Title          ⚙
 *
 * The link goes back to the user's hosted design system; the cog opens a
 * small dialog to change which system the page is drawn in — the ID field
 * that used to sit on every page, out of the way until it is needed.
 *
 * It is the lib AppBar, whose own data-theme="App-Bar" picks up the bar color
 * the user chose for their system — the page is wrapped in that system's CSS,
 * so nothing here names a color. Passing children replaces the bar's default
 * contents (hamburger, search, login). Sticky, so it stays in view; the pages'
 * sticky content sits below it (ADD_ON_NAV_HEIGHT).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppBar, Body, BodySmall, Button, H3, HStack, Link, Modal, TextField, VStack } from '@omni-design/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { componentDocsIndexUrl } from '../../utils/docs/docsLink';

/** Room the sticky bar takes, for sticky content below it (the bar is 64). */
export const ADD_ON_NAV_HEIGHT = 64;

const ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AddOnTopNav({ title, uuid, exists, basePath }: {
  title: string;
  /** The design system the page is drawn in, if any. */
  uuid?: string;
  /** Whether that system was found — the back link only shows for a real one. */
  exists?: boolean | null;
  /** The add-on's route, e.g. "/add-ons/hero" — an ID change goes to basePath/<id>. */
  basePath: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [idInput, setIdInput] = useState(uuid || '');
  useEffect(() => { setIdInput(uuid || ''); }, [uuid, open]);
  const id = idInput.trim().toLowerCase();
  const valid = ID_SHAPE.test(id);
  const load = () => {
    if (!valid) return;
    setOpen(false);
    // The hash carries a spec being edited; keep it so a system switch keeps the work.
    if (id !== uuid) navigate(`${basePath}/${id}${window.location.hash}`);
  };

  return (
    // Layout primitive: keeps the bar pinned while the page scrolls.
    <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <AppBar>
        {/* Layout primitive: link, title and settings, with the title truly centered. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: 16, width: '100%' }}>
          <div style={{ minWidth: 0 }}>
            {uuid && exists && (
              <Link href={componentDocsIndexUrl(uuid)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <ArrowBackIcon fontSize="small" aria-hidden="true" />
                Your Omni Design System
              </Link>
            )}
          </div>
          {/* The page's one h1, at H3's size so it sits in the 64px bar. */}
          <H3 component="h1" width="hug">{title}</H3>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button iconOnly variant="ghost" size="small" aria-label="Design system settings" onClick={() => setOpen(true)}>
              <SettingsOutlinedIcon />
            </Button>
          </div>
        </div>
      </AppBar>
      <Modal open={open} onClose={() => setOpen(false)} title="Your Omni Design" size="small">
        <VStack spacing={2}>
          <Body>{title} is drawn in this design system — its colors, type, surfaces and layout grid.</Body>
          <TextField label="Design system ID" size="small" fullWidth value={idInput} autoFocus
            helperText={idInput.trim() && !valid ? 'An ID looks like 8-4-4-4-12 hex characters — the Omni Design ID in the plugin’s Settings.' : undefined}
            onChange={(e: { target: { value: string } }) => setIdInput(e.target.value)}
            onKeyDown={(e: { key: string }) => { if (e.key === 'Enter') load(); }} />
          {uuid && exists === false && <BodySmall color="quiet">No design system has the current ID, so the page is drawn without a brand.</BodySmall>}
          <HStack spacing={1} style={{ justifyContent: 'flex-end' }}>
            <Button variant="default-outline" size="small" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="default" size="small" onClick={load} disabled={!valid}>Load</Button>
          </HStack>
        </VStack>
      </Modal>
    </div>
  );
}
