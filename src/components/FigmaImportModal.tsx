// Shared "Get your design into Figma" modal. Lives in its own file so the
// ExportStage (first-time creation flow) and DesignSystemDetail (post-create
// edit view) can present the same 7-step walkthrough.

import { useState } from 'react';
import { Modal, VStack, HStack, BodySmall, Button } from '@dynodesign/components';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { getFigmaTemplateUrl } from '../utils/firebase/storage';

export function FigmaImportModal({
  open, onClose, id, name,
}: { open: boolean; onClose: () => void; id: string; name: string }) {
  const safeName = (name || 'design-system')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    || 'design-system';

  const [copiedId, setCopiedId] = useState(false);
  const copyId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };
  return (
    <Modal open={open} onClose={onClose} title="Get your design into Figma" size="medium">
      <VStack spacing={3} style={{ paddingTop: 8 }}>
        <FigmaStep n={1} title="Download your Figma file">
          <VStack spacing={2}>
            <BodySmall>
              Download the OmniDesign Figma file. We'll rename it to match your design system so it's easy to find in Figma.
            </BodySmall>
            <div>
              <Button
                variant="primary"
                size="small"
                onClick={async () => {
                  try {
                    // Firebase Storage is cross-origin so the <a download>
                    // attribute is ignored on direct href downloads. Fetch
                    // as a blob and trigger an in-page download with the
                    // design-system name as the filename.
                    const res = await fetch(getFigmaTemplateUrl(), { cache: 'no-cache' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${safeName}.fig`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                  } catch (err) {
                    console.error('Figma template download failed:', err);
                    alert('Could not download the Figma file. Please try again.');
                  }
                }}
              >
                Download {safeName}.fig
              </Button>
            </div>
          </VStack>
        </FigmaStep>
        <FigmaStep
          n={2}
          title="Import into Figma"
          body="Open Figma and import your file by dragging and dropping the .fig file into the Figma home screen, or click Import and select the downloaded file."
        />
        <FigmaStep
          n={3}
          title="Open the file"
          body="Once imported, open the file. You'll land on the Almost There page, which walks you through connecting your branded design system."
        />
        <FigmaStep
          n={4}
          title="Install the OmniDesign Plugin"
          body="From the Almost There page, install the OmniDesign Plugin directly in Figma."
        />
        <FigmaStep n={5} title="Enter your OmniDesign ID">
          <BodySmall style={{ display: 'block', marginBottom: 8 }}>
            In the plugin, paste in your unique OmniDesign ID:
          </BodySmall>
          <HStack spacing={1} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.85em',
              padding: '6px 10px',
              borderRadius: 4,
              background: 'var(--Container)',
              border: '1px solid var(--Border)',
              wordBreak: 'break-all',
            }}>{id}</code>
            <Button
              variant={copiedId ? 'success' : 'primary-outline'}
              size="small"
              onClick={copyId}
              disabled={!id}
              startIcon={copiedId ? <CheckCircleOutlineIcon /> : <ContentCopyIcon />}
            >
              {copiedId ? 'Copied' : 'Copy'}
            </Button>
          </HStack>
        </FigmaStep>
        <FigmaStep
          n={6}
          title="Import your design system"
          body="Press ⌘L to open the URL input field, paste in your Figma file URL, then click Import Design System. Let it run — this is where the magic happens."
        />
        <FigmaStep
          n={7}
          title="Explore"
          body="Once complete, head to the Using Your OmniDesign System page for tips and tricks on getting the most out of your branded design system."
        />
      </VStack>
    </Modal>
  );
}

function FigmaStep({ n, title, body, children }: { n: number; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <HStack spacing={2} style={{ alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--Buttons-Primary-Button)',
        color: 'var(--Buttons-Primary-Text)',
        fontSize: '0.8rem',
        fontWeight: 700,
      }}>{n}</div>
      <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
        <BodySmall style={{ fontWeight: 600 }}>Step {n} — {title}</BodySmall>
        {body && <BodySmall style={{ color: 'var(--Quiet)' }}>{body}</BodySmall>}
        {children}
      </VStack>
    </HStack>
  );
}
