/**
 * The Adaptive Nav as code: one React file a product drops in.
 *
 * The third compiler of the same definition. toAddonSpec writes Figma nodes,
 * DefinitionRenderer renders the preview, and this writes the source — using
 * the renderer's own nodeStyle / slotStyles, so the layout in the file is the
 * layout in the preview, not a second description of it.
 *
 * How each kind of condition compiles:
 *   device (width)        CSS media queries from the breakpoint table — a part
 *                         off at a breakpoint is display:none in that range
 *   scroll (condensed)    a scroll listener sets data-condensed on the root
 *   session (signed in)   the `signedIn` prop sets data-signed-in
 *   interaction (menu)    the avatar toggles data-menu-open; Escape and an
 *                         outside click close it
 *
 * Slots are filled with the library components the preview uses — Tabs,
 * Button, Avatar, Rail, BottomNavigation, SearchField, MenuItem — and the menu
 * button opens a Drawer holding the same tabs. Page content is `children`.
 */
import type { CSSProperties } from 'react';
import type { ComponentDefinition, NodeDef } from './defineComponent';
import type { Breakpoint, ConditionMatrix } from './breakpoints';
import type { NavItem, NavButtonItem, Session } from './navContent';
import { buttonVariant, sessionOf } from './navContent';
import type { AccountMenuItem } from './accountMenu';
import { ACCOUNT_MENU_CONDITION, SIGNED_IN_CONDITION, SIGNED_OUT_CONDITION } from './accountMenu';
import type { SpeedDialItem } from './speedDial';
import type { NavOptions } from './navDefinition';
import type { MobileOptions } from './mobileNav';
import { bottomBarItems } from './mobileNav';
import { contentInsets, type ContentInsets } from './contentInsets';
import { MOBILE_CONDITION } from './adaptiveNav';
import { nodeStyle, slotStyles } from '../../components/DefinitionRenderer';

export interface NavCodeInput {
  /** The combined definition (adaptiveNavDefinition). */
  definition: ComponentDefinition;
  breakpoints: Breakpoint[];
  /** Every condition's value per breakpoint (the page's `full` matrix). */
  matrix: ConditionMatrix;
  options: NavOptions;
  mobile: MobileOptions;
  tabs: NavItem[];
  actions: NavButtonItem[];
  accountItems: AccountMenuItem[];
  dialItems: SpeedDialItem[];
  componentSize: 'small' | 'medium' | 'large';
}

/* ── small helpers ──────────────────────────────────────────────────────── */

const slug = (condition: string) =>
  'an-' + condition.split('/').pop()!.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** 'expand-more' / 'Expand More' → 'ExpandMore', as NavIconGlyph resolves it. */
const iconName = (name: string | undefined, fallback = 'Home') => {
  const n = (name && name.trim()) || fallback;
  return n.replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^(.)/, (_, c: string) => c.toUpperCase());
};

const q = (s: string) => JSON.stringify(s);

/** A CSS-in-JS object as source. camelCase keys, numbers left numeric. */
function styleLiteral(style: CSSProperties): string {
  const entries = Object.entries(style).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '{}';
  return '{ ' + entries.map(([k, v]) => `${/^[a-zA-Z]+$/.test(k) ? k : q(k)}: ${typeof v === 'number' ? v : q(String(v))}`).join(', ') + ' }';
}

const indent = (text: string, n: number) => text.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

/* ── responsive CSS ─────────────────────────────────────────────────────── */

/** Each breakpoint's range as a media query, narrowest first. */
function ranges(bps: Breakpoint[]): { bp: Breakpoint; query: string }[] {
  const sorted = [...bps].sort((a, b) => a.minWidth - b.minWidth);
  return sorted.map((bp, i) => {
    const next = sorted[i + 1];
    const parts: string[] = [];
    if (bp.minWidth > 0) parts.push(`(min-width: ${bp.minWidth}px)`);
    if (next) parts.push(`(max-width: ${next.minWidth - 0.02}px)`);
    return { bp, query: parts.length ? `@media ${parts.join(' and ')}` : '' };
  });
}

