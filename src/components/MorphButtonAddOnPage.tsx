/**
 * Morph Button add-on — choose a ShapeButton's two shapes and the moment it
 * morphs, see it, and take the code and the Figma steps away.
 *
 * Same frame as every add-on: Build / Code / Export / Import, the design
 * system's own CSS when a uuid is given, and a share link the exported file
 * carries so it can be reopened here.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import {
  Body, BodySmall, Caption, H3, VStack, HStack, Card, Alert, Button, Tabs, TabList, Tab, TabPanel,
  CodeBlock, TextArea, TextField, Select, ToggleButtonGroup, Link, ShapeButton, shapeOptions,
  MORPHABLE_SHAPES, AVATAR_SHAPES, OmniDesignProvider,
} from '@omni-design/components';
import FavoriteIcon from '@mui/icons-material/Favorite';
import StarIcon from '@mui/icons-material/Star';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AddOnTopNav from './addOns/AddOnTopNav';
import { systemExists } from '../utils/docs/systemCss';
import { libraryPageUrl } from '../utils/docs/docsLink';
import { liveSystemCss, type LiveSystemCss } from '../utils/addOns/charts/liveSystemCss';
import {
  DEFAULT_MORPH, MORPH_ICONS, encodeMorphState, readMorphState, morphCode,
  type MorphState, type MorphTrigger, type MorphSize,
} from '../utils/addOns/morph/morphButton';

const ICONS: Record<string, ReactNode> = {
  Favorite: <FavoriteIcon />, Star: <StarIcon />, Bookmark: <BookmarkIcon />, Add: <AddIcon />,
  PlayArrow: <PlayArrowIcon />, Check: <CheckIcon />, ThumbUp: <ThumbUpIcon />, Notifications: <NotificationsIcon />,
};
const COLORS = ['default', 'primary', 'secondary', 'tertiary', 'neutral'];
/* The button shapes that can blend into one another: the avatar set's round
   ones. */
const MORPH_PAIR_SHAPES = AVATAR_SHAPES.filter((n: string) => MORPHABLE_SHAPES.includes(n));
const TRIGGER_LABEL: Record<MorphTrigger, string> = { selected: 'While selected', hover: 'On hover', press: 'While pressed' };

