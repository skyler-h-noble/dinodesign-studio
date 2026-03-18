import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { DynoDesignProvider, H1, H2, H3, Body, BodySmall, VStack, HStack, Card, Button, TextField, Alert, Badge, Divider } from '@dynodesign/components';
import { SUPABASE_STORAGE_BASE } from '../utils/generateDesignSystem';

export default function Playground() {
  const [searchParams] = useSearchParams();
  const uuid = searchParams.get('user');
  const [exists, setExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uuid) {
      setExists(false);
      setLoading(false);
      return;
    }

    // Check if the design system exists by fetching the base CSS
    fetch(`${SUPABASE_STORAGE_BASE}/${uuid}/tokens-base.css`, { method: 'HEAD' })
      .then(res => {
        setExists(res.ok);
        setLoading(false);
      })
      .catch(() => {
        setExists(false);
        setLoading(false);
      });
  }, [uuid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Body>Loading design system...</Body>
      </div>
    );
  }

  if (!uuid || !exists) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <H2>Design System Not Found</H2>
        <Body style={{ color: '#888' }}>
          {!uuid ? 'No design system ID provided. Use ?user=your-id' : `No design system found for ID: ${uuid}`}
        </Body>
      </div>
    );
  }

  const cssUrls = [
    `${SUPABASE_STORAGE_BASE}/${uuid}/tokens-base.css`,
    `${SUPABASE_STORAGE_BASE}/${uuid}/tokens-semantic.css`,
    `${SUPABASE_STORAGE_BASE}/${uuid}/tokens-component.css`,
    `${SUPABASE_STORAGE_BASE}/${uuid}/tokens-light.css`,
    `${SUPABASE_STORAGE_BASE}/${uuid}/tokens-dark.css`,
  ];

  return (
    <DynoDesignProvider
      cssUrls={cssUrls}
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
      <main data-surface="Surface" style={{ minHeight: '100vh', padding: 40 }}>
        <VStack spacing={6} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1}>
            <H1>Component Playground</H1>
            <BodySmall style={{ color: 'var(--Quiet)' }}>Design System ID: {uuid}</BodySmall>
          </VStack>

          <Divider />

          {/* Typography */}
          <VStack spacing={2}>
            <H2>Typography</H2>
            <H1>Heading 1</H1>
            <H2>Heading 2</H2>
            <H3>Heading 3</H3>
            <Body>Body text — Lorem ipsum dolor sit amet, consectetur adipiscing elit.</Body>
            <BodySmall>Small body text — Sed do eiusmod tempor incididunt ut labore.</BodySmall>
          </VStack>

          <Divider />

          {/* Buttons */}
          <VStack spacing={2}>
            <H2>Buttons</H2>
            <HStack spacing={2} style={{ flexWrap: 'wrap' }}>
              <Button variant="solid" color="default">Primary</Button>
              <Button variant="outline" color="default">Outline</Button>
              <Button variant="solid" color="default" size="small">Small</Button>
              <Button variant="solid" color="default" size="large">Large</Button>
              <Button variant="solid" color="default" disabled>Disabled</Button>
            </HStack>
          </VStack>

          <Divider />

          {/* Cards */}
          <VStack spacing={2}>
            <H2>Cards</H2>
            <HStack spacing={3} style={{ flexWrap: 'wrap' }}>
              <Card padding="medium" style={{ flex: 1, minWidth: 250, borderRadius: 'var(--Card-Radius, 14px)' }}>
                <VStack spacing={2}>
                  <H3>Card Title</H3>
                  <Body>Card content with your design tokens applied.</Body>
                  <Button variant="solid" color="default" size="small">Action</Button>
                </VStack>
              </Card>
              <Card padding="medium" style={{ flex: 1, minWidth: 250, borderRadius: 'var(--Card-Radius, 14px)' }}>
                <VStack spacing={2}>
                  <H3>Another Card</H3>
                  <Body>All colors, spacing, and radii come from your tokens.</Body>
                  <Button variant="outline" color="default" size="small">Learn More</Button>
                </VStack>
              </Card>
            </HStack>
          </VStack>

          <Divider />

          {/* Inputs */}
          <VStack spacing={2}>
            <H2>Inputs</H2>
            <HStack spacing={3} style={{ flexWrap: 'wrap' }}>
              <TextField label="Email" style={{ flex: 1, minWidth: 200 }} />
              <TextField label="Password" style={{ flex: 1, minWidth: 200 }} />
            </HStack>
          </VStack>

          <Divider />

          {/* Badges */}
          <VStack spacing={2}>
            <H2>Badges & Alerts</H2>
            <HStack spacing={2}>
              <Badge>Default</Badge>
            </HStack>
            <Alert variant="light" color="success">Success alert with your design tokens.</Alert>
            <Alert variant="light" color="warning">Warning alert example.</Alert>
          </VStack>

          <Divider />

          <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
            Generated by Dino Design
          </BodySmall>
        </VStack>
      </main>
    </DynoDesignProvider>
  );
}
