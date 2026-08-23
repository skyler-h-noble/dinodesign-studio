// Browser-side wrapper for the Figma frame → JSX conversion. Sends a
// structured prompt to the Anthropic API with the lib's component catalog
// and conversion rules; receives JSX back. The API key lives in browser
// localStorage — acceptable for the admin-only dev tool, NOT for end-user
// distribution. Phase 2 moves this call to a Cloud Function.

/** Lib catalog + conversion rules. This is the "AAID" document referenced
 *  in the patent (claims 62–72) — keep it in sync with CLAUDE.md. */
const LIB_CATALOG = `
@dynodesign/components — exported component names with their semantic role:

LAYOUT:
  - <VStack gap={token|number}> — vertical flex with gap; gap accepts CSS
    string (e.g. "var(--Sizing-1)") or number (MUI 8 × scale).
  - <HStack gap={token|number}> — horizontal flex with gap.
  - <Box surface="Container" elevation={0-5}> — bare container: NO radius, NO
    padding, inherits theme from parent. 'surface' defaults to Container for a
    plain box; 'elevation' (1-5) adds a layered shadow via an outer wrapper that
    adopts the parent surface's dropshadow color. NEVER give a Box a radius or
    data-theme by default. (See rules 4h/4i.)
  - <Grid>, <Container>, <Stack>, <Spacing>, <Divider>.

SURFACES:
  - <Card padding="small|medium|large">
  - <Section theme="..." surface="..."> — paints a region's background; use
    for hero/footer/full sections that paint their own color.
  - <SelectableCard>, <Paper>, <Surfaced>, <ThemedZone>.

TYPOGRAPHY (each has an optional color prop: quiet|primary|secondary|...):
  - <DisplayLarge>, <DisplaySmall>
  - <H1>, <H2>, <H3>, <H4>, <H5>, <H6>
  - <Body>, <BodyLarge>, <BodySmall>
  - <Subtitle>, <SubtitleLarge>
  - <Label>, <Overline>, <OverlineSmall>, <Caption>

CONTROLS:
  - <Button variant="primary|secondary|tertiary|...|-outline|-light|ghost|text">
  - <ButtonGroup>, <Fab>
  - <Checkbox>, <Radio>, <RadioGroup>, <SwitchInput>, <Slider>, <Rating>
  - <TextField>, <TextInput>, <EmailTextField>, <PasswordTextField>,
    <NumberField>, <SearchField>, <TextArea>, <Autocomplete>, <Select>

NAVIGATION + DISCLOSURE:
  - <Tabs>, <Tab>, <TabList>, <TabPanel>, <Breadcrumbs>, <Pagination>,
    <Stepper>, <BottomNavigation>, <AppBar>, <Sidebar>
  - <Accordion>, <Drawer>, <Modal>, <Dialog>, <Tooltip>, <Popover>

FEEDBACK:
  - <Alert>, <Snackbar>, <CircularProgress>, <LinearProgress>, <Badge>

DATA:
  - <Chip>, <Avatar size="..."> (bare = default photo; initials="JD" | defaultPhoto={false} for icon | src="real-url"), <AvatarGroup>,
    <Table>, <List>, <Skeleton>
  - <Ratio ratio="1:1|3:4|4:3|16:9|9:16|2:3|3:2|5:4|4:5|Golden-Horizontal|..."
       fit="width|height" placeholder?>
    Aspect-ratio container. Use for ANY fixed-ratio media slot, image
    placeholder, video thumb, hero image, or square tile. NEVER inline
    a <Box> with hardcoded width/height when the Figma layer name is
    "Ratio" or implies a fixed aspect ratio — use <Ratio> instead.
    Supports variant / color / padding props matching <Box>.

    VARIANT MAPPING (from _aaid.variant — use the PER-INSTANCE value, never a
    blanket default):
      - "Property 1" holds the ASPECT RATIO → emit ratio="<that value>"
        (e.g. _aaid.variant["Property 1"]="3:4" → ratio="3:4"). Each Ratio in a
        set can differ — do NOT make them all 1:1.
      - FILL DIRECTION — read it from _aaid.component (the RESOLVED component /
        component-set name). The node's own layer name is usually just "Ratio"
        and does NOT carry the direction — use _aaid.component:
            _aaid.component contains "Fill Horizontal" → <Ratio fit="width"  …/>
            _aaid.component contains "Fill Vertical"   → <Ratio fit="height" …/>
        Figma splits these into two components, but BOTH map to the SAME single
        <Ratio> — only the fit prop differs; never emit two code components.
        (Fallback if no _aaid.component: a "Fill" variant property — Horizontal
        → fit="width", Vertical → fit="height".)
      - "Image Placeholder" true → placeholder (see IMAGE PLACEHOLDER below).

    SIZING: fit="width" (default) fills the parent's width, height from the
    ratio; fit="height" fills the parent's height, width from the ratio (for
    fixed-height rows). A built-in min floor keeps it from collapsing. Do NOT
    pass maxWidth or hardcoded width/height — let the parent (a hugging <Box>,
    a column, a grid cell) drive the size.

    SLOT (holds anything): <Ratio> has a content slot — pass ANY content as
    children and a single child fills the box:
        <Ratio ratio="1:1"><img src="…" alt="…" /></Ratio>
        <Ratio ratio="16:9"><Avatar … /></Ratio>
    If the Figma layer wraps the Ratio's content in a "Content Slot" frame,
    COLLAPSE it — put the slot's content directly inside <Ratio>, do NOT emit a
    separate wrapper element for the slot.

    IMAGE PLACEHOLDER: the Figma Ratio exposes a BOOLEAN variant property named
    "Image Placeholder". When it is true — i.e. _aaid.variant["Image Placeholder"]
    is "true" (or the node otherwise shows Image Placeholder = True) — emit
        <Ratio placeholder />
    and do NOT recreate its internals (the photo-icon frame). The component
    renders the built-in photo-icon placeholder itself (no <img>, no broken
    src). Likewise emit <Ratio placeholder /> for any image slot whose source
    isn't a usable URL (e.g. a Figma imageRef hash). Only pass an <img> child
    when you have a REAL image URL. A plain <Ratio ratio="1:1" /> with the
    boolean false is just a blank tile.
  - <ListItem
       startDecorator={<Avatar/Ratio/Icon />}
       endDecorator={<Checkbox/Button/Icon />}
       overline="Optional 1st row of text (OverlineSmall by default)"
       secondary="Optional 3rd row of text (Body by default)"
       size="small|medium|large"
       variant="default|solid|light"
       color?
       clickable?           // upgrades visual to card chrome (border + shadow + radius + padding)
       bottomBorder?        // non-clickable only: hairline below — divides rows in a vertical list
       rightBorder?         // non-clickable only: hairline to the right — divides items in a horizontal list
       selected?
       selectionMode="none|checkbox|radio"
     >
       2nd row of text (children — SubtitleLarge by default)
     </ListItem>

    The canonical list-row pattern with start slot, three-layer text frame
    (overline / title / secondary), and end slot. Top-aligned by default,
    proper sizing on slots, configurable interaction.

    NEVER hand-roll a list row with <HStack alignItems="flex-start" gap=...>
    + manual VStack of typography. Always use <ListItem>. The three text
    layers are PROPS, not children:
      overline    → maps to OverlineSmall (top kicker)
      children    → maps to SubtitleLarge (title) — pass as JSX children
      secondary   → maps to Body (description)
  - <Link>
`;

