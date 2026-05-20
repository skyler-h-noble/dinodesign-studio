import { useRef, useState, useEffect } from 'react';
import {
  AppBar, Button, H1, H2, H3, Body, BodySmall, VStack, HStack, Card, Tabs, TabList, Tab,
} from '@dynodesign/components';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import PaletteIcon from '@mui/icons-material/Palette';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import DevicesIcon from '@mui/icons-material/Devices';
import BrushIcon from '@mui/icons-material/Brush';
import CodeIcon from '@mui/icons-material/Code';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import AvatarDropdown from './AvatarDropdown';
import MoodDemo from './MoodDemo';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function LandingPage() {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Open the auth modal automatically when arriving via `/?login=true`,
  // then clean the URL so a refresh doesn't re-open it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'true') {
      setShowAuthModal(true);
      params.delete('login');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const NAV_LINKS: Array<{ label: string; id: string; href?: string }> = [
    { label: 'How it Works', id: 'how-it-works' },
    { label: 'Gallery', id: 'gallery' },
    { label: 'Resources', id: 'resources' },
    { label: 'Add-Ons', id: 'addons', href: '/add-ons' },
    { label: 'Pricing', id: 'pricing' },
  ];

  const handleNavClick = (id: string) => {
    const link = NAV_LINKS.find(l => l.id === id);
    if (link?.href) {
      window.location.href = link.href;
    } else {
      scrollTo(id);
    }
  };

  const FEATURES = [
    { icon: <PaletteIcon />, title: '12-Tone LCH Palettes', description: 'Perceptually uniform color scales with bell-curve chroma distribution across light and dark modes.' },
    { icon: <AccessibilityNewIcon />, title: 'WCAG AA Baked In', description: 'Every text, border, and button contrast ratio is verified against every background automatically.' },
    { icon: <DevicesIcon />, title: '49 Components', description: 'Buttons, cards, inputs, modals, navigation — all styled with your brand tokens, ready to use.' },
    { icon: <BrushIcon />, title: 'Figma Library', description: 'Complete Figma design system with variables, modes, and components matching your coded tokens 1:1.' },
    { icon: <CodeIcon />, title: 'AI-Ready', description: 'CLAUDE.md integration file so AI coding assistants build with your design system correctly from day one.' },
    { icon: <SpeedIcon />, title: 'Live in Minutes', description: 'Upload one image. Get a complete, hosted, production-ready design system — not a mockup.' },
  ];

  const STEPS = [
    { step: '1', title: 'Upload a mood board', description: 'Drop any image — a brand board, a photo, a screenshot. The system extracts your color palette automatically.' },
    { step: '2', title: 'Customize your system', description: 'Adjust colors, pick typography, set component styles. See changes live in the phone preview.' },
    { step: '3', title: 'Get your design system', description: 'Receive hosted CSS tokens, Figma library, and an AI integration file — all production-ready.' },
  ];

  const TESTIMONIALS = [
    { quote: 'We went from a mood board to a fully accessible design system in under 20 minutes. This would have taken our team weeks.', author: 'Design Lead', company: 'Series B Startup' },
    { quote: 'The Figma-to-code parity is incredible. Our designers and developers are finally speaking the same language.', author: 'VP Engineering', company: 'SaaS Platform' },
    { quote: 'I\'m a solo founder with no design background. DinoDesign gave me a professional design system that looks like I hired an agency.', author: 'Founder', company: 'Indie App' },
  ];

  return (
    <div data-theme="Default" data-surface="Surface" style={{ background: 'var(--Background)', color: 'var(--Text)', overflowX: 'clip' }}>
      {/* ─── Top Nav (sticky) ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--Background)' }}>
      <AppBar
        brand="DinoDesign"
        onBrandClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        centerSlot={
          <Tabs onChange={(val: string) => handleNavClick(val)}>
            <TabList aria-label="Page sections">
              {NAV_LINKS.map(link => (
                <Tab key={link.id} value={link.id}>{link.label}</Tab>
              ))}
            </TabList>
          </Tabs>
        }
        endSlot={
          <HStack spacing={1} style={{ alignItems: 'center' }}>
            <Button variant="default" size="small" onClick={() => window.location.href = '/create'}>
              Get Started
            </Button>
            {user ? (
              <AvatarDropdown
                user={user}
                onSignOut={async () => { await signOut(); window.location.href = '/'; }}
              />
            ) : (
              <Button variant="outline" color="default" size="small" onClick={() => setShowAuthModal(true)}>
                Login
              </Button>
            )}
          </HStack>
        }
      />
      </div>

      {/* ─── Hero ─── */}
      <section data-theme="Neutral-Dark" data-surface="Surface" style={{ padding: '80px 24px 60px', background: 'var(--Background)', color: 'var(--Text)' }}>
        <VStack spacing={4} alignItems="center" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={2} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Text-Primary)', fontSize: '0.75rem', textAlign: 'center' }}>
              Branded, Scalable and Accessible Design Systems, Automated
            </BodySmall>
            <H1 style={{ textAlign: 'center', maxWidth: 700 }}>
              One image. One complete design system.
            </H1>
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center', maxWidth: 560 }}>
              Upload a mood board and get a fully accessible, coded design system with Figma library,
              49 React components, and hosted playground — live in minutes.
            </Body>
          </VStack>

          <HStack spacing={2}>
            <Button
              variant="default"
              size="large"
              onClick={() => window.location.href = '/create'}
              endIcon={<ArrowForwardIcon />}
              style={{ fontWeight: 700 }}
            >
              Build your design system
            </Button>
            <Button variant="outline" size="large" onClick={() => scrollTo('how-it-works')}>
              See how it works
            </Button>
          </HStack>

          <div style={{ width: '100%', maxWidth: 1000 }}>
            <MoodDemo />
          </div>
        </VStack>
      </section>

      {/* ─── How it Works ─── */}
      <section id="how-it-works" style={{ padding: '80px 24px', background: 'var(--Container, #f8f8f8)' }}>
        <VStack spacing={5} style={{ maxWidth: 900, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              How it Works
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Three steps. No design skills needed.</H2>
          </VStack>

          <HStack spacing={4} style={{ alignItems: 'flex-start' }}>
            {STEPS.map(s => (
              <VStack key={s.step} spacing={2} style={{ flex: 1, textAlign: 'center' }} alignItems="center">
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'var(--Buttons-Primary-Button)',
                  color: 'var(--Buttons-Primary-Text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', fontWeight: 800,
                }}>
                  {s.step}
                </div>
                <H3 style={{ textAlign: 'center' }}>{s.title}</H3>
                <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center' }}>{s.description}</BodySmall>
              </VStack>
            ))}
          </HStack>
        </VStack>
      </section>

      {/* ─── Why it matters ─── */}
      <section data-theme="Primary" data-surface="Surface" style={{ padding: '80px 24px', background: 'var(--Background)', color: 'var(--Text)' }}>
        <VStack spacing={5} style={{ maxWidth: 900, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              Why DinoDesign
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>A design system shouldn't take months</H2>
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center', maxWidth: 560 }}>
              Most teams spend weeks building design tokens, months on component libraries,
              and never quite get accessibility right. DinoDesign does it all from a single image.
            </Body>
          </VStack>
        </VStack>
      </section>

      {/* ─── What you get (Resources) ─── */}
      <section id="resources" style={{ padding: '80px 24px', background: 'var(--Container, #f8f8f8)' }}>
        <VStack spacing={5} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              What You Get
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Everything you need, nothing you don't</H2>
          </VStack>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map(f => (
              <Card key={f.title} padding="medium">
                <VStack spacing={2}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--Buttons-Primary-Button)',
                    color: 'var(--Buttons-Primary-Text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {f.icon}
                  </div>
                  <BodySmall style={{ fontWeight: 700 }}>{f.title}</BodySmall>
                  <BodySmall style={{ color: 'var(--Quiet)' }}>{f.description}</BodySmall>
                </VStack>
              </Card>
            ))}
          </div>
        </VStack>
      </section>

      {/* ─── Gallery (placeholder) ─── */}
      <section id="gallery" style={{ padding: '80px 24px' }}>
        <VStack spacing={5} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              Gallery
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Design systems built with DinoDesign</H2>
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>Coming soon — showcasing real design systems created by our users.</Body>
          </VStack>
        </VStack>
      </section>

      {/* ─── Add-Ons ─── */}
      <section id="addons" style={{ padding: '80px 24px', background: 'var(--Container, #f8f8f8)' }}>
        <VStack spacing={5} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              Add-On Components
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Expand your component catalog</H2>
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center', maxWidth: 560 }}>
              Premium components styled with your brand tokens — purchase individually and add to your design system.
            </Body>
          </VStack>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { title: 'Hero Sections', description: 'Full-width hero layouts with image backgrounds, split content, and animated call-to-action patterns.', tag: 'Coming soon' },
              { title: 'Footers', description: 'Multi-column footer templates with newsletter signup, social links, and sitemap layouts.', tag: 'Coming soon' },
              { title: 'Gradient Headers', description: 'Dynamic gradient headers that blend your primary and secondary palette colors for impactful page intros.', tag: 'Coming soon' },
              { title: 'Gradient Surfaces', description: 'Cards, boxes, and page backgrounds with smooth gradient fills derived from your LCH tone scale.', tag: 'Coming soon' },
              { title: 'Charts & Data Viz', description: 'Bar, line, pie, and area charts pre-themed with your design tokens and accessible color sequences.', tag: 'Coming soon' },
              { title: 'Marketing Blocks', description: 'Testimonial carousels, pricing tables, feature grids, and CTA sections — ready to drop in.', tag: 'Coming soon' },
            ].map(addon => (
              <Card key={addon.title} padding="medium">
                <VStack spacing={2}>
                  <HStack spacing={1} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <BodySmall style={{ fontWeight: 700 }}>{addon.title}</BodySmall>
                    <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {addon.tag}
                    </BodySmall>
                  </HStack>
                  <BodySmall style={{ color: 'var(--Quiet)' }}>{addon.description}</BodySmall>
                </VStack>
              </Card>
            ))}
          </div>
        </VStack>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" style={{ padding: '80px 24px' }}>
        <VStack spacing={5} style={{ maxWidth: 600, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              Pricing
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Simple, transparent pricing</H2>
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
              One design system. Everything included. No hidden fees.
            </Body>
          </VStack>

          <Card padding="medium" style={{ outline: '2px solid var(--Buttons-Primary-Border)', outlineOffset: -2 }}>
            <VStack spacing={2}>
              <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <BodySmall style={{ fontWeight: 700 }}>Design System</BodySmall>
                <H3 style={{ margin: 0 }}>
                  $299
                  <BodySmall component="span" style={{ color: 'var(--Quiet)', fontSize: '0.85rem', marginLeft: 4, fontWeight: 400 }}>
                    one-time
                  </BodySmall>
                </H3>
              </HStack>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {['Figma library', 'MUI component library', 'AI integration file', 'Interactive playground', 'WCAG AA accessibility', 'Light + dark mode tokens'].map(f => (
                  <HStack key={f} spacing={1} alignItems="center">
                    <CheckCircleOutlineIcon style={{ fontSize: 16, color: 'var(--Icon-Secondary, var(--Text-Secondary))' }} />
                    <BodySmall>{f}</BodySmall>
                  </HStack>
                ))}
              </div>
              <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>+ $19/mo hosted playground (required). Annual billing available.</BodySmall>
            </VStack>
          </Card>

          <Button
            variant="default"
            size="large"
            fullWidth
            style={{ fontWeight: 700 }}
            onClick={() => window.location.href = '/create'}
            endIcon={<ArrowForwardIcon />}
          >
            Get started with DinoDesign
          </Button>
        </VStack>
      </section>

      {/* ─── Testimonials ─── */}
      <section style={{ padding: '80px 24px', background: 'var(--Container, #f8f8f8)' }}>
        <VStack spacing={5} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              What People Say
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Trusted by designers and developers</H2>
          </VStack>

          <HStack spacing={3} style={{ alignItems: 'stretch' }}>
            {TESTIMONIALS.map((t, i) => (
              <Card key={i} padding="medium" style={{ flex: 1 }}>
                <VStack spacing={2}>
                  <FormatQuoteIcon style={{ fontSize: 24, color: 'var(--Quiet)', transform: 'scaleX(-1)' }} />
                  <BodySmall style={{ fontStyle: 'italic', lineHeight: 1.6 }}>{t.quote}</BodySmall>
                  <VStack spacing={0}>
                    <BodySmall style={{ fontWeight: 700 }}>{t.author}</BodySmall>
                    <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>{t.company}</BodySmall>
                  </VStack>
                </VStack>
              </Card>
            ))}
          </HStack>
        </VStack>
      </section>

      {/* ─── Footer CTA ─── */}
      <section style={{ padding: '80px 24px' }}>
        <VStack spacing={3} alignItems="center" style={{ maxWidth: 600, margin: '0 auto' }}>
          <H2 style={{ textAlign: 'center' }}>Ready to build your design system?</H2>
          <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
            Upload a mood board. Get a complete design system. It's that simple.
          </Body>
          <Button
            variant="default"
            size="large"
            onClick={() => window.location.href = '/create'}
            endIcon={<ArrowForwardIcon />}
            style={{ fontWeight: 700 }}
          >
            Get started — free to explore
          </Button>
          <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
            No account required until you export. Design your system first, pay when you're ready.
          </BodySmall>
        </VStack>
      </section>

      {/* ─── Footer ─── */}
      <footer data-theme="Neutral-Dark" data-surface="Surface" style={{ padding: '24px', background: 'var(--Background)', color: 'var(--Text)', textAlign: 'center' }}>
        <BodySmall style={{ color: 'var(--Quiet)' }}>
          © {new Date().getFullYear()} DinoDesign. All rights reserved.
        </BodySmall>
      </footer>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />
    </div>
  );
}
