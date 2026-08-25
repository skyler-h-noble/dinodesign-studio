import { useRef, useState, useEffect } from 'react';
import {
  AppBar, Button, H1, H2, H3, Body, BodySmall, Caption, VStack, HStack, Card,
  Tabs, TabList, Tab, Section, Footer, Icon, Chip, Divider, Link,
} from '@omni-design/components';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SpeedIcon from '@mui/icons-material/Speed';
import PaletteIcon from '@mui/icons-material/Palette';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import DevicesIcon from '@mui/icons-material/Devices';
import LayersIcon from '@mui/icons-material/Layers';
import GavelIcon from '@mui/icons-material/Gavel';
import BoltIcon from '@mui/icons-material/Bolt';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import AvatarDropdown from './AvatarDropdown';
import MoodDemo from './MoodDemo';

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// Standard WCAG relative-luminance / contrast-ratio formula (public; NOT the
// brand color-derivation logic). Used only to READ and display the ratio of
// whatever colors are already rendered — no proprietary math shipped.
function ratioFromRgb(fg: string, bg: string): number | null {
  const lum = (rgb: string): number | null => {
    const m = rgb.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    const [r, g, b] = m.slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(fg);
  const l2 = lum(bg);
  if (l1 == null || l2 == null) return null;
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Reads the resolved --Text / --Background of a themed container and returns
// the contrast ratio, by probing actual computed colors (resolves var chains).
function measureContrast(container: HTMLElement): number | null {
  const probe = document.createElement('span');
  probe.style.color = 'var(--Text)';
  probe.style.backgroundColor = 'var(--Background)';
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  container.appendChild(probe);
  const cs = getComputedStyle(probe);
  const ratio = ratioFromRgb(cs.color, cs.backgroundColor);
  container.removeChild(probe);
  return ratio;
}

// Background presets toggle ONLY data-theme / data-surface (the cascade) — no
// logic ships; the browser swaps finished tokens.
const BACKGROUNDS: Array<{ label: string; theme?: string; surface: string }> = [
  { label: 'Default',  theme: undefined,       surface: 'Surface' },
  { label: 'Soft',     theme: undefined,       surface: 'Container' },
  { label: 'Primary',  theme: 'Primary',       surface: 'Surface' },
  { label: 'Tertiary', theme: 'Tertiary',      surface: 'Surface' },
  { label: 'Dark',     theme: 'Neutral-Dark',  surface: 'Surface' },
];

function AdaptiveDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [bg, setBg] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    if (ref.current) setRatio(measureContrast(ref.current));
  }, [bg]);

  const passAA = ratio != null && ratio >= 4.5;
  const passAAA = ratio != null && ratio >= 7;
  const active = BACKGROUNDS[bg];

  return (
    <Card padding="medium">
      <VStack spacing={3}>
        {/* Background controls */}
        <HStack spacing={1} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <BodySmall style={{ fontWeight: 700, marginRight: 8 }}>Background</BodySmall>
          {BACKGROUNDS.map((b, i) => (
            <Button
              key={b.label}
              size="small"
              variant={i === bg ? 'default' : 'default-outline'}
              onClick={() => setBg(i)}
            >
              {b.label}
            </Button>
          ))}
        </HStack>

        {/* Live themed preview — components re-theme via the cascade */}
        <div
          ref={ref}
          {...(active.theme ? { 'data-theme': active.theme } : {})}
          data-surface={active.surface}
          style={{
            background: 'var(--Background)',
            color: 'var(--Text)',
            borderRadius: 'var(--Style-Border-Radius)',
            padding: 'var(--Sizing-3)',
          }}
        >
          <VStack spacing={2}>
            <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <H3 style={{ margin: 0 }}>Stays readable</H3>
              <Chip variant={passAA ? 'success-light' : 'warning-light'}>
                {ratio ? `${ratio.toFixed(1)}:1` : '—'} {passAAA ? 'AAA ✓' : passAA ? 'AA ✓' : ''}
              </Chip>
            </HStack>
            <Body>Text, borders, and controls re-tune to every background automatically.</Body>
            <Divider />
            <HStack spacing={2} style={{ flexWrap: 'wrap' }}>
              <Button variant="default" size="small">Primary action</Button>
              <Button variant="default-outline" size="small">Secondary</Button>
              <Chip variant="success-light">Active</Chip>
            </HStack>
          </VStack>
        </div>

        <Caption color="quiet">
          Change the background — contrast adapts to stay accessible. (No code, no setup.)
        </Caption>
      </VStack>
    </Card>
  );
}