const TOKEN_CATALOG = `
SPACING / SIZING (CSS variables):
  Positive: --Sizing-Quarter (2px), --Sizing-Half (4px), --Sizing-1 (8px),
    --Sizing-1-and-Half (12px), --Sizing-2 (16px), --Sizing-2-and-Half (20px),
    --Sizing-3..--Sizing-16 (24..128px), --Sizing-20 (160px), --Sizing-30 (240px).
  Negative: --Sizing-Negative-Quarter through --Sizing-Negative-2.

BACKGROUNDS (always set via data-attributes, NEVER inline color):
  - data-theme: "Brand", "Brand-App-Bar", "Brand-Nav-Bar", "Primary-Light",
    "Primary", "Tertiary", "Default", and palette-by-name themes.
  - data-surface: "Surface", "Surface-Dim", "Surface-Bright",
    "Container", "Container-High", "Container-Low", "Container-Highest",
    "Container-Lowest".
  A region that paints a background sets BOTH data-theme + data-surface and
  the cascade does the rest. To paint a Container-tinted region inside an
  already-themed parent, set only data-surface.

COLORS (never inline hex; never set style={color/background} on lib
components — use variant and color props instead):
  - Typography: pass color prop ("quiet", "primary", "secondary",
    "tertiary", "success", "warning", "error") instead of style.color.
  - Buttons: variant prop covers color (primary, secondary-outline, etc.).
`;