function responsiveCSS(input: NavCodeInput, conditions: Set<string>): string {
  const { definition, matrix, breakpoints } = input;
  const decl = definition.conditions || {};
  const out: string[] = [];

  // Width conditions: hidden in every range where they are false.
  for (const { bp, query } of ranges(breakpoints)) {
    const hide = [...conditions]
      .filter((c) => decl[c]?.trigger === 'device' && matrix[c] && matrix[c][bp.id] === false)
      .map((c) => `.an-root .${slug(c)}`);
    const rules: string[] = [];
    if (hide.length) rules.push(`${hide.join(',\n')} { display: none !important; }`);
    // Where the content stops growing inside a full-bleed band.
    rules.push(`.an-root { --an-content-max: ${bp.maxWidth ? bp.maxWidth + 'px' : 'none'}; --an-content-margin: ${bp.maxWidth && bp.align === 'center' ? 'auto' : '0'}; }`);
    out.push(`/* ${bp.label || bp.id}${bp.maxWidth ? `, content capped at ${bp.maxWidth}px` : ''} */`);
    out.push(query ? `${query} {\n${indent(rules.join('\n'), 2)}\n}` : rules.join('\n'));
  }

  // Scroll, session and interaction: state on the root, not a width.
  const state: string[] = [];
  if (conditions.has('Adaptive-Nav/Show-Condensed')) state.push(`.an-root:not([data-condensed]) .${slug('Adaptive-Nav/Show-Condensed')} { display: none !important; }`);
  if (conditions.has('Adaptive-Nav/Hide-When-Condensed')) state.push(`.an-root[data-condensed] .${slug('Adaptive-Nav/Hide-When-Condensed')} { display: none !important; }`);
  if (conditions.has(SIGNED_IN_CONDITION)) state.push(`.an-root:not([data-signed-in]) .${slug(SIGNED_IN_CONDITION)} { display: none !important; }`);
  if (conditions.has(SIGNED_OUT_CONDITION)) state.push(`.an-root[data-signed-in] .${slug(SIGNED_OUT_CONDITION)} { display: none !important; }`);
  if (conditions.has(ACCOUNT_MENU_CONDITION)) state.push(`.an-root:not([data-menu-open]) .${slug(ACCOUNT_MENU_CONDITION)} { display: none !important; }`);
  if (state.length) out.push('/* Scroll, session and the account menu: state on the root. */', ...state);

  // The page clears whatever the nav pins, per arrangement.
  const kids = definition.root.children || [];
  const insetFor = (name: string) => {
    const node = kids.find((k) => k.name === name);
    return node ? contentInsets({ ...definition, root: node }) : {};
  };
  const desk = insetFor('Desktop'); const mob = insetFor('Mobile');
  const padding = (i: ContentInsets) =>
    (['top', 'right', 'bottom', 'left'] as const).map((e) => i[e] || '0').join(' ');
  const mobileRanges = ranges(breakpoints).filter(({ bp }) => matrix[MOBILE_CONDITION]?.[bp.id]);
  out.push('/* The page starts clear of the pinned bars. */');
  out.push(`.an-page { padding: ${padding(desk)}; }`);
  for (const { query } of mobileRanges) {
    const rule = `.an-page { padding: ${padding(mob)}; }`;
    out.push(query ? `${query} { ${rule} }` : rule);
  }
  return out.join('\n');
}

/* ── slot content ───────────────────────────────────────────────────────── */

interface Ctx { input: NavCodeInput; icons: Set<string>; uses: Set<string> }

function deco(i: NavItem, end: 'start' | 'end', ctx: Ctx): string | null {
  const wantsAvatar = end === 'start' ? i.startAvatar : i.endAvatar;
  const wantsIcon = end === 'start' ? i.startIcon : i.endIcon;
  if (wantsAvatar) {
    ctx.uses.add('Avatar');
    return i.avatarType === 'initials'
      ? `<Avatar size="x-small" alt="" initials=${q(i.avatarInitials || '?')} />`
      : `<Avatar size="x-small" alt=""${i.avatarType === 'icon' ? ' defaultPhoto={false}' : ''} />`;
  }
  if (wantsIcon) {
    const n = iconName(end === 'start' ? i.startIconName : i.endIconName);
    ctx.icons.add(n);
    return `<${n}Icon fontSize="small" />`;
  }
  return null;
}

function tabsCode(ctx: Ctx, orientation?: string): string {
  const { tabs, componentSize } = ctx.input;
  ctx.uses.add('Tabs'); ctx.uses.add('TabList'); ctx.uses.add('Tab');
  const items = tabs.map((t) => {
    const s = deco(t, 'start', ctx); const e = deco(t, 'end', ctx);
    const attrs = [`value=${q(t.id)}`];
    if (!t.text) attrs.push('iconOnly', `aria-label=${q(t.label || 'Unnamed tab')}`);
    if (s) attrs.push(`startDecorator={${s}}`);
    if (e) attrs.push(`endDecorator={${e}}`);
    return `<Tab ${attrs.join(' ')}>${t.text ? t.label : ''}</Tab>`;
  });
  return [
    `<Tabs value={current} onChange={go} size=${q(componentSize)}${orientation ? ` orientation=${q(orientation)}` : ''}>`,
    '  <TabList>',
    ...items.map((x) => '    ' + x),
    '  </TabList>',
    '</Tabs>',
  ].join('\n');
}

