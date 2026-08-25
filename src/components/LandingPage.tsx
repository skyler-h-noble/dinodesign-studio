import { useRef, useState, useEffect } from 'react';
import {
  AppBar, Button, H1, H2, H3, Body, BodySmall, VStack, HStack, Card, Tabs, TabList, Tab, Section, Footer, Icon,
} from '@omni-design/components';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import EnergySavingsLeafIcon from '@mui/icons-material/EnergySavingsLeaf';
import DevicesIcon from '@mui/icons-material/Devices';
import BrushIcon from '@mui/icons-material/Brush';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
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
  const [activeSection, setActiveSection] = useState<string>('');

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
    { label: 'HI, not AI', id: 'human-intelligence' },
    { label: 'Resources', id: 'resources' },
    { label: 'Pricing', id: 'pricing' },
  ];

  const handleNavClick = (id: string) => {
    const link = NAV_LINKS.find(l => l.id === id);
    if (link?.href) {
      window.location.href = link.href;
    } else {
      setActiveSection(id); // immediate feedback; the scrollspy keeps it in sync
      scrollTo(id);
    }
  };

  // Scrollspy — highlight the nav tab for the section currently in view. A thin
  // band across the upper-middle of the viewport (rootMargin) decides which
  // section is "active", so the indicator advances as the page scrolls.
  useEffect(() => {
    const els = NAV_LINKS
      .filter(l => !l.href)
      .map(l => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (inView[0]) setActiveSection((inView[0].target as HTMLElement).id);
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
    // NAV_LINKS is stable content; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const FEATURES = [
    { icon: <SyncAltIcon />, title: 'Design ↔ Code, both ways', description: 'Turn designs into production code and code into Figma designs — a genuine two-way bridge, not a one-off export.' },
    { icon: <AutoAwesomeIcon />, title: 'Agentic prompt-to-anything', description: 'Prompt your way to code or a design. Built for agentic AI workflows so your assistant ships with your system from the first prompt.' },
    { icon: <BrushIcon />, title: 'Complete Figma design system', description: 'A full Figma library — variables, modes, and components — matching your coded tokens 1:1.' },
    { icon: <DevicesIcon />, title: 'Custom MUI component library', description: 'A branded MUI component library that adapts to mode, color, surface, and platform automatically.' },
    { icon: <RocketLaunchIcon />, title: 'Hosted design system + Playground', description: 'Your tokens are hosted and production-ready from day one, with an interactive Playground to preview and test every component in your brand.' },
    { icon: <AccessibilityNewIcon />, title: 'Built-in accessibility', description: 'Your components are assured to meet WCAG contrast and target-size requirements — in every state, on every system background color, in every mode.' },
    { icon: <CheckCircleOutlineIcon />, title: 'No Figma Enterprise or Dev Mode required', description: 'Runs on a standard Figma Professional plan — its 10 variable modes cover your whole system. No Enterprise seat and no Dev Mode needed.' },
  ];

  const STEPS = [
    { step: '1', title: 'Upload a mood board', description: 'Drop any image — a brand board, a photo, a screenshot. The system extracts your color palette automatically.' },
    { step: '2', title: 'Customize your system', description: 'Adjust colors, pick typography, set component styles. See changes live in the phone preview.' },
    { step: '3', title: 'Get your design system', description: 'Receive hosted CSS tokens, Figma library, and an AI integration file — all production-ready.' },
  ];

  const TESTIMONIALS = [
    { quote: 'We went from a mood board to a fully accessible design system in under 20 minutes. This would have taken our team weeks.', author: 'Design Lead', company: 'Series B Startup' },
    { quote: 'The Figma-to-code parity is incredible. Our designers and developers are finally speaking the same language.', author: 'VP Engineering', company: 'SaaS Platform' },
    { quote: 'I\'m a solo founder with no design background. OmniDesign gave me a professional design system that looks like I hired an agency.', author: 'Founder', company: 'Indie App' },
  ];

  return (
    <Section theme="Default" surface="Surface" as="div" style={{ overflowX: 'clip' }}>
      {/* ─── Top Nav (sticky) ─── */}
      <Section as="div" surface="Surface" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <AppBar
        brand="OmniDesign"
        onBrandClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        centerSlot={
          <Tabs value={activeSection} onChange={(val: string) => handleNavClick(val)}>
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
      </Section>

      {/* ─── Hero ─── */}
      <Section theme="Neutral-Dark" surface="Surface" padding="80px 24px 60px">
        <VStack spacing={4} alignItems="center" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={2} alignItems="center">
            <BodySmall color="primary" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', textAlign: 'center' }}>
              Branded, Scalable and Accessible Design Systems, Automated
            </BodySmall>
            <H1 style={{ textAlign: 'center', maxWidth: 700 }}>
              One image. One complete design system.
            </H1>
            <Body color="quiet" style={{ textAlign: 'center', maxWidth: 560 }}>
              Upload a mood board and get a fully accessible, coded design system with Figma library,
              49 React components, and hosted playground — live in minutes.
            </Body>
          </VStack>

          <Button
            variant="default"
            size="large"
            onClick={() => window.location.href = '/create'}
            endIcon={<ArrowForwardIcon />}
            style={{ fontWeight: 700 }}
          >
            Build your design system
          </Button>

          <div style={{ width: '100%', maxWidth: 1000 }}>
            <MoodDemo />
          </div>
        </VStack>
      </Section>

      {/* ─── How it Works ─── */}
      <Section surface="Container" id="how-it-works" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 900, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', textAlign: 'center' }}>
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
                <BodySmall color="quiet" style={{ textAlign: 'center' }}>{s.description}</BodySmall>
              </VStack>
            ))}
          </HStack>
        </VStack>
      </Section>

      {/* ─── Why it matters ─── */}
      <Section theme="Primary" surface="Surface" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 900, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', textAlign: 'center' }}>
              Why OmniDesign
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>A design system shouldn't take months</H2>
            <Body color="quiet" style={{ textAlign: 'center', maxWidth: 560 }}>
              Most teams spend weeks building design tokens, months on component libraries,
              and never quite get accessibility right. OmniDesign does it all from a single
              image — in minutes, not months.
            </Body>
          </VStack>
        </VStack>
      </Section>

      {/* ─── HI, not AI (sustainability + token efficiency) ─── */}
      <Section surface="Container" id="human-intelligence" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 900, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', textAlign: 'center' }}>
              HI, not AI
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Built by human intelligence — not power-hungry AI</H2>
            <Body color="quiet" style={{ textAlign: 'center', maxWidth: 620 }}>
              OmniDesign builds your design system with design science, color theory, and WCAG
              accessibility guidelines — human expertise, not energy-hungry generative models.
              Better for your output, and better for the planet.
            </Body>
          </VStack>

          <HStack spacing={4} style={{ alignItems: 'stretch' }}>
            <Card padding="large" style={{ flex: 1 }}>
              <VStack spacing={2} alignItems="flex-start">
                <Icon size="medium" color="success"><EnergySavingsLeafIcon /></Icon>
                <H3>Kinder to the environment</H3>
                <BodySmall color="quiet">
                  No massive AI compute burning energy to generate your system — human
                  intelligence does the heavy lifting, so building a design system doesn't
                  cost the earth.
                </BodySmall>
              </VStack>
            </Card>
            <Card padding="large" style={{ flex: 1 }}>
              <VStack spacing={2} alignItems="flex-start">
                <Icon size="medium" color="primary"><SpeedIcon /></Icon>
                <H3>Fewer tokens, less design churn</H3>
                <BodySmall color="quiet">
                  Design is where agentic AI burns the most tokens — endless restyling and
                  rework. Hand your AI a ready OmniDesign system and it spends tokens shipping
                  features, not fighting your styles.
                </BodySmall>
              </VStack>
            </Card>
          </HStack>
        </VStack>
      </Section>

      {/* ─── What you get (Resources) ─── */}
      <Section theme="Primary-Light" surface="Container" id="resources" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', textAlign: 'center' }}>
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
                  <BodySmall color="quiet">{f.description}</BodySmall>
                </VStack>
              </Card>
            ))}
          </div>
        </VStack>
      </Section>

      {/* ─── Pricing ─── */}
      <Section id="pricing" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 600, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', textAlign: 'center' }}>
              Pricing
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Simple, transparent pricing</H2>
            <Body color="quiet" style={{ textAlign: 'center' }}>
              One design system. Everything included. No hidden fees.
            </Body>
          </VStack>

          <Card padding="medium" style={{ outline: '2px solid var(--Buttons-Primary-Border)', outlineOffset: -2 }}>
            <VStack spacing={2}>
              <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <BodySmall style={{ fontWeight: 700 }}>Design System</BodySmall>
                <H3 style={{ margin: 0 }}>
                  $299
                  <BodySmall component="span" color="quiet" style={{ fontSize: '0.85rem', marginLeft: 4, fontWeight: 400 }}>
                    one-time
                  </BodySmall>
                </H3>
              </HStack>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {['Figma library', 'MUI component library', 'AI integration file', 'Interactive playground', 'WCAG AA accessibility', 'Light + dark mode tokens'].map(f => (
                  <HStack key={f} spacing={1} alignItems="center">
                    <Icon size="small" color="secondary"><CheckCircleOutlineIcon /></Icon>
                    <BodySmall>{f}</BodySmall>
                  </HStack>
                ))}
              </div>
              <BodySmall color="quiet" style={{ fontSize: '0.7rem' }}>+ $19/mo hosted playground (required). Annual billing available.</BodySmall>
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
            Get started with OmniDesign
          </Button>
        </VStack>
      </Section>

      {/* ─── Testimonials ─── */}
      <Section surface="Container" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', textAlign: 'center' }}>
              What People Say
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Trusted by designers and developers</H2>
          </VStack>

          <HStack spacing={3} style={{ alignItems: 'stretch' }}>
            {TESTIMONIALS.map((t, i) => (
              <Card key={i} padding="medium" style={{ flex: 1 }}>
                <VStack spacing={2}>
                  <div style={{ transform: 'scaleX(-1)', width: 24, height: 24 }}>
                    <Icon size="medium" color="neutral"><FormatQuoteIcon /></Icon>
                  </div>
                  <BodySmall style={{ fontStyle: 'italic', lineHeight: 1.6 }}>{t.quote}</BodySmall>
                  <VStack spacing={0}>
                    <BodySmall style={{ fontWeight: 700 }}>{t.author}</BodySmall>
                    <BodySmall color="quiet" style={{ fontSize: '0.7rem' }}>{t.company}</BodySmall>
                  </VStack>
                </VStack>
              </Card>
            ))}
          </HStack>
        </VStack>
      </Section>

      {/* ─── Footer CTA ─── */}
      <Section padding="80px 24px">
        <VStack spacing={3} alignItems="center" style={{ maxWidth: 600, margin: '0 auto' }}>
          <H2 style={{ textAlign: 'center' }}>Ready to build your design system?</H2>
          <Body color="quiet" style={{ textAlign: 'center' }}>
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
          <BodySmall color="quiet" style={{ fontSize: '0.7rem', textAlign: 'center' }}>
            No account required until you export. Design your system first, pay when you're ready.
          </BodySmall>
        </VStack>
      </Section>

      {/* ─── Footer ─── */}
      <Footer
        brand={<H3 style={{ color: 'inherit', margin: 0 }}>OmniDesign</H3>}
        address={{
          company: 'OmniDesign',
          lines: ['Built for designers + AI agents', 'San Francisco, CA'],
          email: 'hello@omnidesign.ai',
        }}
        columns={[
          {
            title: 'Product',
            links: [
              { label: 'How it Works', onClick: () => scrollTo('how-it-works') },
              { label: 'Pricing', onClick: () => scrollTo('pricing') },
            ],
          },
          {
            title: 'Resources',
            links: [
              { label: 'Resources', onClick: () => scrollTo('resources') },
            ],
          },
        ]}
        copyrightName="OmniDesign"
      />

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />
    </Section>
  );
}
