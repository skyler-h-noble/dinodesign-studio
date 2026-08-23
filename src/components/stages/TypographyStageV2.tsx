// Feature-flagged v2 of the Typography stage. Wraps the new CLIP + pixel-
// based matcher (originally built as /test/typography) in the create-flow
// StageProps contract.
//
// IMPORTANT: UploadStage stores the moodboard as a `blob:` URL — a
// browser-local reference that cloud functions can't fetch. So before we
// hand off to the matcher we upload the actual File to Firebase Storage
// and use that public URL.

import { useCallback, useEffect, useState } from 'react';
import type { StageProps, TypographyStyle, ColorScheme } from '../../types';
import TypographyTestPage, {
  type TypographyStyleOutput,
  type TypographyMeta,
  type TypographyUploads,
} from '../TypographyTestPage';
import { warmAnalyzeMoodboard } from '../../utils/analyzeMoodboardClient';
import { uploadDesignSystemFile, getPublicFileUrl } from '../../utils/firebase/storage';
import { Alert, Card, VStack, H2, Body } from '@dynodesign/components';

interface Props extends StageProps {
  colorScheme: ColorScheme | null;
  moodBoardUrl?: string | null;
  moodBoardFile?: File | null;
  designSystemName?: string;
  onTypographyComplete: (styles: TypographyStyle[]) => void;
  /** Previously-saved typography from the app-wide state. When non-empty,
   *  the matcher rehydrates the user's prior selections (family / weight /
   *  spacing / case per role) on stage re-entry so customizations survive
   *  a round-trip through later stages. */
  initialTypography?: TypographyStyle[];
  /** UI state (trio index, body family mode, customize-modal categories)
   *  to restore on stage re-entry. */
  initialTypographyMeta?: TypographyMeta;
  onTypographyMetaChange?: (meta: TypographyMeta) => void;
  /** Custom font uploads per role — re-registered as FontFaces from
   *  Firebase Storage on stage re-entry. */
  initialTypographyUploads?: TypographyUploads;
  onTypographyUploadsChange?: (uploads: TypographyUploads) => void;
  decorativeMode: 'surface-components' | 'only-selected';
  onDecorativeModeChange: (mode: 'surface-components' | 'only-selected') => void;
}

const TYPO_V2_FOLDER = 'typography-v2-moodboards';

export default function TypographyStageV2({
  onNext,
  onBack,
  moodBoardUrl,
  moodBoardFile,
  decorativeMode,
  onDecorativeModeChange,
  onTypographyComplete,
  initialTypography,
  initialTypographyMeta,
  onTypographyMetaChange,
  initialTypographyUploads,
  onTypographyUploadsChange,
}: Props) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Stable forwarder so TypographyTestPage's "sync styles to parent" effect
  // sees the same callback identity across renders. An inline arrow here
  // would change refs every render, fire the effect again, and loop.
  const handleTypographyComplete = useCallback(
    (styles: TypographyStyleOutput[]) => {
      onTypographyComplete(styles as TypographyStyle[]);
    },
    [onTypographyComplete],
  );

  useEffect(() => {
    // Belt-and-suspenders re-warm on stage mount.
    warmAnalyzeMoodboard();
  }, []);

  useEffect(() => {
    // Path 1: we got a non-blob URL from upstream (already on Storage, or a
    // re-export of an existing design where the moodboard URL is stable).
    // Use it as-is, no upload needed.
    if (moodBoardUrl && !moodBoardUrl.startsWith('blob:')) {
      setPublicUrl(moodBoardUrl);
      return;
    }
    // Path 2: blob URL from UploadStage. Upload the File to Storage and
    // surface the public URL so the matcher can fetch it server-side.
    //
    // With neither a usable URL nor a File there is nothing to upload and
    // nothing to wait for. Returning quietly here left uploading=false,
    // publicUrl=null and uploadError=null — so the render fell through to
    // "Preparing your moodboard…" and stayed there permanently, with no error
    // and no timeout. It happens on re-entry, once the blob URL has been
    // revoked and the File is no longer in memory.
    if (!moodBoardFile) {
      setUploadError(
        moodBoardUrl
          ? 'The moodboard link expired when you navigated away.'
          : 'No moodboard was provided.',
      );
      return;
    }
    let cancelled = false;
    setUploading(true);
    setUploadError(null);
    const ext = moodBoardFile.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `${Date.now()}.${ext}`;
    uploadDesignSystemFile(TYPO_V2_FOLDER, filename, moodBoardFile, moodBoardFile.type)
      .then(() => {
        if (cancelled) return;
        const url = getPublicFileUrl(TYPO_V2_FOLDER, filename);
        setPublicUrl(url);
      })
      .catch((e) => {
        if (cancelled) return;
        setUploadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setUploading(false);
      });
    return () => { cancelled = true; };
  }, [moodBoardUrl, moodBoardFile]);

  if (uploadError) {
    return (
      <Alert severity="error">
        <strong>Couldn't upload your moodboard for analysis.</strong> {uploadError}
        <br />
        Go back and re-upload the moodboard, then try again.
      </Alert>
    );
  }

  if (uploading || !publicUrl) {
    return (
      <div style={{ margin: '32px auto', maxWidth: 520, width: '100%' }}>
        <Card padding="large">
          <VStack spacing={1} alignItems="center">
            <H2>Analyzing your moodboard…</H2>
            <Body color="quiet">
              Reading the colours and lettering to match your typography.
            </Body>
          </VStack>
        </Card>
      </div>
    );
  }

  return (
    <TypographyTestPage
      preloadedMoodboardUrl={publicUrl}
      hideUploadUI
      decorativeMode={decorativeMode}
      onDecorativeModeChange={onDecorativeModeChange}
      onTypographyComplete={handleTypographyComplete}
      initialTypography={initialTypography as TypographyStyleOutput[] | undefined}
      initialMeta={initialTypographyMeta}
      onMetaChange={onTypographyMetaChange}
      initialUploads={initialTypographyUploads}
      onUploadsChange={onTypographyUploadsChange}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
