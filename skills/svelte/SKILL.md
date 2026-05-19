---
name: svelte
description: Svelte 5 + TypeScript component patterns, store architecture, CSS cascade-layer styling, and utility conventions. Use when writing or reviewing Svelte components, stores, or styling code.
---

# Svelte 5 Standards

## Tech Stack

- **Svelte 5** Runes API (`$state`, `$derived`, `$props`, `$bindable`) — no Options API or legacy Svelte 4 syntax
- **TypeScript** — every `.svelte` and `.ts` file must be typed; avoid `any`
- **Vite** bundler (`vite.config.js` / `svelte.config.js`)
- **`class-variance-authority` (CVA)** — declarative variant→class mapping for style-driving props

## Directory Structure

```
src/
├── components/       ← Reusable building blocks
│   └── ui/           ← Low-level primitives (no business logic, no app-state deps)
├── snippets/         ← Page-slot entry points (thin shells, pull from stores)
├── stores/           ← Reactive store classes (*.svelte.ts)
├── types/            ← Shared TypeScript type definitions
└── util/             ← Framework-agnostic utilities
```

**Role rules:**
- `snippets/` — thin shells; delegate rendering to `components/`, pull state from `stores/`
- `components/` — no knowledge of which snippet uses them
- `components/ui/` — zero business logic, zero app-state dependencies; composed by higher-level components
- `stores/` — all state crossing component boundaries; components read/write stores, never pass callbacks between siblings

---

## Components

### Required Documentation

Every component needs a `@component` block before `<script>` and JSDoc on every prop:

```svelte
<!--
  @component One-line description of what this component does and when to use it.
-->
<script lang="ts">
    import type {HTMLAttributes} from 'svelte/elements';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        /** Description of this prop. */
        requiredProp: string;
        /**
         * Description of this optional prop.
         * @deprecated — use `requiredProp` instead.
         */
        optionalProp?: string;
    }

    const {requiredProp, optionalProp, ...rest}: Props = $props();
</script>
```

`Props` always extends the matching `HTMLAttributes<T>` — never redeclare `class`, `id`, `aria-*`.

### Conflicting Attribute Types

When a prop collides with an existing HTML attribute signature, widen in an intermediate interface first:

```svelte
interface NonConflictingProps extends HTMLAttributes<HTMLDivElement> {
    onchange?: any; // widen so Props can redefine safely
}
interface Props extends NonConflictingProps {
    /** Fires with the newly selected string value. */
    onchange?: (newValue: string) => void;
}
```

### Stable IDs for Accessibility

```svelte
const generatedId = $props.id(); // stable across renders, unique across instances
const finalId = id || generatedId;
```

Never use `Math.random()` or a module-level counter for IDs.

---

## Reactive Stores

File extension **must** be `.svelte.ts` so the Svelte compiler processes runes. Export both the class and a pre-constructed singleton:

```ts
// stores/MyStore.svelte.ts
export class MyStore {
    public count = $state(0);
    public doubled = $derived(this.count * 2);
}
export const myStore = new MyStore();
```

Import with `.js` extension — Vite resolves `.svelte.ts` when `.js` is used (standard TypeScript ESM convention):

```svelte
import {myStore} from '../stores/MyStore.svelte.js';
```

---

## Prop Merging (`mergeProps`)

Standard way to forward rest-props onto a root element while preserving component defaults:

| Key type | Merge behaviour |
|---|---|
| `on*` handlers | Both called in sequence — neither overwrites |
| `class` | Accumulated into array; falsy entries filtered |
| Everything else | Last value wins |

```svelte
<div {...mergeProps(
    restProps,                       // restProps FIRST so component values win last
    {
        class: ['card', focused && 'card--focused'],
        onfocus: () => { focused = true; },
        onblur:  () => { focused = false; },
    }
)}>
```

For ad-hoc class merging without a full `mergeProps` call, use `cx` (re-exported from CVA):

```ts
import {cx} from 'class-variance-authority';
const cls = cx('base', isActive && 'active', className);
```

---

## Two-Way Binding (`$bindable`)

Only use `$bindable()` for values the parent genuinely needs to read back. Always provide a default:

```svelte
const {
    value   = $bindable(''),
    checked = $bindable(false),
}: Props = $props();
```

Plain downward-only props stay as regular props.

---

## Polymorphic Content (`string | Snippet`)

For props that accept either plain text or rich Svelte snippets:

```svelte
import type {Snippet} from 'svelte';

interface Props {
    /** Plain text or snippet for rich content. */
    label?: string | Snippet;
}
```

Render both cases:

```svelte
{#if typeof label === 'string'}
    <span>{label}</span>
{:else}
    {@render label()}
{/if}
```

When this pattern appears in 3+ components, extract it into a small `SnippetOrString.svelte` utility:

```svelte
<!-- components/ui/SnippetOrString.svelte -->
<script lang="ts" generics="T">
    import type {Snippet} from 'svelte';
    interface Props { value: string | Snippet<[T | undefined]>; snippetArgs?: T; }
    const {value, snippetArgs}: Props = $props();
</script>
{#if typeof value === 'string'}{value}{:else}{@render value(snippetArgs)}{/if}
```

---

## Parent-Child Context (`runed`)

Use `Context` from the `runed` package instead of Svelte's built-in `setContext/getContext`. Define in a dedicated file:

