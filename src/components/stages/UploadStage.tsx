import { Button, H2, Body, BodySmall, VStack, HStack, Card } from '@dynodesign/components';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { useState, useRef, useCallback } from 'react';
import type { StageProps } from '../../types';

interface Props extends StageProps {
  onImageUploaded: (imageUrl: string, file: File) => void;
}

export default function UploadStage({ onNext, onBack, onImageUploaded }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
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

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
      <VStack spacing={1} alignItems="center">
        <H2>Upload Mood Board</H2>
        <Body style={{ color: 'var(--Quiet)' }}>
          Upload an image to extract colors and styles for your design system
        </Body>
      </VStack>

      <Card padding="large" style={{ maxWidth: 560, width: '100%' }}>
        <VStack spacing={3}>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            style={{
              border: `2px dashed ${isDragging ? 'var(--Buttons-Primary-Button)' : 'var(--Border)'}`,
              borderRadius: 'var(--Style-Border-Radius)',
              padding: preview ? '16px' : '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'var(--Hover)' : 'transparent',
              transition: 'all 0.2s ease',
            }}
          >
            {preview ? (
              <VStack spacing={2} alignItems="center">
                <img
                  src={preview}
                  alt="Mood board preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 320,
                    borderRadius: 'var(--Style-Border-Radius)',
                    objectFit: 'contain',
                  }}
                />
                <BodySmall style={{ color: 'var(--Quiet)' }}>{fileName}</BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  Click or drag to replace
                </BodySmall>
              </VStack>
            ) : (
              <VStack spacing={2} alignItems="center">
                <CloudUploadIcon
                  style={{
                    fontSize: 48,
                    color: isDragging ? 'var(--Buttons-Primary-Button)' : 'var(--Quiet)',
                  }}
                />
                <Body>Drag and drop an image here</Body>
                <BodySmall style={{ color: 'var(--Quiet)' }}>or click to browse</BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  PNG, JPG, or WebP
                </BodySmall>
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
        </VStack>
      </Card>

      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={onBack}>
          Back
        </Button>
        <Button color="primary" onClick={onNext} disabled={!preview}>
          Next
        </Button>
      </HStack>
    </VStack>
  );
}
