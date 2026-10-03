/**
 * The facts that are not about any one component.
 *
 * Same test as the component docs: every line has to change what an agent
 * writes. That kept five sections and cut the raw tone ramp — an agent uses
 * semantic names, and Color-1..Color-12 across nine palettes is generator
 * internals, volume without decisions.
 *
 * The first section exists because the system does the opposite of what every
 * other one does, and an agent will assume otherwise without being told.
 */

export interface FoundationSection {
  title: string;
  /** One line on why this matters, before any detail. */
  lede: string;
  body: string[];
  table?: { head: string[]; rows: string[][] };
  /** The mistake this section prevents. */
  trap?: string;
}

export const FOUNDATIONS: FoundationSection[] = [
  {
    title: 'Platforms, not breakpoints',
    lede: 'There are no media queries in this system. Not one.',
    body: [
      'Responsive behaviour comes from a `data-device` attribute on the root element, not from viewport width. Set it and every metric changes at once — the type ramp, button heights, icon sizes, touch targets, bar heights.',
      'The reason is that these are not width decisions. A 28px Android button and a 44px iOS one are the two vendors\' published minimums, not two points on a curve; a media query would have to invent a width at which one becomes the other.',
    ],
    table: {
      head: ['Attribute', 'Covers'],
      rows: [
        ['`[data-device="Desktop"]`', 'desktop, and the default'],
        ['`[data-device="IOS-Mobile"]`', 'iPhone'],
        ['`[data-device="IOS-Tablet"]`', 'iPad, both orientations'],
        ['`[data-device="Android-Tablet"]`', 'Android tablet, both orientations'],
        ['`[data-device="Android-Mobile"]`', 'Android phone'],
      ],
    },
    trap: 'Do not write `@media (min-width: …)` against these tokens. A breakpoint cannot change them — they are attribute-scoped — so the rule will appear to do nothing, and adding your own values fights the attribute rather than extending it.',
  },

  {
    title: 'Surfaces',
    lede: 'Ten levels, and `data-theme` + `data-surface` is how you paint anything.',
    body: [
      'Setting both attributes exposes a whole matched set — `--Background`, `--Text`, `--Quiet`, `--Header`, `--Border`, `--Border-Variant`, `--Hover`, `--Pressed`, `--Hotlink` — all tuned for that surface\'s tone.',
      'Writing `background: var(--Surface)` paints the box and leaves the text, borders and states on the PARENT\'s tone. It looks right until the surface flips dark or moves a level, and then the contrast breaks with nothing to point at.',
      'Use `<Section theme="Primary" surface="Surface">` where you want the attributes AND the paint; `<ThemedZone>` where you want the attributes only, because something inside paints itself.',
    ],
    table: {
      head: ['Group', 'Levels'],
      rows: [
        ['Surface', '`Surface` · `Surface-Dim` · `Surface-Dimmest` · `Surface-Bright` · `Surface-Brightest`'],
        ['Container', '`Container` · `Container-Low` · `Container-Lowest` · `Container-High` · `Container-Highest`'],
      ],
    },
    trap: 'Never `background: var(--Surface)` or `var(--Container)`. Those exist so the system can COMPUTE `--Background`; components read `--Background`, which is what `data-surface` resolves to.',
  },

  {
    title: 'Static and dynamic typography',
    lede: 'Two type systems, and which one applies depends on the platform.',
    body: [
      'STATIC type is the brand\'s own ramp: one set of sizes, generated from the type scale, used on Desktop. Its line heights come out of the generated block and are already a clean ramp — `max(size × 1.15, size + 8)` holds exactly for H1 through H5 without anyone having written that rule down.',
      'DYNAMIC type is the platform\'s. On iOS the sizes and line heights come from Apple\'s Dynamic Type table; on Android from Material 3. These are published tables, not curves, so they are transcribed rather than derived — running a brand ratio over them produces numbers neither vendor specifies.',
      'Line height on the mobile platforms is COMPUTED from the platform table rather than read from the stylesheet. The static mobile blocks set every heading solid at 1.0, which clips in Figma — a text box IS its line height and a descender has nowhere to go — and carried two values that could not be right at all.',
      'Desktop is deliberately left alone: its block is generated rather than static and is already correct. Running the platform curve over it would have loosened Legal to 1.80 and Label-ExtraSmall to 1.73, because the `+8` was fitted to the middle of the range where the platforms add 2–5px at the bottom.',
    ],
    trap: 'Do not "fix" a mobile line height by editing the static block. On iOS and Android it is derived from the platform table at generate time and your value will be replaced — which is the point, because it is what stops the two impossible numbers recurring.',
  },

  {
    title: 'Spacing',
    lede: 'One scale, in 8px steps with two fractions below it.',
    body: [
      'Everything that is a gap or a padding comes from here. A radius does NOT: a corner is a different axis, and binding one to a spacing token welds two independent things together — which is exactly what happened to the list row, whose radius and padding were both `Sizing-1` and could not move apart.',
      'The 24px minimum touch target is `--Sizing-3`, not a control-specific token. It already exists on this scale, and a second name for one number is how two numbers appear.',
    ],
    table: {
      head: ['Token', 'px', 'Typical use'],
      rows: [
        ['`--Sizing-Quarter`', '2', 'hairlines, the tab indicator track'],
        ['`--Sizing-Half`', '4', 'tight internal gaps'],
        ['`--Sizing-1`', '8', 'the default gap and row padding'],
        ['`--Sizing-1-and-Half`', '12', 'a row\'s internal gap'],
        ['`--Sizing-2`', '16', 'card padding'],
        ['`--Sizing-3`', '24', '**the minimum touch target** (WCAG 2.5.8)'],
        ['`--Sizing-4` … `--Sizing-12`', '32 … 96', 'section and layout spacing'],
      ],
    },
    trap: 'If you are reaching for a spacing token to set a radius, stop. Radii have their own tokens per component — `--Card-Radius`, `--Button-Radius`, `--List-Item-Radius` — and they derive from the brand\'s corner setting, not from the spacing scale.',
  },

  {
    title: 'Elevation',
    lede: 'Five levels, and a component\'s level is a property of the component.',
    body: [
      'A shadow\'s alpha is FLAT per level — `alpha = TOTAL[level] / N` — so raising the resolution of a shadow redistributes its opacity without changing it. A slider cannot make a shadow heavier; elevation lives in the total and the geometry.',
      'A bevel and a drop shadow are different things. A bevel lights the component\'s OWN surface and follows its theme; a drop shadow falls on the PAGE and must read the page\'s theme. That is why a themed component puts its theme on an inner `Theme-*` layer and leaves the shadow on an outer node that inherits.',
    ],
    table: {
      head: ['Component', 'Rest', 'Hover'],
      rows: [
        ['Button, outlined Card', '0', '1'],
        ['Handle, Accordion', '1', '—'],
        ['Card, Bottom Sheet', '1', '2'],
        ['AppBar, Toolbar, Menu', '2', '—'],
        ['FAB', '3', '4'],
        ['Dialog, Modal', '5', '—'],
      ],
    },
    trap: 'A button is flat at rest and earns its shadow by being hovered. A Dialog is already at the top of the stack and cannot be raised — `elevated` on one does nothing.',
  },

  {
    title: 'The Alt Display',
    lede: 'A decorative display face with a gradient, and every brand gets one.',
    body: [
      'The gradient comes in two kinds, and the palette decides which — not whether. Denying the treatment to the roughly half of brands whose Primary and Secondary sit far apart on the wheel would make it a lottery.',
      '**duo** — Header-Primary to Header-Secondary, when the two hues are near enough to blend.',
      '**mono** — Header-Primary to a lighter or darker shade of ITSELF, chosen against the background. One hue, so it cannot collide.',
      'A brand whose palette cannot be read at all lands on `mono`, because that is the treatment that needs only one hue to be known. A grey Secondary counts as maximally distant rather than as zero — a grey blended into a colored Primary looks like a rendering fault, and zero would be the one answer that turns the gradient on.',
      'Solid Header-Secondary is the sibling VARIANT, not the failure case: a designer picks between them. Two values are fine when something selects between them, and here the selector is a person.',
      'Its WEIGHT is a contrast with Display\'s, in whichever direction has room — a drop alone cannot work at both ends, because a Display already at 600 has nowhere light to go without becoming thin at Alt-Display-Small.',
    ],
    trap: 'The gradient is not a brand choice to override with two colors of your own. It is derived from the palette, and hand-picking the stops produces a pair nothing guarantees is legible against the background.',
  },

  {
    title: 'States are generated, not chosen',
    lede: 'Hover, pressed, focus and disabled are computed to stay accessible.',
    body: [
      'Every clickable thing needs all four. They come from curated per-surface tables tuned to WCAG rather than from a formula applied blindly, so they are accessible by construction — a hover tone is picked to move AWAY from the text sitting on it, not by stepping an index.',
      'Direction is decided by the LABEL, not by the tone number. The index is a proxy that assumes every palette\'s text flips at tone 6, and the one palette where it does not took a 4.54:1 button to 2.17:1.',
      'A narrow pass is a pass. Do not pad a value that already meets its threshold.',
    ],
    trap: 'Never invent a hover or focus color. Links in particular have NO hover tone — the underline thickens instead — and any value you supply would be unverified against a 4.5:1 requirement.',
  },
];

export function renderFoundations(): string {
  const out: string[] = ['# Foundations', ''];
  for (const s of FOUNDATIONS) {
    out.push(`## ${s.title}`, '', `*${s.lede}*`, '');
    out.push(...s.body.map(b => b + '\n'));
    if (s.table) {
      out.push(`| ${s.table.head.join(' | ')} |`);
      out.push(`| ${s.table.head.map(() => '---').join(' | ')} |`);
      out.push(...s.table.rows.map(r => `| ${r.join(' | ')} |`));
      out.push('');
    }
    if (s.trap) out.push(`> **Trap.** ${s.trap}`, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
