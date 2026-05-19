# Writing a `.tailwind-override.css`

An override file teaches the converter to output **project design token references** instead of hardcoded values. Without one, the converter resolves every Tailwind token to a concrete value (e.g. `oklch(54.6% 0.245 262.881)`). With one, those values become `var(--color-primary-600)` — live references that respond to themes and CSS custom property updates at runtime.

---

## How it works

The converter performs two Tailwind builds:

1. **Default build** — no override file; extracts all `:root` custom properties and their Tailwind-default values.
2. **Override build** — same, but with your override file imported after `tailwindcss`. Extracts the same set of variables.

For every variable that differs between the two maps, the override value is treated as a **project token reference** and kept as a `var()` in the output. Variables that are identical in both maps are resolved to their concrete values and the `var()` wrapper is stripped.

This means your override file only needs to list the tokens you want to redirect — everything else is handled automatically.

---

## File structure

```css
/* 1. Import project token files so their variables are in scope */
@import "./resources/css/tokens/colors.css";
@import "./resources/css/tokens/typography.css";
@import "./resources/css/tokens/spacing.css";

/* 2. Map Tailwind token names → project token names */
:root {
    --color-blue-600: var(--color-primary-600);
    --radius-lg:      var(--corner-lg);
    /* … */
}
```

Two rules:

- **Imports go first.** The `:root` block must be able to reference the project's variables.
- **The `:root` block is unlayered** (no `@layer` wrapper). This makes it win over both `@layer tailwind.theme` and any `@layer tokens` from your imports, so the override values are always the ones the converter sees.

---

## What to put in the imports

Import every token file that defines variables you will reference in the `:root` block. Exclude files that:

- Use non-standard syntax (e.g. `@custom-media`) — these may cause the Tailwind build to error.
- Define only JavaScript-side or build-time constants (not CSS custom properties).

You do **not** need to import the files for tokens you are *not* overriding.

---

## Categories of mappings

### Colors

Tailwind v4 defines colors as `--color-{hue}-{shade}` (e.g. `--color-blue-600`). Map entire hue families to the closest semantic scale in your project.

```css
/* Blue, indigo, violet → primary scale */
--color-blue-400: var(--color-primary-400);
--color-blue-500: var(--color-primary-500);
--color-blue-600: var(--color-primary-600);
/* repeat for -100 through -950 as needed */

/* Gray, zinc, slate → neutral/text tokens */
--color-gray-50:  var(--color-bg-secondary);
--color-gray-100: var(--color-surface);
--color-gray-400: var(--color-text-disabled);
--color-gray-700: var(--color-text);
/* repeat for other gray-family hues */

/* Status colors: map whichever Tailwind hues encode that meaning */
--color-green-500:   var(--color-success);
--color-red-500:     var(--color-error);
--color-yellow-500:  var(--color-warning);

/* White / black */
--color-white: var(--color-surface-raised);
--color-black: var(--color-text);
```

**Tips:**

- Multiple Tailwind hue families often map to the same project scale (e.g. blue + indigo + violet all → primary). Duplicate the block for each hue family.
- For shades your project doesn't have, map to the closest shade above or below rather than leaving them out. Unmapped shades fall through to concrete `oklch(…)` values which won't respond to theme switches.
- Tailwind's `-50` is almost always a near-white background tint; map it to your lightest background or surface token.
- Tailwind's `-950` is almost always near-black; map it to your darkest text or background token.

### Border radius

Tailwind defines `--radius-{size}`. Map to your project's corner radius scale:

```css
--radius-xs:   var(--corner-xs);
--radius-sm:   var(--corner-sm);
--radius-md:   var(--corner-md);
--radius-lg:   var(--corner-md);   /* collapse if your scale has fewer steps */
--radius-xl:   var(--corner-lg);
--radius-2xl:  var(--corner-lg);
--radius-full: var(--corner-full);
```

### Shadows / elevation

Tailwind defines `--shadow-{size}`. Map to your project's elevation tokens:

