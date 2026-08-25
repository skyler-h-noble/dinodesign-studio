// Preview harness for #1 output: renders generated OmniDesign screens inside a
// brand's hosted tokens. Visit /preview?user=<dinoId>&screen=pricing|settings.
// Same OmniDesignProvider wiring as Playground.tsx.
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { OmniDesignProvider, H2, Body, Button, HStack, VStack } from '@omni-design/components';
import { getPublicFileUrl } from '../utils/firebase/storage';
import PricingSection from './generated/PricingSection';
import SettingsPage from './generated/SettingsPage';
import Dashboard from './generated/Dashboard';

const SCREENS = {
  pricing: PricingSection,
  settings: SettingsPage,
  dashboard: Dashboard,
} as const;

export default function GeneratedPreview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const uuid = searchParams.get('user');
  const screen = searchParams.get('screen') || 'pricing';
  const [exists, setExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uuid) { setExists(false); setLoading(false); return; }
    let mounted = true;
    fetch(getPublicFileUrl(uuid, 'foundation.css'), { method: 'HEAD' })
      .then((res) => { if (mounted) { setExists(res.ok); setLoading(false); } })
      .catch(() => { if (mounted) { setExists(false); setLoading(false); } });
    return () => { mounted = false; };
  }, [uuid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Body>Loading design system…</Body>
      </div>
    );
  }

  if (!uuid || !exists) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
        <H2>Design System Not Found</H2>
        <Body style={{ color: '#888' }}>
          {!uuid ? 'Add ?user=<your-dino-id> to the URL.' : `No design system found for ID: ${uuid}`}
        </Body>
      </div>
    );
  }

  const Screen = SCREENS[screen as keyof typeof SCREENS] || PricingSection;

  return (
    <OmniDesignProvider
      foundationCSS={getPublicFileUrl(uuid, 'foundation.css')}
      coreCSS={getPublicFileUrl(uuid, 'core.css')}
      lightModeCSS={getPublicFileUrl(uuid, 'Light-Mode.css')}
      darkModeCSS={getPublicFileUrl(uuid, 'Dark-Mode.css')}
      baseCSS={getPublicFileUrl(uuid, 'base.css')}
      stylesCSS={getPublicFileUrl(uuid, 'styles.css')}
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
      <main data-surface="Surface" style={{ minHeight: '100vh' }}>
        {/* Screen switcher — not part of the generated output */}
        <VStack data-surface="Container" style={{ padding: 12 }}>
          <HStack gap="var(--Sizing-1)" alignItems="center">
            {Object.keys(SCREENS).map((key) => (
              <Button
                key={key}
                size="small"
                variant={key === screen ? 'default' : 'default-outline'}
                onClick={() => setSearchParams({ user: uuid, screen: key })}
              >
                {key}
              </Button>
            ))}
          </HStack>
        </VStack>
        <Screen />
      </main>
    </OmniDesignProvider>
  );
}