export default function MorphButtonAddOnPage() {
  const { uuid } = useParams<{ uuid?: string }>();
  const [exists, setExists] = useState<boolean | null>(null);
  const [systemCss, setSystemCss] = useState<LiveSystemCss | null>(null);
  useEffect(() => {
    let live = true;
    if (!uuid) { setExists(false); setSystemCss(null); return; }
    systemExists(uuid).then((ok) => { if (live) setExists(ok); });
    liveSystemCss(uuid).then((c) => { if (live) setSystemCss(c); });
    return () => { live = false; };
  }, [uuid]);

  const [st, setSt] = useState<MorphState>(DEFAULT_MORPH);
  const set = <K extends keyof MorphState>(k: K, v: MorphState[K]) => setSt((s) => ({ ...s, [k]: v }));
  const [tab, setTab] = useState<'build' | 'code' | 'export' | 'import'>('build');
  const [on, setOn] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Opened from a link: once, on arrival.
  useEffect(() => {
    const s = readMorphState(window.location.hash);
    if (s) setSt(s);
  }, []);

  const link = useMemo(
    () => `${window.location.origin}/add-ons/morph-button/${uuid || ''}#spec=${encodeMorphState(st)}`,
    [st, uuid],
  );
  const code = useMemo(() => morphCode(st, link), [st, link]);
  const icon = ICONS[st.icon] ?? <FavoriteIcon />;
  const button = (selected: boolean, props: Record<string, unknown> = {}) => (
    <ShapeButton shape={st.shape} morphTo={st.morphTo} morphOn={st.morphOn} selected={selected}
                 color={st.color} size={st.size} aria-label={st.label} {...props}>
      {icon}
    </ShapeButton>
  );

  const body = (
    <>
      <AddOnTopNav title="Morph Button" uuid={uuid} exists={exists} basePath="/add-ons/morph-button" />
      <VStack spacing={3} style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px 32px' }}>
        <Body color="quiet">
          A button on one of your shapes that turns into another — on hover, on press, or while it is on.
          Pick a pair that blends, see it move, and take the code and the Figma steps.{' '}
          <Link href={libraryPageUrl('shapebutton', uuid)} target="_blank" rel="noopener">About ShapeButton in the component library</Link>
        </Body>
        {exists === false && (
          <Alert color="warning"><BodySmall>
            {uuid ? 'No design system has that ID, so the button is drawn without a brand.' : 'Use the settings cog at the top right to enter your design system ID and draw the button in your brand.'}
          </BodySmall></Alert>
        )}

        <Tabs value={tab} onChange={(v: typeof tab) => setTab(v)} sx={{ overflow: 'clip' }}>
          <TabList aria-label="Morph Button">
            <Tab value="build">Build</Tab>
            <Tab value="code">Code</Tab>
            <Tab value="export">Export</Tab>
            <Tab value="import">Import</Tab>
          </TabList>

          <TabPanel value="build">
            {/* Layout primitive: controls left, the button right. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, paddingTop: 16 }}>
              <Card padding="medium">
                <VStack spacing={2.5}>
                  <Select label="Shape" fullWidth value={st.shape} onChange={(v: string) => set('shape', v)} options={shapeOptions(MORPH_PAIR_SHAPES)} />
                  <Select label="Morphs to" fullWidth value={st.morphTo} onChange={(v: string) => set('morphTo', v)} options={shapeOptions(MORPH_PAIR_SHAPES)} />
                  <Caption color="quiet">
                    The button shapes that share an outline — circle, the cookies, flower and puffy — so one turns into the other smoothly, in code and with Smart Animate in Figma.
                  </Caption>
                  <VStack spacing={1}>
                    <BodySmall>When it morphs</BodySmall>
                    <ToggleButtonGroup value={st.morphOn} onChange={(v: MorphTrigger) => v && set('morphOn', v)} size="small" aria-label="When it morphs">
                      {(Object.keys(TRIGGER_LABEL) as MorphTrigger[]).map((t) => <Button key={t} value={t} size="small">{TRIGGER_LABEL[t]}</Button>)}
                    </ToggleButtonGroup>
                  </VStack>
                  <Select label="Icon" fullWidth value={st.icon} onChange={(v: string) => set('icon', v)}
                          options={MORPH_ICONS.map((n) => ({ value: n, label: n, icon: ICONS[n] }))} />
                  <TextField label="What it does (its name for screen readers)" fullWidth value={st.label}
                             onChange={(e: { target: { value: string } }) => set('label', e.target.value)} />
                  <VStack spacing={1}>
                    <BodySmall>Color</BodySmall>
                    <ToggleButtonGroup value={st.color} onChange={(v: string) => v && set('color', v)} size="small" aria-label="Color">
                      {COLORS.map((c) => <Button key={c} value={c} size="small">{c}</Button>)}
                    </ToggleButtonGroup>
                  </VStack>
                  <VStack spacing={1}>
                    <BodySmall>Size</BodySmall>
                    <ToggleButtonGroup value={st.size} onChange={(v: MorphSize) => v && set('size', v)} size="small" aria-label="Size">
                      {(['small', 'medium', 'large'] as MorphSize[]).map((s) => <Button key={s} value={s} size="small">{s}</Button>)}
                    </ToggleButtonGroup>
                  </VStack>
                </VStack>
              </Card>

              <Card padding="medium">
                <VStack spacing={3} style={{ alignItems: 'center' }}>
                  <H3>Try it</H3>
                  <div style={{ padding: 24 }}>
                    {button(on, st.morphOn === 'selected' ? { onClick: () => setOn((v) => !v) } : {})}
                  </div>
                  <Caption color="quiet">
                    {st.morphOn === 'selected' ? 'Click it to turn it on and off.' : st.morphOn === 'hover' ? 'Point at it.' : 'Press and hold it.'}
                  </Caption>
                  {/* Layout primitive: the two ends, side by side. */}
                  <div style={{ display: 'flex', gap: 48, justifyContent: 'center' }}>
                    <VStack spacing={1} style={{ alignItems: 'center' }}>
                      {button(false, { morphTo: undefined, tabIndex: -1, 'aria-hidden': true })}
                      <Caption color="quiet">Rest · {st.shape}</Caption>
                    </VStack>
                    <VStack spacing={1} style={{ alignItems: 'center' }}>
                      <ShapeButton shape={st.morphTo} color={st.color} size={st.size} tabIndex={-1} aria-hidden aria-label={st.label}>{icon}</ShapeButton>
                      <Caption color="quiet">Morphed · {st.morphTo}</Caption>
                    </VStack>
                  </div>
                </VStack>
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="code">
            <VStack spacing={2} style={{ paddingTop: 16 }}>
              <BodySmall color="quiet">One file. It uses ShapeButton from @omni-design/components and draws in your design system inside your OmniDesignProvider.</BodySmall>
              <CodeBlock code={code} language="JSX" maxHeight={480} />
              <BodySmall color="quiet">A link that reopens this button here for editing:</BodySmall>
              <CodeBlock code={link} language="URL" wrap maxHeight={120} />
            </VStack>
          </TabPanel>

          <TabPanel value="export">
            <VStack spacing={2} style={{ paddingTop: 16, maxWidth: 720 }}>
              <Body>In Figma, the ShapeButton component in your Omni library already has both ends. To set this one up:</Body>
              <VStack spacing={1}>
                <Body>1. Place a <strong>ShapeButton</strong> with Morph = <strong>Rest</strong>. In its properties, set the nested Shape to <strong>{st.shape}</strong> and swap the icon to <strong>{st.icon}</strong>.</Body>
                <Body>2. Place a second one with Morph = <strong>Morphed</strong> and set its Shape to <strong>{st.morphTo}</strong>.</Body>
                <Body>3. Set the Buttons mode on both to <strong>{st.color}</strong>.</Body>
                <Body>4. 
                  To see it move, prototype the Rest one: <strong>{st.morphOn === 'selected' ? 'On click' : st.morphOn === 'hover' ? 'While hovering' : 'While pressing'}</strong> →
                  Change to Morph = Morphed, <strong>Smart Animate</strong>, ease out, 450 ms.
                  {st.morphOn === 'selected' ? ' Add On click → Rest on the Morphed one so it toggles back.' : ''}
                </Body>
              </VStack>
              <Caption color="quiet">
                Smart Animate blends the two outlines because both are round shapes with the same points — the same reason the code can.
              </Caption>
            </VStack>
          </TabPanel>

          <TabPanel value="import">
            <div style={{ maxWidth: 560, paddingTop: 16 }}>
              <Card padding="medium">
                <VStack spacing={2}>
                  <H3>Import a morph button</H3>
                  <BodySmall color="quiet">Paste its link or the file the Code tab gave you — both carry the setup.</BodySmall>
                  <TextArea label="Link or code" rows={4} fullWidth value={importText}
                            onChange={(e: { target: { value: string } }) => setImportText(e.target.value)} />
                  {importError && <Alert color="warning"><BodySmall>{importError}</BodySmall></Alert>}
                  <HStack spacing={1}>
                    <Button variant="default-outline" size="small" disabled={!importText.trim()} onClick={() => {
                      const s = readMorphState(importText);
                      if (!s) { setImportError('That is not a Morph Button, or it was cut off when copying.'); return; }
                      setSt(s); setImportError(null); setImportText(''); setTab('build');
                    }}>Load</Button>
                  </HStack>
                </VStack>
              </Card>
            </div>
          </TabPanel>
        </Tabs>
      </VStack>
    </>
  );

  if (exists !== true || !uuid || !systemCss) return body;
  return (
    <OmniDesignProvider {...systemCss.urls} defaultTheme="Default" defaultStyle="Modern" defaultSurface="Surface">
      {body}
    </OmniDesignProvider>
  );
}