function actionsCode(ctx: Ctx, which: Session): string {
  const { actions, componentSize } = ctx.input;
  ctx.uses.add('Button');
  const list = actions.filter((a) => sessionOf(a) === which);
  if (!list.length) return '';
  const btns = list.map((a) => {
    const s = deco(a, 'start', ctx); const e = deco(a, 'end', ctx);
    const attrs = [`variant=${q(buttonVariant(a.color, a.treatment))}`, `size=${q(componentSize)}`, `onClick={() => onAction?.(${q(a.id)})}`];
    if (!a.text) attrs.push('iconOnly', `aria-label=${q(a.label || 'Unnamed button')}`);
    return `<Button ${attrs.join(' ')}>${s ?? ''}${a.text ? a.label : ''}${e ?? ''}</Button>`;
  });
  return ['<div style={{ display: "flex", alignItems: "center", gap: "var(--Sizing-2)" }}>', ...btns.map((b) => '  ' + b), '</div>'].join('\n');
}

function slotCode(node: NodeDef, ctx: Ctx): string | null {
  const { input } = ctx;
  const size = q(input.componentSize);
  const menuOn = !!(input.options.avatarMenu || input.mobile.avatarMenu);
  switch (node.name) {
    case 'Tabs': return tabsCode(ctx);
    case 'Actions': return actionsCode(ctx, 'always') || null;
    case 'Signed-In-Actions': return actionsCode(ctx, 'signed-in') || null;
    case 'Signed-Out-Actions': return actionsCode(ctx, 'signed-out') || null;
    case 'Brand': return '{brand}';
    case 'Condensed-Brand': return '{mark ?? brand}';
    case 'Title': ctx.uses.add('Subtitle'); return '<Subtitle color="standard">{title}</Subtitle>';
    case 'Page': return '<div className="an-page" style={{ flex: 1, minWidth: 0 }}>{children}</div>';
    case 'Hero': ctx.uses.add('Ratio'); return '{hero ?? <Ratio ratio="16:9" fit="width" sx={{ width: "100%", maxHeight: "55vh", overflow: "hidden" }} />}';
    case 'Search': ctx.uses.add('SearchField'); return `<SearchField size=${size} placeholder="Search" />`;
    case 'Menu-Button':
      ctx.uses.add('Button'); ctx.icons.add('Menu');
      return `<Button iconOnly variant="ghost" size=${size} aria-label="Open navigation" onClick={() => setDrawerOpen(true)}><MenuIcon /></Button>`;
    case 'Avatar': {
      ctx.uses.add('Avatar');
      const px = ({ small: 16, medium: 20, large: 40 } as const)[input.componentSize];
      const face = `<Avatar size="custom" customSize={${px}} alt="" src={user?.avatarUrl} />`;
      if (!menuOn) return face;
      ctx.uses.add('Button');
      return `<Button avatar variant="ghost" size=${size} aria-label="Your account" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>${face}</Button>`;
    }
    case 'Account-Menu': {
      ctx.uses.add('MenuItem');
      const rows = input.accountItems.flatMap((i) => {
        const out: string[] = [];
        if (i.dividerBefore) { ctx.uses.add('MenuDivider'); out.push('<MenuDivider />'); }
        let icon = '';
        if (i.iconName) { const n = iconName(i.iconName); ctx.icons.add(n); icon = `<${n}Icon fontSize="small" />`; }
        out.push(`<MenuItem onClick={() => { setMenuOpen(false); onAccountAction?.(${q(i.id)}); }}><span style={{ display: "inline-flex", alignItems: "center", gap: "var(--Sizing-1)" }}>${icon}${i.label || 'Unnamed'}</span></MenuItem>`);
        return out;
      });
      return ['<div role="menu" style={{ display: "flex", flexDirection: "column", minWidth: 180 }}>', ...rows.map((r) => '  ' + r), '</div>'].join('\n');
    }
    case 'Rail-Items': {
      ctx.uses.add('Rail');
      return `<Rail items={TABS.map(toNavItem)} value={Math.max(0, TABS.findIndex((t) => t.id === current))} onChange={(i) => go(TABS[i].id)} size=${size}${input.options.railExpandable ? ' expandable' : ''} />`;
    }
    case 'Nav-Item-Slot': {
      ctx.uses.add('BottomNavigation');
      const m = input.mobile;
      let fab = 'undefined';
      if (m.fab) {
        ctx.icons.add('Add');
        const dial = m.fabSpeedDial
          ? `, actions: [${input.dialItems.map((d) => { const n = iconName(d.iconName, 'Add'); ctx.icons.add(n); return `{ key: ${q(d.id)}, label: ${q(d.label)}, icon: <${n}Icon />, onClick: () => onAction?.(${q(d.id)}) }`; }).join(', ')}]`
          : ', onClick: () => onAction?.("create")';
        fab = `{ icon: <AddIcon />, label: "Create"${dial} }`;
      }
      return `<BottomNavigation items={BAR_ITEMS.map(toNavItem)} value={Math.max(0, BAR_ITEMS.findIndex((t) => t.id === current))} onChange={(i) => go(BAR_ITEMS[i].id)} showLabels={${m.showLabels !== false}} variant=${q(m.barStyle === 'floating' ? 'floating' : 'fixed')} orientation=${q(m.toolbarOrientation === 'vertical' ? 'vertical' : 'horizontal')} fabAction={${fab}} fabPosition=${q(m.fabPosition ?? 'center')} fixed={false} />`;
    }
  }
  const action = node.name.match(/^Action-(\d)$/);
  if (action) {
    const k = Number(action[1]) - 1;
    const list = input.actions.filter((a) => sessionOf(a) === 'always');
    const a = list[k];
    const fallback = [['Search', 'Search'], ['Notifications', 'Notifications'], ['MoreVert', 'More']][k] || ['MoreVert', 'More'];
    const n = iconName(a ? (a.startIconName || a.endIconName) : undefined, fallback[0]);
    ctx.icons.add(n); ctx.uses.add('Button');
    return `<Button iconOnly variant="ghost" size=${size} aria-label=${q(a ? a.label : fallback[1])} onClick={() => onAction?.(${q(a ? a.id : fallback[0].toLowerCase())})}><${n}Icon /></Button>`;
  }
  return null;
}

