import { Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Radio } from '@dynodesign/components';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TuneIcon from '@mui/icons-material/Tune';
import BoltIcon from '@mui/icons-material/Bolt';
import { useState, useRef, useCallback } from 'react';
import type { StageProps } from '../../types';
import { warmAnalyzeMoodboard, getOrStartMoodboardAnalysis } from '../../utils/analyzeMoodboardClient';
import { uploadDesignSystemFile, getPublicFileUrl } from '../../utils/firebase/storage';

export type GenerationMode = 'guided' | 'auto';

const TYPO_ANALYSIS_FOLDER = 'typography-v2-moodboards';

interface Props extends StageProps {
  onImageUploaded: (imageUrl: string, file: File) => void;
  /** Fired once the moodboard finishes uploading to Storage AND the
   *  typography analysis has been kicked off. The URL is the public Storage
   *  URL that downstream stages should use when they need a server-fetchable
   *  reference (vs the blob: URL we hand to onImageUploaded for instant
   *  preview). Optional — callers that don't need the v2 typography path
   *  can omit it. */
  onMoodboardPublicUrlReady?: (publicUrl: string) => void;
  onGenerate: (mode: GenerationMode) => void;
}

export default function UploadStage({
  onBack,
  onImageUploaded,
  onMoodboardPublicUrlReady,
  onGenerate,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<GenerationMode>('guided');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevUrlRef = useRef<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    // Revoke previous object URL before creating a new one
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    prevUrlRef.current = url;
    setPreview(url);
    onImageUploaded(url, file);
    // Prime the CLIP cloud function so the model is in memory by the time
    // the user reaches the typography stage. Fire-and-forget; the real
    // analyze call will surface any error that matters.
    warmAnalyzeMoodboard();

    // Kick off the actual typography analysis in the background so the
    // result is waiting by the time the user finishes color extraction +
    // color-assignment and lands on the typography stage. Storage upload
    // happens here too because cloud functions can't fetch the local
    // `blob:` URL we created for instant preview.
    (async () => {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
        const filename = `${Date.now()}.${ext}`;
        await uploadDesignSystemFile(TYPO_ANALYSIS_FOLDER, filename, file, file.type);
        const publicUrl = getPublicFileUrl(TYPO_ANALYSIS_FOLDER, filename);
        // Cache the analysis promise keyed by URL — when TypographyStageV2
        // mounts, it calls the same function and gets THIS promise back.
        getOrStartMoodboardAnalysis(publicUrl).catch(() => {/* logged in stage */});
        // Tell App.tsx where the public URL is so it can pass it to the
        // typography stage instead of the un-fetchable blob URL.
        onMoodboardPublicUrlReady?.(publicUrl);
      } catch (err) {
        // Non-fatal — TypographyStageV2 has its own fallback upload path.
        console.warn('[upload] background storage upload failed:', err);
      }
    })();
  }, [onImageUploaded, onMoodboardPublicUrlReady]);

  // Note: we intentionally do NOT revoke the URL on unmount because the parent
  // (App) holds a reference to it for use in downstream stages (color extraction,
  // preview, export). The parent is responsible for the URL's lifetime.

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <VStack spacing={4} alignItems="center" style={{ padding: '60px 24px' }}>
      <VStack spacing={1} alignItems="center">
        <H2 style={{ textAlign: 'center' }}>Upload Mood Board</H2>
        <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
          Upload an image to extract colors and styles
        </Body>
        {!preview && (
          <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center', fontStyle: 'italic' }}>
            An image is required to continue.
          </BodySmall>
        )}
      </VStack>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          maxWidth: 560,
          width: '100%',
          minHeight: 200,
          border: `2px dashed ${isDragging ? 'var(--Primary)' : 'var(--Border)'}`,
          borderRadius: 'var(--Style-Border-Radius)',
          background: isDragging ? 'var(--Primary-Container)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          padding: 24,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        {preview ? (
          <VStack spacing={2} alignItems="center">
            <img
              src={preview}
              alt="Mood board preview"
              style={{
                maxWidth: '100%',
                maxHeight: 240,
                borderRadius: 'var(--Style-Border-Radius)',
                objectFit: 'contain',
              }}
            />
            <BodySmall style={{ color: 'var(--Text-Quiet)' }}>{fileName}</BodySmall>
            <BodySmall style={{ color: 'var(--Text-Quiet)' }}>Click or drag to replace</BodySmall>
          </VStack>
        ) : (
          <VStack spacing={1} alignItems="center">
            <CloudUploadIcon style={{ fontSize: 48, color: 'var(--Quiet)', opacity: 0.5 }} />
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>Drag and drop image or mood board</Body>
            <BodySmall style={{ color: 'var(--Text-Quiet)', textAlign: 'center' }}>or click to browse</BodySmall>
          </VStack>
        )}
      </div>

      {/* Generation Process */}
      {preview && (
        <VStack spacing={3} style={{ maxWidth: 560, width: '100%' }}>
          <H3>Generation Process</H3>

          {([
            { value: 'guided' as const, icon: <TuneIcon />, title: 'Guide Me', badge: 'More Control', desc: 'Step-by-step process where you can review and adjust recommendations at each stage' },
            { value: 'auto' as const, icon: <BoltIcon />, title: 'Auto Generate', badge: 'Faster', desc: 'AI makes all decisions and jumps directly to the final preview' },
          ]).map(opt => {
            const isSelected = mode === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => setMode(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 'var(--Style-Border-Radius)',
                  border: '1px solid var(--Border)',
                  background: isSelected ? 'var(--Primary)' : 'transparent',
                  color: isSelected ? 'var(--Text)' : 'var(--Quiet)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <Radio
                  variant="default-outline"
                  size="small"
                  checked={isSelected}
                  onChange={() => setMode(opt.value)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {opt.icon}
                </div>
                <VStack spacing={0} style={{ flex: 1 }}>
                  <Body style={{ fontWeight: 600, color: 'inherit' }}>{opt.title}</Body>
                  <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'inherit' }}>
                    {opt.badge}
                  </BodySmall>
                  <BodySmall style={{ color: 'inherit', opacity: 0.8 }}>
                    {opt.desc}
                  </BodySmall>
                </VStack>
              </div>
            );
          })}

        </VStack>
      )}
    </VStack>
  );
}
