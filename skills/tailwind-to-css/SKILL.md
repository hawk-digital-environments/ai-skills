---
name: tailwind-to-css
description: Convert Tailwind utility classes to vanilla CSS using the local converter. Use when asked to remove Tailwind, migrate classes to plain CSS, or generate CSS from Tailwind class lists.
---

Converts Tailwind v4 utility classes to vanilla CSS locally via `@tailwindcss/cli`. No external dependencies or network required. Node 18+ required.

## Workflow

1. Scan file for elements with Tailwind classes
2. Assign a semantic `className` per element (e.g. `card`, `card-title`)
3. Build the `classDefinitions` array and call the script
4. Write output CSS to the appropriate stylesheet
5. Replace `class="..."` attributes with the new single class name

## Finding an override file

If the user has not explicitly provided an override file, check whether a `.tailwind-override.css` exists anywhere in the project by running the finder script with the file being converted as the starting point. It walks up the directory tree and returns the first match:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/find-closest-override.mjs" /path/to/file/being/converted
# prints the absolute path, or nothing if not found
```

As a module:

```js
import {findClosestOverride} from

`${process.env.CLAUDE_SKILL_DIR}/scripts/find-closest-override.mjs`;
const overrideFile = findClosestOverride('/path/to/file/being/converted'); // string | null
```

If the script returns a path, pass it as the `overrideFile` argument to `tailwindToCss` or via `--override`. If nothing is returned, proceed without an override.

## Token resolution

The converter runs a two-pass PostCSS pipeline to eliminate all Tailwind tokens from the output:

**Pass 1 — var() resolution (`apply-var-map`)**

Runs two Tailwind theme builds (once without, once with the override file) and diffs the `:root` custom property maps:

- Token in override → kept as `var(--project-token)` reference
- Token not in override → resolved to concrete value (e.g. `oklch(...)`)
- `var(--name, fallback)` where `--name` is unknown → fallback is used, `var()` stripped
- `var(--name)` with no fallback and no map entry → kept as-is (intentional project token)

**Pass 2 — concrete value wrapping**

Two plugins run after all `var()` references are resolved:

| Plugin               | Transform                                                        |
|----------------------|------------------------------------------------------------------|
| `spacing-tokens`     | `calc(0.25rem * 4)` → `var(--space-4, calc(0.25rem * 4))`        |
| `font-weight-tokens` | `font-weight: 700` → `font-weight: var(--font-weight-bold, 700)` |

The passes are separate: if both ran together, `apply-var-map`'s fallback logic would strip the `var()` wrappers the second pass just added.

## Override file

To redirect Tailwind tokens to project design tokens, provide a `.tailwind-override.css`:

```css
@import "./resources/css/tokens/colors.css";

:root {
    --color-blue-600: var(--color-primary-600);
    --radius-lg: var(--corner-lg);
    --text-base: var(--font-size-sm);
}
```

For full instructions on writing an override file (color families, typography scale, line heights, font family, what not to include) see [`OVERRIDE-GUIDE.md`](OVERRIDE-GUIDE.md).

## Input format

```json
[
    {
        "className": "card",
        "classes": [
            "max-w-full",
            "p-6",
            "bg-white",
            "rounded-lg"
        ]
    },
    {
        "className": "title",
        "classes": [
            "mb-2",
            "text-2xl",
            "text-gray-900"
        ]
    }
]
```

- `className` → the generated CSS selector (`.card { … }`)
- `classes` → Tailwind utilities to expand

## CLI usage

```bash
# argument
node "${CLAUDE_SKILL_DIR}/scripts/convert.mjs" '[{"className":"card","classes":["p-6","bg-white"]}]'

# with token overrides
node "${CLAUDE_SKILL_DIR}/scripts/convert.mjs" '[...]' --override /path/to/overrides.css

# stdin
echo '[...]' | node "${CLAUDE_SKILL_DIR}/scripts/convert.mjs"
```

Output is the raw CSS string written to stdout.

## Module usage

```js
import {tailwindToCss} from

`${process.env.CLAUDE_SKILL_DIR}/scripts/convert.mjs`;

// without overrides
const css = await tailwindToCss(classDefinitions);

// with token overrides
const css = await tailwindToCss(classDefinitions, '/path/to/overrides.css');
```

## Notes

- `npm install` runs automatically if `node_modules` is missing in the converter directory.
- Output uses **CSS nesting** (Tailwind v4 style): `@media` and `&:pseudo` rules are nested inside the class block rather than repeated at the top level.
- Unknown/custom classes are silently skipped — they will be absent from the output.
- All Tailwind boilerplate (`@property`, `@layer`, resets) is stripped; output contains only the requested class blocks.
- `--tw-*` custom properties set by Tailwind utilities (e.g. `--tw-font-weight`) pass through unchanged; they are inert in plain CSS contexts.