export default function LandingPageAlt() {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'true') {
      setShowAuthModal(true);
      params.delete('login');
      const newSearch = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
    }
  }, []);

  const NAV_LINKS: Array<{ label: string; id: string; href?: string }> = [
    { label: 'How it Works', id: 'how-it-works' },
    { label: 'Adaptive', id: 'adaptive' },
    { label: 'Accessibility', id: 'accessibility' },
    { label: 'Pricing', id: 'pricing' },
  ];
  const handleNavClick = (id: string) => {
    const link = NAV_LINKS.find((l) => l.id === id);
    if (link?.href) window.location.href = link.href;
    else scrollTo(id);
  };

  const GAPS = [
    { icon: <DevicesIcon />, title: 'Light & dark, out of the box', description: 'Most systems ship one mode. Yours adapts to light and dark from day one.' },
    { icon: <AccessibilityNewIcon />, title: 'Accessible at the core', description: 'Contrast, target size, and semantics built into every component — not a final-week audit.' },
    { icon: <LayersIcon />, title: 'Adaptive to background & elevation', description: 'Surfaces and elevation re-tune automatically so everything stays legible, anywhere.' },
  ];

  return (
    <Section theme="Default" surface="Surface" as="div" style={{ overflowX: 'clip' }}>
      {/* ─── Sticky Nav ─── */}
      <Section as="div" surface="Surface" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <AppBar
          brand="OmniDesign"
          onBrandClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          centerSlot={
            <Tabs onChange={(val: string) => handleNavClick(val)}>
              <TabList aria-label="Page sections">
                {NAV_LINKS.map((link) => (
                  <Tab key={link.id} value={link.id}>{link.label}</Tab>
                ))}
              </TabList>
            </Tabs>
          }
          endSlot={
            <HStack spacing={1} style={{ alignItems: 'center' }}>
              <Button variant="default" size="small" onClick={() => (window.location.href = '/create')}>
                Get Started
              </Button>
              {user ? (
                <AvatarDropdown user={user} onSignOut={async () => { await signOut(); window.location.href = '/'; }} />
              ) : (
                <Button variant="outline" color="default" size="small" onClick={() => setShowAuthModal(true)}>
                  Login
                </Button>
              )}
            </HStack>
          }
        />
      </Section>

      {/* ─── Hero: efficiency lead ─── */}
      <Section theme="Neutral-Dark" surface="Surface" padding="80px 24px 60px">
        <VStack spacing={4} alignItems="center" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={2} alignItems="center">
            <BodySmall color="primary" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', textAlign: 'center' }}>
              Design systems, automated
            </BodySmall>
            <H1 style={{ textAlign: 'center', maxWidth: 760 }}>
              A complete design system in minutes — not months.
            </H1>
            <Body color="quiet" style={{ textAlign: 'center', maxWidth: 600 }}>
              Building one the usual way costs $25K–$250K+ and takes a team months — and most still
              aren't dark-mode-ready, accessible at the core, or adaptive. Upload a mood board and get
              a coded system + a synced Figma library, ready to ship.
            </Body>
          </VStack>
          <Button variant="default" size="large" onClick={() => (window.location.href = '/create')} endIcon={<ArrowForwardIcon />} style={{ fontWeight: 700 }}>
            Build your design system
          </Button>
          <div style={{ width: '100%', maxWidth: 1000 }}>
            <MoodDemo />
          </div>
        </VStack>
      </Section>

      {/* ─── Cost / time proof ─── */}
      <Section surface="Container" id="how-it-works" padding="64px 24px">
        <VStack spacing={4} style={{ maxWidth: 1000, margin: '0 auto' }} alignItems="center">
          <H2 style={{ textAlign: 'center' }}>The old way is slow, costly, and still incomplete</H2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, width: '100%' }}>
            {[
              { stat: '$25K–$250K+', label: 'Typical cost to build a design system; $1M+ at large orgs.' },
              { stat: 'Weeks–months', label: 'Dedicated team time — and it is never truly "done."' },
              { stat: 'Most fall short', label: 'No dark mode, accessibility bolted on late, not adaptive.' },
            ].map((s) => (
              <Card key={s.stat} padding="medium">
                <VStack spacing={1}>
                  <H3 style={{ margin: 0 }}>{s.stat}</H3>
                  <BodySmall color="quiet">{s.label}</BodySmall>
                </VStack>
              </Card>
            ))}
          </div>
          <Caption color="quiet" style={{ textAlign: 'center' }}>
            Industry estimates ·{' '}
            <Link href="https://thedesignsystem.guide/blog/a-guide-for-calculating-design-system-costs" target="_blank" rel="noopener">
              The Design System Guide
            </Link>
            {', '}
            <Link href="https://www.dhiwise.com/post/design-system-development-cost" target="_blank" rel="noopener">
              DhiWise
            </Link>
          </Caption>
        </VStack>
      </Section>

      {/* ─── The gap: complete by default ─── */}
      <Section padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 1000, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <H2 style={{ textAlign: 'center' }}>Complete, by default</H2>
            <Body color="quiet" style={{ textAlign: 'center', maxWidth: 560 }}>
              The things most design systems skip — built in from the first minute.
            </Body>
          </VStack>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {GAPS.map((g) => (
              <Card key={g.title} padding="medium">
                <VStack spacing={2}>
                  <Icon size="medium" color="primary">{g.icon}</Icon>
                  <BodySmall style={{ fontWeight: 700 }}>{g.title}</BodySmall>
                  <BodySmall color="quiet">{g.description}</BodySmall>
                </VStack>
              </Card>
            ))}
          </div>
        </VStack>
      </Section>

      {/* ─── Adaptive demo (visual, IP-safe) ─── */}
      <Section surface="Container" id="adaptive" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 800, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <H2 style={{ textAlign: 'center' }}>Adaptive — and it stays accessible</H2>
            <Body color="quiet" style={{ textAlign: 'center', maxWidth: 560 }}>
              Change the background. Watch every component re-tune so contrast holds — automatically.
            </Body>
          </VStack>
          <AdaptiveDemo />
        </VStack>
      </Section>

      {/* ─── Accessibility as liability ─── */}
      <Section theme="Primary" surface="Surface" id="accessibility" padding="80px 24px">
        <VStack spacing={4} style={{ maxWidth: 820, margin: '0 auto' }} alignItems="center">
          <Icon size="large" color="neutral"><GavelIcon /></Icon>
          <H2 style={{ textAlign: 'center' }}>Accessibility isn't optional — it's liability</H2>
          <Body color="quiet" style={{ textAlign: 'center', maxWidth: 620 }}>
            Roughly 4,000 ADA website lawsuits were filed in 2025 (5,000+ with state courts), and
            75% targeted companies making under $25M. OmniDesign builds accessibility into the core —
            contrast, target size, and semantics — so you ship on a foundation that reduces your exposure.
          </Body>
          <Caption color="quiet" style={{ textAlign: 'center' }}>
            Sources ·{' '}
            <Link href="https://www.ecomback.com/annual-2025-ada-website-accessibility-lawsuit-report" target="_blank" rel="noopener">
              EcomBack 2025 Report
            </Link>
            {', '}
            <Link href="https://blog.usablenet.com/wsj-exposes-the-high-costs-of-inaccessible-websites-key-insights" target="_blank" rel="noopener">
              WSJ via UsableNet
            </Link>
          </Caption>
        </VStack>
      </Section>

      {/* ─── See it in Figma + Code (video slot) ─── */}
      <Section padding="80px 24px">
        <VStack spacing={4} style={{ maxWidth: 900, margin: '0 auto' }} alignItems="center">
          <H2 style={{ textAlign: 'center' }}>See it in Figma and in code</H2>
          <Body color="quiet" style={{ textAlign: 'center', maxWidth: 560 }}>
            One source of truth — change it on either side and it stays in sync.
          </Body>
          <Card padding="none" style={{ width: '100%', maxWidth: 800 }}>
            <div
              data-surface="Container"
              style={{ width: '100%', aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--Style-Border-Radius)' }}
            >
              {/* TODO: replace with <video src=…> or an embed when the clip is ready */}
              <VStack spacing={1} alignItems="center">
                <Icon size="large" color="quiet"><PlayCircleOutlineIcon /></Icon>
                <BodySmall color="quiet">Demo video coming soon</BodySmall>
              </VStack>
            </div>
          </Card>
        </VStack>
      </Section>

      {/* ─── Lean + access (outcomes, no "how") ─── */}
      <Section surface="Container" padding="72px 24px">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, maxWidth: 900, margin: '0 auto' }}>
          <Card padding="medium">
            <VStack spacing={2}>
              <Icon size="medium" color="primary"><BoltIcon /></Icon>
              <BodySmall style={{ fontWeight: 700 }}>Lean code, lower ongoing cost</BodySmall>
              <BodySmall color="quiet">
                Clean, token-based components — not bloated one-off styling. Lighter pages, faster to ship,
                far less to maintain month over month.
              </BodySmall>
            </VStack>
          </Card>
          <Card padding="medium">
            <VStack spacing={2}>
              <Icon size="medium" color="primary"><SpeedIcon /></Icon>
              <BodySmall style={{ fontWeight: 700 }}>No Enterprise. No Dev Mode.</BodySmall>
              <BodySmall color="quiet">
                Design→code, code→design, and AI-agent enablement work without paid Figma Enterprise or
                Dev Mode. The foundations layer, open to everyone.
              </BodySmall>
            </VStack>
          </Card>
        </div>
      </Section>

      {/* ─── HI not AI (value line, no how) ─── */}
      <Section theme="Neutral-Dark" surface="Surface" padding="64px 24px">
        <VStack spacing={2} alignItems="center" style={{ maxWidth: 700, margin: '0 auto' }}>
          <H2 style={{ textAlign: 'center' }}>Built on human intelligence — not AI guesswork</H2>
          <Body color="quiet" style={{ textAlign: 'center' }}>
            Efficient, ethical, and dependable: AI assists where judgment helps, and never where
            correctness and accessibility matter most.
          </Body>
        </VStack>
      </Section>

      {/* ─── Pricing ─── */}
      <Section id="pricing" padding="80px 24px">
        <VStack spacing={5} style={{ maxWidth: 600, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <H2 style={{ textAlign: 'center' }}>Simple, transparent pricing</H2>
            <Body color="quiet" style={{ textAlign: 'center' }}>One design system. Everything included.</Body>
          </VStack>
          <Card padding="medium" style={{ outline: '2px solid var(--Buttons-Primary-Border)', outlineOffset: -2 }}>
            <VStack spacing={2}>
              <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <BodySmall style={{ fontWeight: 700 }}>Design System</BodySmall>
                <H3 style={{ margin: 0 }}>
                  $299
                  <BodySmall component="span" color="quiet" style={{ fontSize: '0.85rem', marginLeft: 4, fontWeight: 400 }}>one-time</BodySmall>
                </H3>
              </HStack>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {['Figma library', 'React component library', 'AI integration file', 'Interactive playground', 'Accessible by construction', 'Light + dark mode'].map((f) => (
                  <HStack key={f} spacing={1} alignItems="center">
                    <Icon size="small" color="secondary"><CheckCircleOutlineIcon /></Icon>
                    <BodySmall>{f}</BodySmall>
                  </HStack>
                ))}
              </div>
              <BodySmall color="quiet" style={{ fontSize: '0.7rem' }}>+ $19/mo hosted playground (required). Annual billing available.</BodySmall>
            </VStack>
          </Card>
          <Button variant="default" size="large" fullWidth style={{ fontWeight: 700 }} onClick={() => (window.location.href = '/create')} endIcon={<ArrowForwardIcon />}>
            Get started with OmniDesign
          </Button>
        </VStack>
      </Section>

      {/* ─── Footer CTA ─── */}
      <Section padding="80px 24px">
        <VStack spacing={3} alignItems="center" style={{ maxWidth: 600, margin: '0 auto' }}>
          <H2 style={{ textAlign: 'center' }}>From a mood board to a complete design system — in minutes.</H2>
          <Button variant="default" size="large" onClick={() => (window.location.href = '/create')} endIcon={<ArrowForwardIcon />} style={{ fontWeight: 700 }}>
            Get started — free to explore
          </Button>
          <BodySmall color="quiet" style={{ fontSize: '0.7rem' }}>No account required until you export.</BodySmall>
        </VStack>
      </Section>

      <Footer
        brand={<H3 style={{ color: 'inherit', margin: 0 }}>OmniDesign</H3>}
        address={{ company: 'OmniDesign', lines: ['Built for designers + AI agents'], email: 'hello@omnidesign.ai' }}
        columns={[
          { title: 'Product', links: [{ label: 'How it Works', onClick: () => scrollTo('how-it-works') }, { label: 'Adaptive', onClick: () => scrollTo('adaptive') }, { label: 'Pricing', onClick: () => scrollTo('pricing') }] },
          { title: 'Resources', links: [{ label: 'Accessibility', onClick: () => scrollTo('accessibility') }] },
        ]}
        copyrightName="OmniDesign"
      />

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} />
    </Section>
  );
}
