import { Button, H2, H3, Body, BodySmall, VStack, HStack, Card } from '@dynodesign/components';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TuneIcon from '@mui/icons-material/Tune';
import BoltIcon from '@mui/icons-material/Bolt';
import { useState, useRef, useCallback } from 'react';
import type { StageProps } from '../../types';

export type GenerationMode = 'guided' | 'auto';

interface Props extends StageProps {
  onImageUploaded: (imageUrl: string, file: File) => void;
  onGenerate: (mode: GenerationMode) => void;
}

export default function UploadStage({ onBack, onImageUploaded, onGenerate }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<GenerationMode>('guided');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageUploaded(url, file);
  }, [onImageUploaded]);

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
        <H2>Upload Mood Board</H2>
        <Body style={{ color: 'var(--Quiet)' }}>
          Upload an image to extract colors and styles
        </Body>
      </VStack>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--Buttons-Primary-Button)' : 'var(--Border)'}`,
          borderRadius: 'var(--Style-Border-Radius)',
          padding: preview ? '16px' : '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? 'var(--Hover)' : 'transparent',
          transition: 'all 0.2s ease',
          maxWidth: 560,
          width: '100%',
        }}
      >
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
            <BodySmall style={{ color: 'var(--Quiet)' }}>{fileName}</BodySmall>
            <BodySmall style={{ color: 'var(--Quiet)' }}>Click or drag to replace</BodySmall>
          </VStack>
        ) : (
          <VStack spacing={2} alignItems="center">
            <CloudUploadIcon
              style={{
                fontSize: 48,
                color: isDragging ? 'var(--Buttons-Primary-Button)' : 'var(--Quiet)',
              }}
            />
            <Body>Drag and drop image or mood board</Body>
            <BodySmall style={{ color: 'var(--Quiet)' }}>or click to browse</BodySmall>
          </VStack>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

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
                  border: '1px solid var(--Buttons-Default-Border)',
                  background: isSelected ? 'var(--Buttons-Default-Button)' : 'transparent',
                  color: isSelected ? 'var(--Buttons-Default-Text)' : 'var(--Quiet)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                <input
                  type="radio"
                  checked={isSelected}
                  onChange={() => setMode(opt.value)}
                  style={{ width: 18, height: 18, accentColor: 'var(--Buttons-Primary-Button)', flexShrink: 0 }}
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

          <Button
            color="default"
            fullWidth
            onClick={() => onGenerate(mode)}
          >
            Generate
          </Button>
        </VStack>
      )}

      <HStack spacing={2}>
        <Button variant="outline" color="default" onClick={onBack}>Back</Button>
      </HStack>
    </VStack>
  );
}