```css
--shadow-sm:  var(--elevation-1);
--shadow-md:  var(--elevation-1);
--shadow-lg:  var(--elevation-2);
--shadow-xl:  var(--elevation-2);
--shadow-2xl: var(--elevation-2);
```

Collapse multiple Tailwind steps onto the same project token if your elevation scale is coarser.

### Font sizes

Tailwind defines `--text-{size}` (xs → 9xl). Map to your project's font-size scale. Cap anything above the largest step at the largest step.

```css
--text-xs:   var(--font-size-xxs);   /* 0.75rem */
--text-sm:   var(--font-size-xs);    /* 0.875rem */
--text-base: var(--font-size-sm);    /* 1rem */
--text-lg:   var(--font-size-base);  /* 1.125rem */
--text-xl:   var(--font-size-lg);    /* 1.25rem */
--text-2xl:  var(--font-size-xl);    /* 1.5rem */
--text-3xl:  var(--font-size-xl);    /* 1.875rem — cap starts */
--text-4xl:  var(--font-size-2xl);
--text-5xl:  var(--font-size-2xl);
--text-6xl:  var(--font-size-2xl);
--text-7xl:  var(--font-size-2xl);
--text-8xl:  var(--font-size-2xl);
--text-9xl:  var(--font-size-2xl);
```

Match by closest pixel size. When two project steps are equidistant, prefer the larger one for display sizes and the smaller one for body sizes.

### Line heights

Tailwind pairs each text size with a `--text-{size}--line-height` token. Map these to your project's line-height scale using a numeric threshold:

| Tailwind ratio | Closest project step |
|---|---|
| < 1.35 | tight |
| 1.35 – 1.65 | normal |
| > 1.65 | loose |

```css
--text-xs--line-height:   var(--line-height-tight);   /* ≈1.33 */
--text-sm--line-height:   var(--line-height-normal);  /* ≈1.43 */
--text-base--line-height: var(--line-height-normal);  /* 1.5 */
--text-lg--line-height:   var(--line-height-normal);  /* ≈1.56 */
--text-xl--line-height:   var(--line-height-normal);  /* 1.4 */
--text-2xl--line-height:  var(--line-height-tight);   /* ≈1.33 */
--text-3xl--line-height:  var(--line-height-tight);   /* 1.2 */
--text-4xl--line-height:  var(--line-height-tight);
/* 5xl–9xl: all tight */
```

### Font family

Tailwind defines `--font-sans`, `--font-serif`, `--font-mono`. Map any that the project has an equivalent for:

```css
/* Primary sans-serif → project base font */
--font-sans: var(--font-family-base);

/* If your project has a distinct serif or mono font: */
--font-serif: var(--font-family-serif);
--font-mono:  var(--font-family-mono);
```

Families with no project equivalent do **not** need a mapping. The converter's fallback logic will automatically extract the concrete font stack from Tailwind's built-in `var(--font-serif, ui-serif, Georgia, …)` and output it directly.

---

## What you do NOT need to override

Two token categories are handled by PostCSS plugins rather than the override file:

| Category | How it is handled |
|---|---|
| **Spacing** (`padding`, `margin`) | `spacing-tokens` plugin wraps `calc(0.25rem * N)` with `var(--space-N, …)` automatically. |
| **Font weight** | `font-weight-tokens` plugin wraps numeric values (100–900) with `var(--font-weight-{name}, …)` automatically. |

These plugins run after token resolution, so their output is always concrete-value fallbacks with optional project token references. No override entries needed.

---

## Tokens with the same name in Tailwind and your project

If a Tailwind token name matches a project token name exactly (e.g. both define `--font-weight-normal`), add a self-referential mapping:

```css
--font-weight-normal: var(--font-weight-normal);
```

This signals to the converter that the token is project-controlled. The output will contain `var(--font-weight-normal)` rather than the resolved concrete value `400`, so it continues to respond to any overrides the project applies at runtime.

> This is only valid for the converter's offline build step. The self-reference is never evaluated by a browser — by the time the generated CSS runs in the project, the variable is resolved through the project's own token definitions.

---

## What happens to unmapped tokens