const CONVERSION_RULES = `
CONVERSION RULES:

0. RESOLVED NOTES (_aaid) — SOURCE OF TRUTH. USE OVER ANY GUESS.

   A node MAY carry an "_aaid" object, written by the OmniDesign plugin's
   Export-to-Code step, holding the design's ACTUAL resolved settings:
       _aaid: {
         modes:    { Theme: "Primary", Surface: "Container", Effects: "Level-2" },
         sizingH:  "FIXED" | "HUG" | "FILL",
         sizingV:  "FIXED" | "HUG" | "FILL",
         layout:   { mode, gap, padTop, padRight, padBottom, padLeft,
                     primaryAxis, counterAxis, primarySizing, counterSizing },
         variant:  { Level: "Level 2", ... },   // instance variant props
         component:"Ratio - Fill Vertical",     // resolved component/set name
         boundVars:{ fills: "Background", ... }
       }
   When _aaid is present it OVERRIDES every heuristic in the rules below:
     - modes.Theme    → data-theme="<Theme>". ABSENT means the frame sets NO theme
       → it is the DEFAULT theme → OMIT data-theme entirely (inherit). Absent does
       NOT mean "guess one from the fill". If modes.Theme is not present, you MUST
       NOT emit data-theme="Primary-Light" (or any theme) — the frame is Default.
     - modes.Surface  → data-surface="<Surface>". ABSENT → Surface (the default) →
       OMIT (or data-surface="Surface"). Never guess a Container/other surface.
     - elevation: take the design's level (variant.Level "Level N", or
       modes.Effects "Level-N") and map the FLAT/no-shadow level to elevation={0},
       each step up +1 (so a 1-based "Level 1" flat → elevation={0}; "Level 6"
       → elevation={5}). See rule 4i.
     - sizingH/sizingV: FIXED → width/height in px (from the bounding box);
       HUG → omit (size to content); FILL → fill the axis. See rule 2d — this
       applies to EVERY node, including list rows and media slots.
     - layout → auto-layout: gap, padding, and axis alignment per rule 2a.
   NEVER guess theme/surface from fill color when _aaid.modes exists. The
   fill-color heuristic (rule 3a) is ONLY a fallback for nodes that have NO
   _aaid. Only emit attributes for axes _aaid explicitly lists (Auto is omitted).

0b. VISIBILITY & BOOLEAN PROPERTIES — hidden means NOT rendered (applies to
    EVERY component, every node). Two signals, both authoritative:

    1. node.visible === false  OR  _aaid.visible === false → the layer is HIDDEN
       in the design. Either flag is authoritative (the plugin stamps
       _aaid.visible:false on hidden nodes; the raw node.visible says the same).
       Do NOT emit it at all — no element, and do NOT fold its text into a
       sibling's prop. The CONVERSE is just as binding: a node WITHOUT either
       hidden flag, that has characters, IS shown and MUST be emitted — even if a
       sibling row hid the same line (see rule 4d's per-row algorithm).
    2. Boolean component properties in _aaid.variant carry a real boolean
       (true / false), e.g. {"Show Title": false, "2nd Row": false,
       "Image Placeholder": true}. A FALSE boolean means that part is hidden;
       a TRUE boolean means it is shown. Respect the value literally. The boolean
       and the controlled layer's _aaid.visible agree — a TRUE "2nd Row" means
       that text node is visible and its line MUST be emitted.

    A boolean named like Show/Hide/Display/Has/With/Enable/<slot> + a row/slot/
    icon/decorator controls that element's presence. When it resolves to hidden,
    OMIT the corresponding element or prop entirely — never render a placeholder
    for it and never duplicate visible text to fill the gap.

    CONCRETE (the List case): a ListItem whose 2nd row (title) and 3rd row
    (secondary) booleans are false shows ONLY the overline. Emit just
    overline="…" — do NOT pass children (title) or secondary, and do NOT repeat
    the overline text as the title. Passing a hidden row is the bug that makes
    one label render twice.

0c. READ EVERY VARIANT OF EVERY COMPONENT INSTANCE — this is the whole game.
    For ANY node that is a component instance (_aaid.component is set), read the
    ENTIRE _aaid.variant object and map EVERY property to the lib equivalent —
    not just the one or two you happen to notice. A variant the designer set is
    a fact, not a suggestion; reflect ALL of them:
      - Size      → size="small|medium|large" (Checkbox/Avatar/Button/etc.).
                    e.g. Checkbox Size="Medium" → size="medium" (the lib default,
                    so omit; but if it says Small/Large, emit it). NEVER guess size.
      - Color/Variant → variant/color prop (Button, Checkbox, Divider, Tag…).
      - Type/Content → the content variant (Avatar Photo/Icon/Initials, etc.).
      - State        → checked/selected/disabled/etc. ONLY if the instance is in
                       that state.
      - Booleans     → show/hide per rule 0b.
    If you emit a component and leave a prop at its default while the instance's
    variant says otherwise, that is a bug. Enumerate _aaid.variant and translate
    each key. (The lib's own per-row typography, padding, etc. are handled by the
    component — your job is to pass the instance's variant props faithfully.)

1. Outermost frame for Mobile / Tab / Web → <Container>.
   Outermost frame for a component → <Card> or <Section> as appropriate.

1a. CARD vs BOX — a frame is a <Card> ONLY if the design explicitly marks it
    as one. NEVER infer "Card" from rounded-corners + shadow.
    - It is a <Card> ONLY when _aaid.component is/contains "Card" (the instance
      is the Card component). Then use <Card> and let it carry its chrome; pass
      surface/theme/elevated from _aaid (surface="Surface" if the card sits on
      the surface, not a container).
    - EVERY OTHER container frame — even one with a corner radius, a drop shadow,
      a fill, padding — is a <Box> (see rule 4h). Do NOT force it into a <Card>:
      <Card> injects its own padding, radius, Container surface and Level-2
      shadow, which overrides the frame's real spec. Instead, apply the frame's
      ACTUAL specified properties to the <Box>: modes (theme/surface), elevation
      (level), padding, gap, border-radius, borders — all from _aaid. This is
      also what makes --Header/--Text resolve correctly: a <Box surface="Surface">
      heading uses the Surface tone (e.g. #256247), not the Container tone.

2. For any frame with auto-layout:
   - vertical → <VStack gap={...}>
   - horizontal → <HStack gap={...}>
   - gap → the EXACT gap from _aaid.layout.gap. Use a Sizing token ONLY when it
     matches EXACTLY (--Sizing-1=8px, --Sizing-1-and-Half=12px, --Sizing-2=16px,
     --Sizing-Half=4px). Do NOT snap to the "nearest" token — if the value
     doesn't match a token exactly, emit the literal px (e.g. gap=10 → gap="10px",
     NOT var(--Sizing-1)). Same rule for padding. Preserve the designer's value.

2a. AXIS ALIGNMENT — map the two Figma axes to the CORRECT flex property.
   For a VERTICAL stack (VStack): the PRIMARY axis is vertical, the COUNTER
   axis is horizontal. So:
     - primaryAxisAlignItems  → justifyContent  (MIN→flex-start, CENTER→center, MAX→flex-end, SPACE_BETWEEN→space-between)
     - counterAxisAlignItems  → alignItems      (MIN→flex-start, CENTER→center, MAX→flex-end, STRETCH→stretch)
   COUNTER-AXIS STRETCH = equal cross-axis size. A HORIZONTAL row (HStack) with
   counterAxisAlignItems=STRETCH means all children are the SAME HEIGHT →
   emit alignItems="stretch". (For a VStack, STRETCH = same width.) HStack
   defaults to center, so you MUST emit alignItems="stretch" when Figma says so —
   omitting it leaves children center-aligned at different heights.
   For a HORIZONTAL stack (HStack) the two are swapped.
   COMMON MISTAKE: putting a primary-axis CENTER onto alignItems. A vertical
   frame with primaryAxisAlignItems=CENTER means justifyContent:"center", NOT
   alignItems:"center". Only set alignItems:"center" when the COUNTER axis is
   CENTER. Pass these via the style prop (they are layout, not appearance).

2b. CHILD FILL — a child whose Figma sizing is "Fill container" on an axis must
   FILL that axis, not hug. For the cross axis of a stack this means the child
   stretches (the stack's default alignItems is "stretch" — do NOT override it
   with "center" when children fill). A <Box>/<Ratio>/<List> child that fills the
   stack's width therefore needs NO width style — a block child fills the
   cross axis by default. Setting alignItems:"center" would shrink it — don't,
   unless Figma's counter axis is explicitly CENTER.

   READ SIZING ON EVERY NODE. For each frame/child, check _aaid.sizingH/sizingV
   (FIXED → px per rule 2d; HUG → size to content; FILL → fill the axis). Do not
   default everything to hug. A <List> set to Fill width in Figma must span the
   parent — do NOT wrap it or center it; it already fills (width:100%) unless a
   parent alignItems:"center" shrinks it, so don't set that on the List's parent.
   Common miss: list rows look narrow because the parent stack was given
   alignItems:"center", collapsing the full-width List to its content width.

2c. ROOT FRAME SIZE — a root frame with a FIXED width emits that width on the
   root element (style={{ width: <px> }}); a HUG (auto) dimension is omitted
   (the element sizes to content). E.g. a 200px-wide, hug-height vertical frame:
       <VStack data-theme="..." gap="..." style={{ width: 200, padding: "var(--Sizing-2)" }}>
   width/height here are layout (allowed inline); never emit appearance inline.

2d. FIXED SIZE → INLINE PX (GENERAL RULE, applies to EVERY node, not just the root).
   For ANY node, on EACH axis independently, the Figma sizing decides what you emit:
     - _aaid.sizingH === "FIXED"  → set width  inline:  style={{ width:  <px> }}
     - _aaid.sizingV === "FIXED"  → set height inline:  style={{ height: <px> }}
     - "HUG"  → emit NOTHING for that axis (the element sizes to its content).
     - "FILL" → fill that axis (cross axis: let it stretch per 2b; main axis: flexGrow:1).
   The <px> value is the node's ACTUAL pixel size — read it from
   node.absoluteBoundingBox.width / .height (fall back to node.size.x/.y, then
   node.width/.height). Round to an integer. Emit a bare number (width: 80), not
   a string — these are layout, allowed inline; never put appearance inline.
   This is WHY a fixed-height list row works: the row carries style={{ height: <px> }},
   which gives a fill-vertical <Ratio fit="height"> inside it a definite height
   to fill. A row left at HUG has no height for the thumbnail to resolve against.
   When both axes are FIXED, set both (e.g. an 80×80 media slot → style={{ width: 80, height: 80 }}).
   _aaid.sizing* is the SOURCE OF TRUTH for which axes are fixed; the px comes
   from the bounding box. Never invent a size for a HUG/FILL axis.

3. For any layer that paints a background:
   - Set data-theme + data-surface (NEVER inline color).
   - If the layer is just a tonally-tinted container inside an already-themed
     ancestor, set only data-surface.

3a. ROOT-FRAME THEME — FALLBACK ONLY (no _aaid). This rule fires ONLY when the
   frame has NO _aaid at all (a fixture / un-stamped file). If _aaid is present,
   IGNORE this rule entirely and use _aaid.modes per rule 0 — an absent
   modes.Theme means Default (omit data-theme); do NOT fill-guess "Primary-Light".

   If the OUTERMOST Figma frame has a fill that is NOT pure white, the
   output JSX root element MUST carry BOTH data-theme + data-surface —
   WHATEVER that root element is: <Card>, <Container>, OR a layout
   <VStack>/<HStack>. This is the most-missed case: when the root is a
   VStack/HStack, the data-theme still belongs on it. If the Figma frame's
   data-theme is known (e.g. "Primary"), use it verbatim:
       <VStack data-theme="Primary" data-surface="Surface" gap="...">…</VStack>
   The data-theme tells the cascade WHICH brand palette to paint from;
   data-surface tells it which tone. Skipping it leaves the region painted
   from the parent context (often a neutral workbench) and the brand look is
   lost. (VStack/HStack/Box all paint var(--Background) from their surface, so
   the attributes alone produce the background — never add inline color.)

   How to choose data-theme from a Figma fill:
   - Mint / pale green / soft teal fills           → data-theme="Primary-Light"
   - Cream / pale pink / soft warm fills           → data-theme="Tertiary"
   - Pale blue / lavender / cool fills             → data-theme="Secondary-Light"
   - Near-white off-white with hint of brand hue   → data-theme="Primary-Light"
                                                      data-surface="Surface-Bright"
   - White                                          → no data-theme needed
   - Dark fills                                     → data-theme="<Palette>" data-surface="Surface"

   WRONG (loses the mint brand background):
     <Card padding="medium">...</Card>

   RIGHT:
     <Card padding="medium" data-theme="Primary-Light" data-surface="Surface">...</Card>

3b. ANY frame with a background fill MUST map to a PAINTING container.

   <VStack>, <HStack>, <Box>, <Section>, and <Card> all paint var(--Background)
   from their surface, so a backgrounded frame must become one of them (with
   the right data-theme/data-surface) — NEVER a bare <div>. If a frame has a
   background but maps to plain layout, use <VStack>/<HStack> (they now paint).
   Do not drop the background and do not inline it; the painting component +
   data-surface produce it.

4. NEVER set background, background-color, color, borderColor, or any
   color-related CSS property in inline style. The data-theme + data-surface
   attributes do the work — adding inline color is redundant AND often
   uses fabricated token names. This rule is absolute:

   WRONG:
     <Box style={{ background: "var(--color-surface-container)" }} data-surface="Container" />
     <Box style={{ backgroundColor: "var(--Surface)" }} />

   RIGHT:
     <Box data-surface="Container" />
     <Box data-theme="Primary" data-surface="Surface" />

   To change a lib component's appearance, use its variant/color/size
   props. If no prop covers what's needed, that's a lib gap — flag it
   in a comment.

4a. DON'T ADD APPEARANCE TO LIB COMPONENTS — they style themselves.

   This is absolute. NEVER add inline background, color, border, border-radius,
   or box-shadow to a lib component. Appearance comes from the component and its
   props (surface / variant / elevation / size), NEVER from inline style. A
   plain <Box> has NO radius and NO background of its own — do not add them.
   <Card>/<Button>/<Input> already carry their own radius — do not re-declare it.

   - SPACING / DIMENSIONS / GAP:  --Sizing-Quarter … --Sizing-30 (layout only)
   - BACKGROUNDS:                 the 'surface' prop / data-surface — never inline
   - RADIUS:                      a component concern; <Box> has none, surfaces
                                  like <Card> own theirs — never set it inline
   - SHADOW / ELEVATION:          the 'elevation' prop — never inline boxShadow
   - TEXT COLOR:                  the typography 'color' prop — never inline

   The ONLY inline style that belongs on a lib component is layout/sizing
   (width, height, flex, margin) — never appearance.

   WRONG (adding appearance the component owns):
     <Box style={{ borderRadius: "var(--Card-Radius)", background: "..." }} />
     <Card style={{ borderRadius: 12, boxShadow: "..." }} />

   RIGHT (the component + props do it):
     <Box surface="Container" elevation={2} style={{ width: 80, height: 80 }} />
     <Card padding="medium">…</Card>

4b. NEVER invent token names. The only allowed tokens are the ones
    listed in the SPACING / BACKGROUNDS / etc. sections above. If you
    catch yourself writing a CSS variable name not in this prompt — STOP.
    That's a hallucination. Use only documented tokens.

    WRONG: --color-surface-container, --color-text, --surface-tint
    RIGHT: --Container, --Text, --Surface, --Border, --Sizing-2, etc.

4c. LITERAL FIGMA NODE NAMES MAP DIRECTLY TO LIB COMPONENTS.

    When a Figma layer is named exactly like a lib typography token or
    component variant, use the LIB COMPONENT WITH THE EXACT SAME NAME.
    Do not "interpret" or downgrade it to a smaller/larger size.

    Examples (Figma node "type" or layer name → lib component):
      "Display-Large", "Display Large"       → <DisplayLarge>
      "Display-Small", "Display Small"       → <DisplaySmall>
      "H1", "H2", "H3", "H4", "H5", "H6"     → <H1>, <H2>, ... <H6>
      "Subtitle", "Subtitle-Large"           → <Subtitle>, <SubtitleLarge>
      "Body-Large", "Body", "Body-Medium"    → <BodyLarge>, <Body>
      "Body-Small"                            → <BodySmall>
      "Overline-Small", "Overline"            → <OverlineSmall>, <Overline>
      "Label", "Caption"                      → <Label>, <Caption>
      "Divider"                               → <Divider> (see DIVIDER COLOR below)
      "Avatar"                                → <Avatar size="small|medium|large">
      "Ratio"                                 → <Ratio ratio="1:1">  (NEVER <Box>)
      "Checkbox"                              → <Checkbox>

    WRONG (downgraded Display-Small → Subtitle):
      // Figma: "Typography type=Display-Small" with Caveat 42px
      <Subtitle>Title</Subtitle>

    RIGHT:
      <DisplaySmall>Title</DisplaySmall>

    The whole point of named Figma styles is to map 1:1 to component
    names. Do not second-guess the designer's choice.

4d. LIST ROWS — use <List> + <ListItem>, never inline HStacks.

    When the Figma source contains a "List" instance with rows containing
    "Beginning Slot" / "Text" / "End Slot" (or any 3-region row pattern),
    the output MUST use <List> + <ListItem>. The text frame's three layers
    (Overline / Title / Body) become PROPS, not nested JSX:

      <List>
        <ListItem
          startDecorator={<Ratio ratio="1:1" placeholder style={{ width: 48, height: 48 }} />}
          endDecorator={<Checkbox variant="default" />}
          overline="Overline Small"
          secondary="Body Medium supporting text"
        >
          Subtitle Large title
        </ListItem>
        {/* ...more <ListItem> rows */}
      </List>

    ROW SIZE — READ THE ROW'S FIXED HEIGHT/WIDTH (rule 2d applies to the row too).
    A <ListItem> is NOT exempt from rule 2d. Check the ROW node's own
    _aaid.sizingV / _aaid.sizingH:
      - sizingV === "FIXED" → pass the row's fixed height to the ListItem:
          <ListItem style={{ height: <px> }} … >   (px from the row's bounding box)
      - sizingH === "FIXED" → likewise style={{ width: <px> }}.
      - HUG → omit that axis (let the row size to content); FILL → omit (the row
        fills its parent's width as normal).
    Do NOT let a ListItem hug to content when Figma pins the row height — a row
    fixed at 78px in Figma must render at EXACTLY 78px, not 79. ListItem is
    box-sizing:border-box, so the inline height is honored to the pixel (its
    bottomBorder sits inside the height). The classic miss: emitting the row with
    no height so it hugs to 79 while Figma says 78. style={{ height/width }} is
    layout, so it is the ONE allowed inline style on the ListItem.

    A Ratio used as a ListItem startDecorator (a row thumbnail) MUST be given an
    EXPLICIT fixed size — style={{ width: N, height: N }} — read from the
    thumbnail node's bounding box (per rule 2d). Do NOT use fit="height" here:
    a lib <ListItem> row has no definite height, so fit="height" collapses to
    its 24px floor and the thumbnail nearly vanishes. Do NOT use fit="width"
    either — it expands to the full row width and collapses the text into a
    one-letter-per-line column. A fixed square (e.g. 48×48) is correct. If the
    Figma thumbnail's size is unknown, default to 48×48.

    EMIT EVERY VISIBLE ROW. Rule 0b hides only rows that are visible:false /
    boolean-off. The CONVERSE is equally required: a row whose 2nd/3rd text line
    IS visible MUST be emitted. A person row with a name AND a role (e.g.
    children="Jane Dow" secondary="VP of Marketing") shows BOTH — never drop the
    secondary just because the start decorator is an Avatar. Only the rows that
    are actually hidden in Figma get omitted.

    PER-ROW ALGORITHM — RUN THIS SEPARATELY FOR EVERY <ListItem>. Do NOT
    generalize across rows. The props of a row are decided ONLY by the rendered
    text nodes inside THAT row's own subtree — never by the row above, never by
    the decorator type, never by "the list looks uniform".

      1. In this row's "Text" frame, find the Typography children that are
         RENDERED. A child is rendered when ALL hold:
           • neither 'visible' nor '_aaid.visible' is false, AND
           • it has non-empty 'characters', AND
           • if it is an instance, its controlling boolean in _aaid.variant is
             not false (a true / on / shown boolean MEANS render it).
         Look ONLY at this row's subtree — ignore every other row.
      2. Map the rendered children IN ORDER and emit a prop for EACH:
           1st rendered (Overline Small) → overline=
           2nd rendered (Subtitle Large) → children   (the title)
           3rd rendered (Body Medium)    → secondary=
         Omit only the props whose child is NOT rendered.
      3. The start decorator (Avatar vs Ratio) has ZERO bearing on which text
         rows show. An Avatar / person row commonly has 2–3 rendered lines
         (name + role). If this row's subtree contains a visible 2nd/3rd text
         node with characters, you MUST emit children / secondary for it — EVEN
         IF every row above it had that line off. Toggling a boolean ON in Figma
         (e.g. "2nd Row" = true) sets that text node visible:true in this row's
         subtree; treat that as a hard requirement to emit the prop.

    The #1 recurring bug is dropping the avatar row's secondary because the rows
    above hid theirs. Before finishing, RE-CHECK each row that has an Avatar
    decorator: count the visible text nodes with characters in its subtree and
    confirm you emitted exactly that many props. A boolean turned ON that does
    not appear in the output is a FAILED conversion.

    NEVER hand-roll the row with <HStack> + nested VStack of typography
    components. ListItem handles every layer's typography token internally
    (Overline → OverlineSmall, children → SubtitleLarge, secondary → Body),
    plus alignment, slot sizing, and accessibility.

4e. TYPOGRAPHY COLOR PROP — DEFAULT TO STANDARD TEXT.

    The typography components (<H1>...<H6>, <Body>, <Subtitle>,
    <SubtitleLarge>, <OverlineSmall>, <Caption>, etc.) accept an optional
    color prop. The available values are:

      quiet, standard, primary, secondary, tertiary, neutral,
      info, success, warning, error

    DO NOT use color="secondary", color="primary", or any branded color
    UNLESS the Figma fill on that text node EXACTLY MATCHES the brand's
    Secondary/Primary palette. In practice this is rare — most copy in
    a design just uses the default text color.

    HEADERS & DISPLAY — ALWAYS omit the color prop. <DisplayLarge>,
    <DisplaySmall> and <H1>–<H3> default to var(--Header); <H4>–<H6> default to
    var(--Text), because at those sizes the type sits inline with body copy and
    a second tone reads as an inconsistency rather than a level. Either way the
    component already resolves the right token.
    NEVER pass a color prop to a Header or Display (not "primary", not "header",
    not anything) — even if the Figma header fill looks like a brand color, it
    is the header token and the component already resolves it. Adding a color
    overrides the default and is wrong.

    RULES OF THUMB:
      - Display and H1–H3                        → NO color prop → var(--Header)
      - H4–H6                                    → NO color prop → var(--Text)
      - Standard body text, titles               → no color prop (omit it)
      - De-emphasized / muted / supporting       → color="quiet"
      - Errors / failures                        → color="error"
      - Success states                           → color="success"
      - Warning / pending                        → color="warning"
      - Hyperlinks (use <Link>, not text color)  → not a text color choice

    WRONG (introduces unwanted brand tint):
      <SubtitleLarge color="secondary">Item title</SubtitleLarge>

    RIGHT:
      <SubtitleLarge>Item title</SubtitleLarge>
      <Body color="quiet">Supporting text</Body>

4f. BUTTON VARIANT + COLOR — "default" is the default; NEVER emit "primary" unless asked.

    Your Figma Button is SIX components (Button, Button-Small, Button-Large, and
    their -Elevated forms) that all map to ONE code <Button>: the component NAME
    carries size + elevation, the rest are variant properties.

    FULL VARIANT MAP — translate EVERY axis (read _aaid.component for the name,
    _aaid.variant for the rest):
      - SIZE + ELEVATED (from the _aaid.component NAME, not a variant prop):
          "Button"          -> size default (omit)
          "Button-Small"    -> size="small"
          "Button-Large"    -> size="large"
          "...-Elevated"    -> add elevated  (e.g. "Button-Large-Elevated"
                               -> size="large" elevated)
      - TYPE (_aaid.variant "Type"):
          Text             -> nothing (the label is the children)
          Icon-Only        -> iconOnly
          Number or Letter -> letterNumber
          Avatar           -> avatar
      - STYLE x COLOR -> ONE combined variant string (there is NO separate color prop):
          Style=Default + Color=X -> variant="x"          (e.g. "primary", "default")
          Style=Outline + Color=X -> variant="x-outline"
          Style=Ghost (any Color) -> variant="ghost"      (ghost is COLOR-AGNOSTIC:
                                     there is no "x-ghost"; the Color is dropped)
          palette X in default|primary|secondary|tertiary|neutral|info|success|
          warning|error. Per the PALETTE rules below it is "default" UNLESS the
          variant explicitly names a Color.
      - STATE (_aaid.variant "State"):
          Default                        -> nothing
          Disabled                       -> disabled
          Hover / Pressed / Focus-Visible -> EMIT NOTHING. These are runtime CSS
                                     states the component renders itself
                                     (hover/active/focus-visible); never set them
                                     in code. Map ONLY Disabled.
      - SLOTS (left / right content):
          left slot  -> startDecorator  (an icon -> startIcon)
          right slot -> endDecorator    (an icon -> endIcon)
          An AVATAR slot -> startDecorator/endDecorator={<Avatar .../>} with the
          right content variant (photo = bare <Avatar/>, icon = defaultPhoto={false},
          initials = initials="JD"). Do NOT set the avatar's size or padding: the
          Button auto-sizes button-avatars per its size (small->16, medium->24,
          large->40) and adds the 2px side padding. Same for a Type=Avatar button.
          Only emit a slot that is actually visible (rule 0b).
      - HEIGHT: NEVER emit an inline height (or width) px on a Button -- it is the
        ONE exception to rule 2d. The brand sets button height per size via tokens
        (small floored at a 24x24 touch target); the size prop carries it. Width
        is hug vs fill per the SIZE paragraph below, never a fixed px.

    CRITICAL: "default" and "primary" are DIFFERENT palettes. variant="default"
    is the brand's standard button color (it may be green, blue, whatever the
    brand defines). variant="primary" is the brand's PRIMARY palette (often a
    salmon/coral/pink). They are NOT interchangeable. The brand CSS already
    paints "default" the correct color — you do NOT need to know what color that
    is, and you must NOT try to match the rendered fill color to a palette.

    PALETTE (the color family) — pick it in this order:
      1. If _aaid.variant names a Color/Variant (e.g. {"Color":"Primary"} or
         {"Color":"Success"}) → use THAT palette (primary / success / error / …).
         This is the ONLY way "primary" should ever be chosen.
      2. If _aaid.boundVars.fills names a semantic button token
         (e.g. "Buttons-Error-Button" → error) → use that palette.
      3. OTHERWISE → variant="default". A plain Figma button with no explicit
         color property is "default", full stop. Do NOT hue-match the rendered
         color, and do NOT fall back to "primary".

    Emitting "primary" for a button the designer did not mark primary is the
    single most common color error. When in doubt, it is "default".

    FILL STYLE (combines with the palette above):
      - Solid / filled background  → variant="<palette>"            (e.g. "default")
      - Outlined (border, no fill) → variant="<palette>-outline"
      - Tonal / light fill         → variant="<palette>-light"
      - NO fill AND no border (bare label only) → variant="text" or "ghost"

    variant="text" renders as a HOTLINK, not a button. NEVER use it for a
    button that has a visible fill or border — Only choose "text"/"ghost" when
    the Figma button truly has no background and no stroke.

    SIZE — a button whose Figma sizing HUGS its label (sizingH="HUG") must NOT
    stretch to fill a stack. Block children stretch in a VStack by default, so a
    hug button needs style={{ alignSelf: "flex-start" }} (or "center"/"flex-end"
    to match the Figma counter-axis alignment). Only let a button fill width when
    its Figma sizing is FILL.

    WRONG (no color specified, yet rendered as the primary/salmon palette + full-width):
      <Button variant="primary">Learn More</Button>

    RIGHT (Figma button has no explicit color → default palette, hugs its label):
      <Button variant="default" style={{ alignSelf: "flex-start" }}>Learn More</Button>

4f-2. SELECTION CONTROLS (Checkbox / Radio / Switch) — "default" unless marked otherwise.
    The lib <Checkbox> DEFAULTS to variant="primary" (the primary palette border),
    which is almost never what the design wants. A Figma checkbox with no explicit
    color must be emitted as variant="default" — do NOT leave it to the lib's
    primary default. Only use another palette when _aaid.variant explicitly names
    one (primary / success / …). An empty (unchecked) box is the default state —
    never pass checked unless the Figma instance is actually checked.

    SIZE — DEFAULT is medium; OMIT the size prop. Only emit size="small" or
    size="large" when the Figma instance's Size variant explicitly says so
    (_aaid.variant Size). Do NOT emit size="large" by default — that's a common
    error that makes every checkbox oversized. Same rule for Radio/Switch.
      WRONG (plain Figma checkbox rendered oversized / with the primary border):
        <Checkbox size="large" />     or     <Checkbox />
      RIGHT (medium is the default — no size prop):
        <Checkbox variant="default" />

4f-3. DIVIDER COLOR — read the Figma Divider's Color variant; do NOT default-drop it.
    The lib <Divider> takes a color prop. The DEFAULT (no prop) is
    var(--Border-Variant). Map the Figma divider's Color variant (_aaid.variant
    "Color") to the prop:
      - "Border-Variant" / none  → <Divider>                 (default, --Border-Variant)
      - "Border"                 → <Divider color="border">  (--Border)
      - "Primary"/"Secondary"/"Tertiary"/"Neutral"/"Info"/"Success"/"Warning"/"Error"
                                 → <Divider color="primary"> etc. (--Icons-<Color>)
    A Figma divider set to Color="Border" MUST emit color="border" — leaving it
    off wrongly falls back to --Border-Variant (the lighter line). Read the
    variant; only omit the prop when it's actually Border-Variant.

4f-4. BUTTONGROUP — controlled, and map the WIDTH (Fit) variant.
    Always controlled: pass value + onChange on the <ButtonGroup> and value= on
    each child <Button> (never set variant="default"/"outline" on the children —
    that double-borders). Map the Figma "Fit"/"Width" variant (_aaid.variant) to
    the fit prop:
      - "Hug" / none → <ButtonGroup>            (default; each button hugs its text)
      - "Fill"       → <ButtonGroup fit="fill">  (group fills its container, equal share)
      - "Equal"      → <ButtonGroup fit="equal"> (group hugs, every button = the widest)
    "Equal" is the one to watch: a Figma group whose buttons are visually the same
    width but the group is NOT full-width is fit="equal", NOT fit="fill" and NOT
    fixed px. Read the variant; don't infer from rendered widths.

4g. IMAGE FILLS ARE NOT URLs.

    A Figma image fill exposes an "imageRef" hash (e.g.
    "2be18dc0936bb13ae3381f72cdba038424f118be"). This is NOT a usable image
    URL — passing it as a src produces a broken image. NEVER put an imageRef
    in a src prop.

    - For <Avatar>: NEVER pass an imageRef as src. The Avatar has THREE variants,
      chosen from _aaid.variant (the instance's variant property, e.g. "Type"/
      "Content" = Photo | Icon | Initials). The DEFAULT avatar is the photo:
        • Photo    → <Avatar size="x-small" />               (bare = built-in
                      default photo; no src/imageRef/defaultPhoto needed)
        • Initials → <Avatar size="x-small" initials="JD" />  (pass the initials)
        • Icon     → <Avatar size="x-small" defaultPhoto={false} />   (a bare
                      avatar is the photo, so the icon variant turns the photo
                      OFF — it then shows the built-in Person icon, no icon
                      import needed)
      An avatar whose Figma fill is an image (imageRef) but with no real URL is
      the Photo variant → just <Avatar /> (bare). Use the Figma size (rule 2d /
      the size map). Only pass a real src prop when you have a genuine image URL
      (not an imageRef hash).
    - For a non-avatar image slot with no resolvable URL: emit <Ratio placeholder />
      — it renders the built-in photo-icon Image Holder. Do NOT emit an <img>
      with an imageRef. Only use a real <img> child when you have a true URL.

4h. CONTAINER FRAMES → <Box> that REFLECTS the frame's actual spec.

    Any container/grouping frame that is NOT an explicit Card (rule 1a) and NOT
    the root <Container> → <Box>. Apply EXACTLY what the frame specifies, read
    from _aaid — do not strip and do not invent:
      - MODES → theme + surface props from _aaid.modes (e.g.
        <Box surface="Surface">, or theme="Primary" only if modes.Theme says so).
        OMIT theme when it's Default/absent (inherit). surface drives --Header/
        --Text tone, so match it exactly (Surface vs Container matters).
      - LEVEL / SHADOW → elevation prop from the frame's shadow level (rule 4i,
        off-by-one). No shadow → omit.
      - PADDING → style padding from _aaid.layout (padTop/Right/Bottom/Left),
        as Sizing tokens where they match.
      - GAP / AUTO-LAYOUT → REQUIRED when the frame auto-layouts. Read the gap
        from _aaid.layout.gap and APPLY it — set display:flex + flexDirection
        (vertical→column / horizontal→row) + gap in style. NEVER drop the gap:
        use the exact value — a Sizing token if it matches (--Sizing-1=8px,
        --Sizing-1-and-Half=12px, --Sizing-2=16px…), otherwise the literal px
        (e.g. _aaid.layout.gap=10 → gap:"10px"). The frame's gap spaces its
        direct children; omitting it collapses them together.
      - BORDER-RADIUS → style borderRadius from the frame's corner radius: use
        the bound token if there is one (var(--Style-Border-Radius), etc.),
        else the literal px. A frame WITH a radius keeps it; one withOUT a
        radius stays square. (Earlier "Box never has radius" was wrong — that
        applied only to a square media SLOT, which is a <Ratio> anyway.)
      - BORDERS → style border from the frame's stroke (var(--Border) /
        var(--Border-Variant) / the named brand token).
      - NO inline background/color — the surface paints var(--Background).
      - SIZE → fixed / hug / fill per rule 2d.

    RIGHT (a rounded, elevated grouping frame on the Surface — NOT marked a Card):
      <Box surface="Surface" elevation={1}
        style={{ borderRadius: "var(--Style-Border-Radius)", padding: "var(--Sizing-2)",
                 display: "flex", flexDirection: "column", gap: "var(--Sizing-1)" }}>
        …
      </Box>

    RIGHT (a bare square media slot — no radius — usually a <Ratio>, not a Box):
      <Ratio ratio="1:1" placeholder />

4i. ELEVATION / DROP SHADOW → use the Box 'elevation' prop, never inline shadow.

    Set the Box's 'elevation' prop from the Figma effect LEVEL NUMBER (below),
    not from how the shadow looks:
      - NO shadow effect on the frame → elevation={0} (or omit the prop)
      - has an effect level N         → elevation={N}

    READ THE LEVEL FROM FIGMA — 1:1, NO off-by-one, NEVER guess. The elevation
    is the NUMBER in the frame's Effects mode / Level variant, read from
    _aaid.modes.Effects or _aaid.variant (e.g. "Level-5" or "Elevation-5"):
        Figma "Level-1" / "Elevation-1" → elevation={1}
        Figma "Level-5" / "Elevation-5" → elevation={5}
    Map the number straight through (Level-5 → elevation={5}, NOT 4). Only emit
    elevation={0} (or omit) when the frame has NO shadow effect at all. Do NOT
    infer a level from how the shadow looks — take the exact number Figma stamps.

    Do NOT add a borderRadius, a data-theme, a fixed size, or an inline
    boxShadow. The Box renders an outer wrapper that carries the layered
    shadow and adopts the PARENT surface's dropshadow color automatically:

      <Box surface="Container" elevation={2}>
        <Ratio ratio="1:1" />
      </Box>

    NEVER emit boxShadow / var(--Effect-Level-N) inline, NEVER put the shadow
    on the same element that sets the surface, and NEVER set elevation={1} for
    a layer that has no shadow (that is the most common mistake — match the
    Figma effect exactly, including "none" → 0).

5. OUTPUT FORMAT — STRICTLY plain JSX, NOT TypeScript.
   - DO NOT emit \`interface\`, \`type\`, or \`enum\` declarations.
   - DO NOT emit type annotations like \`: React.FC\`, \`: string\`, etc.
   - DO NOT emit generics like \`<Props>\` after function/component names.
   - DO NOT use \`React.FC<...>\` — just write \`const Component = (props) => ...\`.
   - DO NOT use TSX file syntax. Output should be valid in a .jsx file.
   - Component props are passed positionally in JS; no destructuring with
     type-annotated defaults.

6. For any layer that doesn't map to a lib component, output:
       // MISSING-LIB-COMPONENT: <ProposedName>
       // Needed for: <one-line use case>
       // Proposed API: <props sketch>
       // Lib-track: add to @dynodesign/components/src/components/<Name>/
     Then INLINE a minimal lib-component-only placeholder (using <Box>,
     <HStack>, <VStack>, etc.) so the page renders. NEVER reference the
     missing component name in the JSX — only mention it in the comment.

7. Output JUST the JSX file content — no markdown fences, no explanation.
   Include necessary imports from "@dynodesign/components" and React only.

7a. IMPORT EVERY COMPONENT YOU REFERENCE.

    Before you finalize the output, scan the JSX for every component name
    used (Container, Card, VStack, HStack, Box, Avatar, Body, Caption,
    Checkbox, Divider, List, every typography size, every form control,
    etc.). Every one of those names MUST appear in the import statement
    at the top of the file. Missing imports are a hard fail in a customer
    project even when they happen to work in a workbench preview.

    WRONG (Box used in JSX, missing from imports):
      import { Container, VStack, HStack, Avatar, Body, Caption, Checkbox,
        Divider, List } from "@dynodesign/components";
      ...
      <Box ... />

    RIGHT:
      import { Container, VStack, HStack, Box, Avatar, Body, Caption,
        Checkbox, Divider, List } from "@dynodesign/components";

8. List ALL MISSING-LIB-COMPONENT tags as a comment block at the top of
   the file so a future reviewer can see lib gaps at a glance.

9. Default-export the top-level component using:
       export default function ComponentName() { ... }
   so the workbench can find it.
`;