/* ── the tree ───────────────────────────────────────────────────────────── */

function nodeCode(node: NodeDef, ctx: Ctx, parentDirection: 'row' | 'column', conditions: Set<string>): string {
  const style = nodeStyle(node, parentDirection);
  const classes: string[] = [];
  if (node.presence && node.presence !== 'always') {
    conditions.add(node.presence.when);
    classes.push(slug(node.presence.when));
  }
  const attrs: string[] = [];
  if (classes.length) attrs.push(`className=${q(classes.join(' '))}`);
  if (node.surface) attrs.push(`data-surface=${q(node.surface)}`);
  if (node.theme) attrs.push(`data-theme=${q(node.theme)}`);
  if (node.name === 'Hero-Area') attrs.push('ref={heroRef}');
  const open = (s: CSSProperties) => `<div ${[...attrs, `style={${styleLiteral(s)}}`].join(' ')}>`;

  if (node.kind === 'text') return `${open(style)}${node.text ?? ''}</div>`;

  if (node.kind === 'slot') {
    const content = slotCode(node, ctx);
    if (!content) return `${open(style)}</div>`;
    const w = slotStyles(node, style);
    return [open(w.outer), `  <div style={${styleLiteral(w.inner)}}>`, indent(content, 4), '  </div>', '</div>'].join('\n');
  }

  const dir: 'row' | 'column' = node.direction === 'column' ? 'column' : 'row';
  const kids = (node.children || []).map((c) => nodeCode(c, ctx, dir, conditions));
  if (node.band) {
    const inner: CSSProperties = {
      display: 'flex', flexDirection: style.flexDirection, justifyContent: style.justifyContent,
      alignItems: style.alignItems, gap: style.gap, width: '100%',
      maxWidth: 'var(--an-content-max)', marginLeft: 'var(--an-content-margin)', marginRight: 'var(--an-content-margin)',
    };
    return [open(style), `  <div style={${styleLiteral(inner)}}>`, ...kids.map((k) => indent(k, 4)), '  </div>', '</div>'].join('\n');
  }
  return [open(style), ...kids.map((k) => indent(k, 2)), '</div>'].join('\n');
}

