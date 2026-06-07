// Feature-flagged v2 of the Typography stage. Wraps the new CLIP + pixel-
// based matcher (originally built as /test/typography) in the create-flow
// StageProps contract.
//
// IMPORTANT: UploadStage stores the moodboard as a `blob:` URL — a
// browser-local reference that cloud functions can't fetch. So before we
// hand off to the matcher we upload the actual File to Firebase Storage
// and use that public URL.

import { useEffect, useState } from 'react';
import type { StageProps, TypographyStyle, ColorScheme } from '../../types';
import TypographyTestPage, {
  type TypographyStyleOutput,
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
}: Props) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
    if (!moodBoardFile) return;
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
      <Card padding="large">
        <VStack spacing={1} alignItems="center">
          <H2>Preparing your moodboard…</H2>
          <Body color="quiet">
            Uploading the moodboard for typography analysis. Just a moment.
          </Body>
        </VStack>
      </Card>
    );
  }

  return (
    <TypographyTestPage
      preloadedMoodboardUrl={publicUrl}
      hideUploadUI
      decorativeMode={decorativeMode}
      onDecorativeModeChange={onDecorativeModeChange}
      onTypographyComplete={(styles: TypographyStyleOutput[]) => {
        // TypographyStyleOutput is structurally identical to TypographyStyle.
        onTypographyComplete(styles as TypographyStyle[]);
      }}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