const SYSTEM_PROMPT = `You are a Figma-to-React converter for the OmniDesign component system. Given a Figma frame's JSON tree, produce a single React component file using only @dynodesign/components and design tokens.

${LIB_CATALOG}

${TOKEN_CATALOG}

${CONVERSION_RULES}

Output ONLY valid TypeScript/TSX file content — no commentary, no markdown fences.`;

export interface BrandMeta {
  designSystemName?: string;
  headerFontFamily?: string;
  componentStyle?: string;
  colors?: string[];
}

export interface ConvertResult {
  jsx: string;
  missingComponents: string[];
  rawResponse: string;
}

/** Walk the Figma node tree and lift each node's shared-plugin "aaid" note
 *  (written by the plugin's Export-to-Code step as a JSON string in
 *  sharedPluginData.dino.aaid) onto the node as a clean `_aaid` object the
 *  prompt can read directly. Removes the raw sharedPluginData to cut noise. */
function attachAaidNotes(node: any): void {
  if (!node || typeof node !== 'object') return;
  const shared = node.sharedPluginData;
  if (shared && shared.dino && typeof shared.dino.aaid === 'string') {
    try { node._aaid = JSON.parse(shared.dino.aaid); } catch { /* ignore malformed note */ }
  }
  if (node.sharedPluginData) delete node.sharedPluginData;
  if (Array.isArray(node.children)) {
    for (const child of node.children) attachAaidNotes(child);
  }
}