/* ── the file ───────────────────────────────────────────────────────────── */

export function navCode(input: NavCodeInput): string {
  // Subtitle always: it is the default `brand` until a logo is passed.
  const ctx: Ctx = { input, icons: new Set(), uses: new Set(['Subtitle']) };
  const conditions = new Set<string>();
  const tree = nodeCode(input.definition.root, ctx, 'column', conditions);
  const css = responsiveCSS(input, conditions);

  const usesMenuButton = tree.includes('setDrawerOpen');
  const usesMenu = conditions.has(ACCOUNT_MENU_CONDITION);
  const usesCondensed = conditions.has('Adaptive-Nav/Show-Condensed') || conditions.has('Adaptive-Nav/Hide-When-Condensed');
  if (usesMenuButton) { ctx.uses.add('Drawer'); tabsCode(ctx, 'vertical-left'); }

  // Item data, so the file reads as content rather than markup.
  const tabData = input.tabs.map((t) => `  { id: ${q(t.id)}, label: ${q(t.label)}, icon: ${q(iconName(t.startIconName || t.endIconName))} },`);
  const barItems = bottomBarItems(input.tabs, input.mobile.itemCount ?? 4,
    (n) => ({ id: `item-${n}`, label: `Item ${n}`, text: true } as NavItem));
  const barData = barItems.map((t) => `  { id: ${q(t.id)}, label: ${q(t.label)}, icon: ${q(iconName(t.startIconName || t.endIconName))} },`);
  [...input.tabs, ...barItems].forEach((t) => ctx.icons.add(iconName(t.startIconName || t.endIconName)));

  const icons = [...ctx.icons].sort();
  const lib = [...ctx.uses].sort();
  const iconMap = `const ICONS = { ${icons.map((n) => `${n}: ${n}Icon`).join(', ')} };`;

  return `/**
 * AdaptiveNav — generated by Omni Design (Adaptive Nav add-on).
 *
 * One nav for every width: ${input.breakpoints.map((b) => `${b.id} ≥${b.minWidth}`).join(', ')}.
 * Which parts show at each width is the CSS below (from the studio's table);
 * scroll, sign-in and the account menu are state on the root.
 *
 * Wrap your page in it: <AdaptiveNav brand={<Logo />} onNavigate={...}>{page}</AdaptiveNav>
 * It renders inside your OmniDesignProvider and draws in your design system.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ${lib.join(', ')} } from '@omni-design/components';
${icons.map((n) => `import ${n}Icon from '@mui/icons-material/${n}';`).join('\n')}

${iconMap}
const TABS = [
${tabData.join('\n')}
];
const BAR_ITEMS = [
${barData.join('\n')}
];
const toNavItem = (t) => { const I = ICONS[t.icon]; return { icon: I ? <I /> : null, label: t.label }; };

const CSS = \`
${css.replace(/`/g, '\\`')}
\`;

export default function AdaptiveNav({
  children,
  brand = <Subtitle>Brand</Subtitle>,
  mark,
  title = 'Page title',
  hero,
  value,
  defaultValue = TABS[0]?.id,
  onNavigate,
  onAction,
  onAccountAction,
  signedIn = true,
  user,
}) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const go = (id) => { setInternal(id); onNavigate?.(id); setDrawerOpen(false); };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const heroRef = useRef(null);
  const rootRef = useRef(null);
${usesCondensed ? `
  /* Condensed once the hero has scrolled past: brand and actions move into
     the sticky strip. A scroll position — no media query can see it. */
  useEffect(() => {
    const onScroll = () => {
      const r = heroRef.current?.getBoundingClientRect();
      setCondensed(!!r && r.bottom <= 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
` : ''}${usesMenu ? `
  /* The account menu closes on Escape and on a click outside it. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    const onDown = (e) => { if (rootRef.current && !rootRef.current.querySelector('[aria-haspopup="menu"]')?.contains(e.target) && !e.target.closest?.('[role="menu"]')) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [menuOpen]);
` : ''}
  return (
    <>
      <style>{CSS}</style>
      <div
        ref={rootRef}
        className="an-root"
        data-condensed={condensed || undefined}
        data-signed-in={signedIn || undefined}
        data-menu-open={menuOpen || undefined}
        style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      >
${indent(tree, 8)}
      </div>${usesMenuButton ? `
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} anchor="left" size="small">
${indent(tabsCode(ctx, 'vertical-left'), 8)}
      </Drawer>` : ''}
    </>
  );
}
`;
}