Any Tailwind token not present in your override file is automatically resolved to its **concrete default value** (e.g. `oklch(54.6% 0.245 262.881)`). The output will be a hardcoded value with no `var()` wrapper.

This is intentional for one-off utility values (opacity, specific numeric sizes, etc.) but undesirable for anything that should respond to themes (colors, typography, spacing). Review your output and add overrides wherever you see raw `oklch(…)` or `calc(…)` values that should be live tokens.

---

## Quick-start template

```css
/* .tailwind-override.css
   Place next to your tailwind.config or at the project root.
   The converter walks up from the file being converted and uses the first one found. */

/* ── Project token imports ──────────────────────────────────────────────── */
@import "./resources/css/tokens/colors.css";
@import "./resources/css/tokens/typography.css";
@import "./resources/css/tokens/spacing.css";
@import "./resources/css/tokens/radius.css";
@import "./resources/css/tokens/shadows.css";

:root {
    /* ── Colors: primary hue family ─────────────────────────────────────── */
    --color-blue-100: var(--color-primary-100);
    --color-blue-500: var(--color-primary-500);
    --color-blue-600: var(--color-primary-600);
    --color-blue-700: var(--color-primary-700);
    /* add other shades and hue aliases as needed */

    /* ── Colors: neutrals ───────────────────────────────────────────────── */
    --color-gray-50:  var(--color-bg-secondary);
    --color-gray-100: var(--color-surface);
    --color-gray-200: var(--color-border);
    --color-gray-500: var(--color-text-muted);
    --color-gray-700: var(--color-text);
    /* duplicate block for zinc, slate, stone, neutral if used */

    /* ── Colors: status ─────────────────────────────────────────────────── */
    --color-green-500:  var(--color-success);
    --color-red-500:    var(--color-error);
    --color-yellow-500: var(--color-warning);

    /* ── Colors: white / black ──────────────────────────────────────────── */
    --color-white: var(--color-surface-raised);
    --color-black: var(--color-text);

    /* ── Border radius ──────────────────────────────────────────────────── */
    --radius-sm:   var(--corner-sm);
    --radius-md:   var(--corner-md);
    --radius-lg:   var(--corner-md);
    --radius-xl:   var(--corner-lg);
    --radius-full: var(--corner-full);

    /* ── Shadows ────────────────────────────────────────────────────────── */
    --shadow-sm: var(--elevation-1);
    --shadow-md: var(--elevation-1);
    --shadow-lg: var(--elevation-2);

    /* ── Font sizes ─────────────────────────────────────────────────────── */
    --text-xs:   var(--font-size-xxs);
    --text-sm:   var(--font-size-xs);
    --text-base: var(--font-size-sm);
    --text-lg:   var(--font-size-base);
    --text-xl:   var(--font-size-lg);
    --text-2xl:  var(--font-size-xl);
    --text-3xl:  var(--font-size-xl);
    --text-4xl:  var(--font-size-2xl);
    --text-5xl:  var(--font-size-2xl);
    --text-6xl:  var(--font-size-2xl);
    --text-7xl:  var(--font-size-2xl);
    --text-8xl:  var(--font-size-2xl);
    --text-9xl:  var(--font-size-2xl);

    /* ── Line heights ───────────────────────────────────────────────────── */
    --text-xs--line-height:   var(--line-height-tight);
    --text-sm--line-height:   var(--line-height-normal);
    --text-base--line-height: var(--line-height-normal);
    --text-lg--line-height:   var(--line-height-normal);
    --text-xl--line-height:   var(--line-height-normal);
    --text-2xl--line-height:  var(--line-height-tight);
    --text-3xl--line-height:  var(--line-height-tight);
    --text-4xl--line-height:  var(--line-height-tight);
    --text-5xl--line-height:  var(--line-height-tight);
    --text-6xl--line-height:  var(--line-height-tight);
    --text-7xl--line-height:  var(--line-height-tight);
    --text-8xl--line-height:  var(--line-height-tight);
    --text-9xl--line-height:  var(--line-height-tight);

    /* ── Font family ────────────────────────────────────────────────────── */
    --font-sans: var(--font-family-base);
}
```