export async function convertFigmaToCode(
  frameJson: unknown,
  variables: Record<string, unknown>,
  anthropicApiKey: string,
  brand?: BrandMeta,
): Promise<ConvertResult> {
  // Lift the plugin's resolved-mode notes into a clean `_aaid` per node, so the
  // prompt uses real modes (theme/surface/effect/sizing) instead of guessing.
  try { attachAaidNotes(frameJson as any); } catch { /* noop */ }
  // Brand context block — included in the user message when a Design ID is
  // attached. Helps the AAID produce brand-appropriate code (e.g. choosing
  // a DisplayLarge vs DisplaySmall variant when the header font is a
  // script/handwritten face).
  const brandBlock = brand
    ? `BRAND CONTEXT (from Design ID):
- Design system name: ${brand.designSystemName ?? '(unset)'}
- Header font family: ${brand.headerFontFamily ?? '(unset)'}
- Component style: ${brand.componentStyle ?? '(unset)'}
- Core palette: ${brand.colors?.join(', ') ?? '(unset)'}

Generated code references universal token names; their values resolve at runtime against this brand's tokens-*.css. Use this context for variant/style choices only — do not bake brand values into the output.

`
    : '';

  const userMessage = `Convert this Figma frame to a OmniDesign component file:

${brandBlock}VARIABLES:
${JSON.stringify(variables, null, 2)}

FRAME:
${JSON.stringify(frameJson, null, 2)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text().catch(() => 'unknown')}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '';

  // Strip code fences in case the model wrapped output despite the
  // instruction not to.
  const jsx = text
    .replace(/^```(?:tsx|jsx|typescript|javascript)?\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();

  // Extract MISSING-LIB-COMPONENT names from the comment header.
  const missingComponents: string[] = [];
  const re = /\/\/\s*MISSING-LIB-COMPONENT:\s*(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(jsx)) !== null) {
    if (!missingComponents.includes(m[1])) missingComponents.push(m[1]);
  }

  return { jsx, missingComponents, rawResponse: text };
}