```ts
// RadioCardContext.ts
import {Context} from 'runed';
interface RadioCardContext {
    getValue:   () => string;
    setValue:   (v: string) => void;
    isDisabled: () => boolean;
}
export const radioCardContext = new Context<RadioCardContext>('radio-card');
```

**Parent** — expose **getter functions**, not plain values, so children track reactive state:

```svelte
let selected = $state('');
radioCardContext.set({
    getValue:   () => selected,
    setValue:   (v) => { selected = v; onchange?.(v); },
    isDisabled: () => disabled,
});
```

**Child** — call getters in the template; Svelte re-evaluates them when parent `$state` changes:

```svelte
const ctx = radioCardContext.get();
// ↓ Svelte tracks this function call for reactivity
<button aria-pressed={ctx.getValue() === value} disabled={ctx.isDisabled()}>
```

---

## Variant Components (CVA)

When a component exposes style-driving props (`size`, `intent`, …), use `cva` for a declarative, type-safe variant map:

```svelte
<script lang="ts">
    import {cva, type VariantProps} from 'class-variance-authority';
    import {mergeProps} from '../util/mergeProps.js';
    import type {HTMLAttributes} from 'svelte/elements';

    const variants = cva('btn', {
        variants: {
            intent: {primary: 'btn--primary', secondary: 'btn--secondary'},
            size:   {sm: 'btn--sm', md: 'btn--md'},
        },
        defaultVariants: {intent: 'primary', size: 'md'},
    });

    interface Props extends HTMLAttributes<HTMLButtonElement> {
        intent?: VariantProps<typeof variants>['intent'];
        size?:   VariantProps<typeof variants>['size'];
    }

    const {intent, size, ...restProps}: Props = $props();
    const elementProps = $derived(mergeProps({class: variants({intent, size})}, restProps));
</script>
```

`VariantProps<typeof x>` reflects valid values automatically — no manual union types. `defaultVariants` eliminates `?? 'fallback'` chains.

---

## Styling

### CSS Cascade Layers

Declare once at the entry point (lowest → highest priority):

```css
@layer reset, tokens, base, components, utilities;
```

Svelte scoped `<style>` blocks compile into the `components` layer — no `!important` is ever needed.

Design tokens live in a `tokens/` directory as CSS custom properties, available on every element.

### Token Reference

| Group | Examples |
|---|---|
| Colors | `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-interactive`, `--color-border` |
| Typography | `--font-size-xs` → `--font-size-2xl`, `--font-weight-medium`, `--line-height-normal` |
| Spacing | `--space-1` (4 px) → `--space-16` (64 px) |
| Radius | `--corner-sm`, `--corner-md`, `--corner-lg`, `--corner-full` |
| Shadows | `--elevation-none`, `--elevation-1`, `--elevation-2` |
| Transitions | `--duration-fast`, `--duration-normal`, `--easing-default`, `--easing-spring` |

Dark mode via `[data-theme="dark"]` on `<html>` — color tokens update automatically. **Components need zero dark-mode rules.**

### Breakpoints (CSS Custom Media)

Processed by `postcss-custom-media`, globally available in all CSS files including Svelte `<style>` blocks:

| Range | Min | Max |
|---|---|---|
| `xxs` | 0 | 300 px |
| `xs` | 0 | 549 px |
| `sm` | 550 px | 767 px |
| `md` | 768 px | 991 px |
| `lg` | 992 px | 1199 px |
| `xl` | 1200 px | — |

Query patterns: `--bp-{range}`, `--bp-{range}-and-smaller`, `--bp-{range}-and-bigger`, `--bp-smaller-than-{range}`, `--bp-bigger-than-{range}`, `--bp-mode-mobile` (≤ 850 px), `--bp-mode-desktop` (≥ 851 px).

```css
@media (--bp-md-and-bigger) { .sidebar { display: flex; } }
@media (--bp-sm-and-smaller) { .nav { flex-direction: column; } }
```

### Component Style Pattern

Two levels of token usage inside a component:

1. **Reference globals directly** for single-use, never-changing values.
2. **Declare a component-local token** at the root element when a value appears in multiple properties *or* changes under a state rule — reassigning one token propagates to every property that references it.

```svelte
<style>
    .card {
        --card-bg:        var(--color-surface);
        --card-border:    var(--color-border);
        --card-elevation: var(--elevation-1);

        background:    var(--card-bg);
        border:        1px solid var(--card-border);
        border-radius: var(--corner-md);   /* single-use — global directly */
        box-shadow:    var(--card-elevation);
        padding:       var(--space-6);     /* single-use — global directly */
    }

    /* State: reassign local tokens only — never repeat property declarations */
    .card:hover {
        --card-border:    var(--color-border-strong);
        --card-elevation: var(--elevation-2);
    }
</style>
```

For external restylability use the fallback form: `var(--card-elevation, var(--elevation-1))`.

### Styling Rules

- **No `!important`** — cascade layers make it unnecessary
- **No hardcoded colors** — reference a token; if none fits, add one to `tokens/colors.css`
- **No hardcoded sizes** — use spacing / radius / typography tokens
- **States reassign component-local tokens** only, never global ones
- **No utility-class spam** — 3+ repeated patterns → extract a Svelte primitive
- **Dark mode is free** — never add `[data-theme="dark"]` rules inside component styles
