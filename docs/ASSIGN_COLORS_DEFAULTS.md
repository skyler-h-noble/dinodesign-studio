# Assign Colors — Default Mapping Logic

This document shows how DynoDesign auto-assigns color selections when a user enters the Assign Colors stage, based on the mood board's surface style and the primary color's lightness.

---

## Inputs

| Input | Source | Values |
|-------|--------|--------|
| **Surface Style** | Detected from mood board image | `light-tonal`, `grey-professional`, `dark-professional` |
| **PC (Primary Color)** | `toneToColorNumber(extractedTones.primary)` | 1–14 |
| **Scheme Type** | Selected in Color Stage | `monochromatic`, `analogous`, `complementary`, etc. |

### PC Ranges

| Range | Label | Meaning |
|-------|-------|---------|
| PC >= 11 | Light Primary | Very light brand color (pastels) |
| PC 7–10 | Medium Primary | Mid-range brand color (typical) |
| PC < 7 | Dark Primary | Dark/rich brand color |

---

## Dark Professional Mood Board

Detected when: average image lightness < 40%

| Setting | Value | Notes |
|---------|-------|-------|
| Default Theme | `dark` | |
| Background | `black` | Neutral Color-2 |
| Background Theme | Neutral | |
| App Bar | `black` | Matches background |
| Nav Bar | `black` | Matches background |
| Status Bar | `black` | Matches background |
| Buttons | `primary` | |
| Text Coloring | `tonal` | Dark mode forces tonal |
| Card Coloring | `tonal` | Dark mode forces tonal |

---

## Grey Professional Mood Board

Detected when: average lightness 40–70%, low chroma

| Setting | Value | Notes |
|---------|-------|-------|
| Default Theme | `light` | |
| Background | `white` | Neutral Color-14 |
| Background Theme | Neutral | |
| App Bar | `white` | Clean, corporate |
| Nav Bar | `white` | Clean, corporate |
| Status Bar | `white` | Clean, corporate |
| Buttons | `primary` | |
| Text Coloring | `black-white` | Maximum contrast, professional |
| Card Coloring | `white` | Clean separation |

---

## Light Tonal Mood Board

Detected when: average lightness > 70%, chroma > 20

### Light Primary (PC >= 11)

Primary is very light (pastels) — safe to use as background.

| Setting | Value | Notes |
|---------|-------|-------|
| Default Theme | `light` | |
| Background | `primary-light` | Primary Color-12, lightly tinted |
| Background Theme | Primary | |
| App Bar | `primary-light` | Cohesive with background |
| Nav Bar | `white` | Clean bottom |
| Status Bar | `primary-light` | Cohesive with app bar |
| Buttons | `primary` | |
| Text Coloring | `tonal` | Light primary is subtle enough |
| Card Coloring | `tonal` | |

### Medium Primary (PC 7–10) — Monochromatic Scheme

Primary has good weight, monochromatic = use primary throughout.

| Setting | Value | Notes |
|---------|-------|-------|
| Default Theme | `light` | |
| Background | `primary-light` | Primary Color-13 |
| Background Theme | Primary | |
| App Bar | `primary` | Strong primary accent |
| Nav Bar | `primary-light` | Lighter version |
| Status Bar | `primary` | Matches app bar |
| Buttons | `primary` | |
| Text Coloring | `tonal` | |
| Card Coloring | `tonal` | |

### Medium Primary (PC 7–10) — Multi-Color Scheme

Multiple colors need room to breathe — white background.

| Setting | Value | Notes |
|---------|-------|-------|
| Default Theme | `light` | |
| Background | `white` | Neutral Color-14 |
| Background Theme | Neutral | |
| App Bar | `primary` | Color accent in nav |
| Nav Bar | `white` | Clean bottom |
| Status Bar | `primary` | Matches app bar |
| Buttons | `laddered` | P/S/T hierarchy |
| Text Coloring | `tonal` | |
| Card Coloring | `tonal` | |

### Dark Primary (PC < 7) — Monochromatic Scheme

Primary is dark — can't use as light background, use for nav accent.

| Setting | Value | Notes |
|---------|-------|-------|
| Default Theme | `light` | |
| Background | `white` | Neutral Color-14 |
| Background Theme | Neutral | |
| App Bar | `primary` | Dark primary as nav accent |
| Nav Bar | `primary` | Full primary nav |
| Status Bar | `primary` | Matches app bar |
| Buttons | `primary` | |
| Text Coloring | `black-white` | Dark tonal is hard to read on white |
| Card Coloring | `white` | |

### Dark Primary (PC < 7) — Multi-Color Scheme

Same as monochromatic but with laddered buttons and lighter nav.

| Setting | Value | Notes |
|---------|-------|-------|
| Default Theme | `light` | |
| Background | `white` | Neutral Color-14 |
| Background Theme | Neutral | |
| App Bar | `primary` | Dark accent |
| Nav Bar | `white` | Clean bottom |
| Status Bar | `primary` | Matches app bar |
| Buttons | `laddered` | P/S/T hierarchy |
| Text Coloring | `black-white` | Dark tonal hard to read |
| Card Coloring | `white` | |

---

## Summary Matrix

| Surface Style | PC Range | Scheme | BG | App Bar | Nav Bar | Status | Buttons | Text | Cards |
|--------------|----------|--------|-----|---------|---------|--------|---------|------|-------|
| dark-pro | any | any | black | black | black | black | primary | tonal | tonal |
| grey-pro | any | any | white | white | white | white | primary | BW | white |
| light-tonal | >= 11 | any | primary-light | primary-light | white | primary-light | primary | tonal | tonal |
| light-tonal | 7–10 | mono | primary-light | primary | primary-light | primary | primary | tonal | tonal |
| light-tonal | 7–10 | multi | white | primary | white | primary | laddered | tonal | tonal |
| light-tonal | < 7 | mono | white | primary | primary | primary | primary | BW | white |
| light-tonal | < 7 | multi | white | primary | white | primary | laddered | BW | white |

---

## Source Code

**File:** `src/utils/autoAssignColors.ts`

**Called from:** `App.tsx` → `goNext()` when entering the `color-assignment` stage for the first time.

---

*Generated for DynoDesign v3*
