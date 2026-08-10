---
name: svelte-shadcn-primitives
description: Build primitive UI components (buttons, inputs, dialogs, etc.) in Svelte 5 following shadcn-svelte patterns without Tailwind CSS. Use when creating new UI primitives in components/ui/, porting shadcn components, or building accessible interactive components. Requires the tailwind-to-css skill.
---

## Prerequisite: tailwind-to-css skill

This skill depends on the `tailwind-to-css` skill to convert Tailwind classes from shadcn source into vanilla CSS. If `tailwind-to-css` is not available in the current session, **reject the task** and tell the user to enable it.

## What is shadcn-svelte?

A port of shadcn/ui for Svelte 5. Not a component library you install — it provides copy-paste component source code you own and adapt. Components wrap **bits-ui** (headless primitives with built-in accessibility) and add styling + composition on top.

This skill adapts the shadcn-svelte patterns but replaces Tailwind with scoped CSS and CSS custom properties (design tokens).

## Adaptation workflow

shadcn-svelte components use Tailwind utilities for styling. When porting a component:

1. **Fetch the shadcn source** — run `npx shadcn-svelte@latest add <component> --dry-run` or read the component docs
2. **Extract Tailwind classes** — collect all class strings from templates and variant definitions
3. **Convert via tailwind-to-css** — use the `tailwind-to-css` skill to convert to vanilla CSS
4. **Replace with scoped styles** — move converted CSS into `<style>` blocks using CSS custom properties
5. **Adapt the component** — apply the conventions below

## Key adaptations from shadcn-svelte

| shadcn-svelte                  | Tailwind-free                                    |
|--------------------------------|--------------------------------------------------|
| `tailwind-variants` (`tv`)     | `class-variance-authority` (`cva`)               |
| `cn()` (clsx + tailwind-merge) | Project's class-merging utility                  |
| Tailwind classes in template   | Scoped `<style>` with CSS custom properties      |
| `WithElementRef` type          | `HTMLAttributes<Element>` from `svelte/elements` |
| `data-slot="name"`             | Keep — useful for parent selectors               |
| `bits-ui` primitives           | Keep — use for accessibility                     |

**Why `cva` over `tailwind-variants`?** `tailwind-variants` is optimized for Tailwind class strings (deduplication, responsive). With vanilla CSS class names there's no conflict risk, so `cva` is sufficient and has no Tailwind dependency.

## Component structure

UI primitives live in `$lib/components/ui/` and follow this structure:

```svelte
<script module lang="ts">
    // ChatModule-level: variant definitions, exported types
    import {cva, type VariantProps} from 'class-variance-authority';

    const myVariants = cva('base-class', {
        variants: {
            variant: {primary: 'variant-primary', secondary: 'variant-secondary'},
            size: {sm: 'size-sm', md: 'size-md'},
        },
        defaultVariants: {variant: 'primary', size: 'md'},
    });

    export type MyVariant = VariantProps<typeof myVariants>['variant'];
    export type MySize = VariantProps<typeof myVariants>['size'];
</script>
<!--
  @component Brief description of what this component does.
-->
<script lang="ts">
    import type {HTMLAttributes} from 'svelte/elements';

    interface Props extends HTMLAttributes<HTMLButtonElement> {
        variant?: MyVariant;
        size?: MySize;
    }

    const {variant, size, class: className, ...restProps}: Props = $props();
</script>

<button class="{myVariants({variant, size})} {className ?? ''}" {...restProps}>
    {@render children?.()}
</button>

<style>
    /* Use CSS custom properties, not hardcoded values */
    .base-class { display: inline-flex; align-items: center; }
    .variant-primary { background: var(--color-primary); color: var(--color-primary-foreground); }
    .size-sm { padding: var(--space-1) var(--space-2); font-size: var(--text-sm); }
</style>
```

### Svelte 5 conventions

- **`$props()`** for props destructuring — no `export let`
- **`$bindable()`** for two-way values (form inputs, toggles, checked state)
- **`{@render children?.()}`** for slot-like content (snippets, not `<slot>`)
- **`$derived`** for computed values that depend on props/state
- **Forward rest-props** via spread — consumers can always pass HTML attributes
- **`$props.id()`** for generated IDs when accessibility requires label association

### Styling conventions

- Use **CSS custom properties** (`--color-*`, `--space-*`, `--radius-*`, etc.) matching your project's design token system — never hardcode colors or sizes
- Keep styles **scoped** in `<style>` blocks
- Use `data-slot`, `data-state`, `data-open`/`data-closed` attributes for state-based CSS targeting (e.g., `[data-state="open"] { ... }`)
- Animations: use `@keyframes` in the component or a shared animation file

## Wrapping bits-ui primitives

When a component needs accessibility behavior (dialogs, dropdowns, tooltips, etc.), wrap `bits-ui` primitives:

```svelte
<script lang="ts">
    import {Dialog as DialogPrimitive} from 'bits-ui';
</script>

<DialogPrimitive.Root>
    <DialogPrimitive.Trigger>
        {@render trigger?.()}
    </DialogPrimitive.Trigger>
    <DialogPrimitive.Content class="dialog-content">
        {@render children?.()}
    </DialogPrimitive.Content>
</DialogPrimitive.Root>

<style>
    .dialog-content { /* position, size, background via tokens */ }
</style>
```

bits-ui handles focus trapping, keyboard navigation, ARIA attributes, and portal rendering. Style the visual layer in `<style>` targeting classes you set on the primitives.

## Compound components via namespace imports

Multi-part components (Dialog, DropdownMenu, Tabs, etc.) export sub-components and are consumed via namespace imports:

```svelte
<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog/index.js';
</script>

<Dialog.Root>
    <Dialog.Trigger>Open</Dialog.Trigger>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Title</Dialog.Title>
            <Dialog.Description>Description</Dialog.Description>
        </Dialog.Header>
    </Dialog.Content>
</Dialog.Root>
```

For compound components, create a directory (`components/ui/dialog/`) with an `index.ts` that re-exports all parts.

## Available shadcn-svelte components

Reference these when the user requests a UI primitive. Fetch the latest source with `npx shadcn-svelte@latest add <name> --dry-run`.

**Layout**: Card, Separator, AspectRatio, Resizable, ScrollArea

**Forms**: Button, Input, Textarea, Checkbox, RadioGroup, Select, NativeSelect, Switch, Slider, Label, Field, InputGroup, InputOTP, Form

**Feedback**: Alert, AlertDialog, Dialog, Drawer, Sheet, Sonner (toast), Progress, Spinner, Skeleton, Empty

**Navigation**: Tabs, NavigationMenu, Breadcrumb, Pagination, Menubar, ContextMenu, DropdownMenu, Command, Combobox

**Data display**: Table, Badge, Avatar, Tooltip, HoverCard, Popover, Accordion, Collapsible, Carousel, Calendar, RangeCalendar, DatePicker, Toggle, ToggleGroup, ButtonGroup, Kbd, Item, Typography, DataTable

Most interactive components wrap bits-ui primitives — always prefer them for accessibility over building from scratch.
