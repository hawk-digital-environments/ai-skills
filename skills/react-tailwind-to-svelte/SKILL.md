---
name: react-tailwind-to-svelte
description: "[ REQUIRES 'svelte', 'svelte-shadcn-primitives' and 'tailwind-to-css' skills! ] Convert React/TypeScript components with shadcn/ui and Tailwind CSS to Svelte 5 components with bits-ui and scoped CSS. Use when migrating React components, porting shadcn/ui components to Svelte, or converting TSX files to .svelte files."
---

## Prerequisites

This skill depends on three other skills. **Before starting any conversion**, verify all three are loaded in the current session:

1. **`svelte`** — Svelte 5 component patterns, stores, styling conventions
2. **`svelte-shadcn-primitives`** — shadcn-svelte patterns, bits-ui wrapping, compound components
3. **`tailwind-to-css`** — Tailwind utility class to vanilla CSS conversion

If any skill is missing, **stop and tell the user** to enable it. Do not attempt conversion without all three.

### Runtime dependencies

Before converting, verify these npm packages are installed in the project. If any are missing, install them (ask the user for confirmation first):

- **`bits-ui`** — headless accessible primitives (Dialog, Popover, Select, etc.)
- **`class-variance-authority`** — variant-to-class mapping (`cva`, `cx`)
- **`lucide-svelte`** — icon library (replaces `lucide-react`)

Check with `npm ls <package>` or look in `package.json`. Do not fall back to native HTML elements because a package is missing — tell the user to install the required packages.

## When to use

- Converting `.tsx` React components to `.svelte` files
- Porting shadcn/ui (React) components to shadcn-svelte equivalents
- Migrating React hooks to Svelte 5 runes
- Replacing Radix UI primitives with bits-ui primitives

## Reference documentation

When converting a component, **always look up both the React source and Svelte target** to understand the API differences.

### React shadcn/ui docs

Use the shadcn CLI to get component documentation URLs:

```bash
npx shadcn@latest docs <component-name>
```

This returns URLs for docs, examples, and API reference. Fetch those URLs to read the actual content.

### Svelte shadcn-svelte docs

Fetch the markdown docs directly via URL. To get the component list:

```
https://shadcn-svelte.com/docs/components.md
```

To get docs for a specific component, append `.md` to the component URL:

```
https://shadcn-svelte.com/docs/components/<name>.md
```

Examples:

- `https://shadcn-svelte.com/docs/components/button.md`
- `https://shadcn-svelte.com/docs/components/alert-dialog.md`
- `https://shadcn-svelte.com/docs/components/dropdown-menu.md`

Multi-word component names use hyphens (e.g. `input-otp`, `toggle-group`, `scroll-area`).

### bits-ui docs

bits-ui is the headless primitive library underlying shadcn-svelte. Fetch the LLM-friendly index at:

```
https://bits-ui.com/llms.txt
```

This lists all available component/utility docs. Each follows the pattern:

```
https://bits-ui.com/docs/components/<name>/llms.txt
```

Examples:

- `https://bits-ui.com/docs/components/dialog/llms.txt`
- `https://bits-ui.com/docs/components/select/llms.txt`
- `https://bits-ui.com/docs/components/popover/llms.txt`

Consult bits-ui docs when you need to understand available props, events, slots, or accessibility behavior for a primitive — especially when the React source wraps a Radix UI component.

## Conversion workflow

### Step 1: Analyze the React component

Read the entire source file. Identify:

- **Imports**: which libraries (Radix, lucide-react, shadcn/ui components, hooks)
- **Props interface**: types, defaults, `ref` forwarding, `className`
- **State**: `useState`, `useRef`, `useMemo`, `useCallback`, `useEffect`, `useContext`
- **Tailwind classes**: all class strings in JSX (inline, `cn()` calls, `cva()` definitions)
- **Compound structure**: does the file export multiple related sub-components?
- **Event handlers**: `onClick`, `onChange`, `onFocus`, etc.
- **Component type**: is this a UI primitive (`components/ui/`) or a business component (`components/`)?
- **Data vs logic**: does the file contain large data objects that should be extracted into separate `.ts` files?

### Step 2: Inventory and scaffold UI dependencies

List every shadcn/ui component the React source imports (e.g. `Button`, `Dialog`, `Popover`, `Slider`, `Select`). For each one, check whether a corresponding Svelte wrapper already exists in `components/ui/<name>/`.

- **If it exists** — import and use it.
- **If it does not exist** — scaffold it via the shadcn-svelte CLI, then adapt:

```bash
npx shadcn-svelte@latest add <component>
```

This generates a working Svelte component with bits-ui wiring and Tailwind classes. After scaffolding, apply the `tailwind-to-css` skill to convert Tailwind classes to scoped CSS, then apply `svelte-shadcn-primitives` conventions. This is far faster and more correct than writing components from scratch.

If the CLI fails or the component isn't available in the registry, fall back to building it manually: fetch the shadcn-svelte docs (`https://shadcn-svelte.com/docs/components/<name>.md`) and bits-ui docs (`https://bits-ui.com/docs/components/<name>/llms.txt`), then build the wrapper in `components/ui/<name>/`.

Never substitute a native HTML element (e.g. `<dialog>`, `<div>` with manual click-outside) for a shadcn/ui component. If the React source uses `<Dialog>`, the Svelte output must use a bits-ui `Dialog` wrapper from `components/ui/dialog/`. Same for Popover, Select, Slider, Sheet, and all other primitives.

### Step 3: Look up both APIs

1. Run `npx shadcn@latest docs <component>` for the React component and fetch the returned URLs
2. Fetch `https://shadcn-svelte.com/docs/components/<name>.md` for the Svelte equivalent

Compare APIs to understand prop/event/slot differences before converting.

### Step 4: Convert Tailwind classes to CSS

Collect all Tailwind utility classes from the component. Use the `tailwind-to-css` skill:

1. Assign semantic class names per element (e.g. `dialog-overlay`, `dialog-content`, `btn-primary`)
2. Build the `classDefinitions` array
3. Run the converter script
4. Place output CSS in the component's `<style>` block

For `cva()` variant definitions: convert each variant's Tailwind string to a CSS class name, then define those classes in `<style>`.

### Step 5: Apply conversion mappings

Use the tables below to systematically convert each React pattern to its Svelte equivalent.

### Step 6: Apply skill conventions

After mechanical conversion, apply the `svelte` and `svelte-shadcn-primitives` skill conventions:

- `@component` documentation block
- `Props` interface extending `HTMLAttributes<T>`
- `mergeProps` for rest-prop forwarding
- CSS custom properties (design tokens) instead of hardcoded values
- Scoped `<style>` blocks

## React to Svelte mapping

### Hooks to Runes

| React                              | Svelte 5                              | Notes                                 |
|------------------------------------|---------------------------------------|---------------------------------------|
| `useState(init)`                   | `let x = $state(init)`                | Direct replacement                    |
| `useMemo(() => expr, [deps])`      | `const x = $derived(expr)`            | No dependency array needed            |
| `useCallback(fn, [deps])`          | `const fn = ...` (plain function)     | Svelte has no memoization need        |
| `useEffect(() => { ... }, [deps])` | `$effect(() => { ... })`              | Auto-tracks dependencies              |
| `useEffect(() => { ... }, [])`     | `$effect()` in `onMount` context      | Or use `onMount()` for one-time setup |
| `useRef(null)` (DOM)               | `let el: HTMLElement; bind:this={el}` | Bind directly to element              |
| `useRef(value)` (mutable)          | `let x = $state(value)`               | If reactive; plain `let` if not       |
| `useContext(Ctx)`                  | `const ctx = myContext.get()`         | Use `Context` from `runed` package    |
| `createContext()`                  | `new Context<T>('name')` from `runed` | Define in separate `.ts` file         |

### JSX to Svelte template

| React JSX                           | Svelte                                      | Notes                                |
|-------------------------------------|---------------------------------------------|--------------------------------------|
| `{condition && <X/>}`               | `{#if condition}<X/>{/if}`                  |                                      |
| `{cond ? <A/> : <B/>}`              | `{#if cond}<A/>{:else}<B/>{/if}`            |                                      |
| `{items.map(i => <X key={i.id}/>)}` | `{#each items as i (i.id)}<X/>{/each}`      | Key in parentheses                   |
| `{children}`                        | `{@render children?.()}`                    | Snippets replace children            |
| `<Slot>` / `asChild`                | Not needed                                  | Use snippets or direct composition   |
| `className={cn(...)}`               | `class={cx(...)}`                           | `cx` from `class-variance-authority` |
| `className="..."`                   | `class="..."`                               |                                      |
| `style={{color: 'red'}}`            | `style="color: red"` or `style:color="red"` |                                      |
| `htmlFor="id"`                      | `for="id"`                                  |                                      |
| `dangerouslySetInnerHTML`           | `{@html content}`                           |                                      |

### Event handlers

| React                           | Svelte                     | Notes                         |
|---------------------------------|----------------------------|-------------------------------|
| `onClick={fn}`                  | `onclick={fn}`             | Lowercase, no camelCase       |
| `onChange={fn}`                 | `onchange={fn}`            | Or `oninput` for live updates |
| `onFocus` / `onBlur`            | `onfocus` / `onblur`       |                               |
| `onKeyDown`                     | `onkeydown`                |                               |
| `onSubmit`                      | `onsubmit`                 |                               |
| `e.preventDefault()` in handler | `onsubmit\|preventDefault` | Modifier syntax available     |

### Component structure

| React                                              | Svelte 5                                                          | Notes                                            |
|----------------------------------------------------|-------------------------------------------------------------------|--------------------------------------------------|
| `React.forwardRef<El, Props>((props, ref) => ...)` | `const {...}: Props = $props()`                                   | No ref forwarding needed; rest-spread handles it |
| `ComponentName.displayName = "X"`                  | Remove                                                            | Not needed in Svelte                             |
| `export default function Comp()`                   | Top-level `.svelte` file                                          | One component per file                           |
| `interface Props extends React.HTMLAttributes<T>`  | `interface Props extends HTMLAttributes<T>`                       | Import from `svelte/elements`                    |
| `React.ComponentPropsWithoutRef<T>`                | `HTMLAttributes<T>` from `svelte/elements`                        |                                                  |
| `const { className, children, ...props } = props`  | `const { class: className, children, ...rest }: Props = $props()` | Destructure `class` with alias                   |

### Library replacements

| React library                  | Svelte equivalent                      | Notes                                     |
|--------------------------------|----------------------------------------|-------------------------------------------|
| `@radix-ui/react-*`            | `bits-ui`                              | Same accessible primitives, Svelte API    |
| `lucide-react`                 | `lucide-svelte`                        | Same icon set, Svelte components          |
| `cn()` (clsx + tailwind-merge) | `cx()` from `class-variance-authority` | No tailwind-merge needed without Tailwind |
| `tailwind-variants` (`tv`)     | `cva` from `class-variance-authority`  | Simpler, no Tailwind dependency           |
| `class-variance-authority`     | Keep as-is                             | Works identically                         |
| `cmdk` (React command)         | `bits-ui` Command primitive            |                                           |
| `react-hook-form`              | Native Svelte form handling            | Or SvelteKit form actions                 |
| `@tanstack/react-table`        | `@tanstack/svelte-table`               | Same API, Svelte adapter                  |
| `sonner` (React)               | `svelte-sonner`                        | Toast notifications                       |
| `embla-carousel-react`         | `embla-carousel-svelte`                | Carousel                                  |
| `react-day-picker`             | `bits-ui` Calendar primitives          |                                           |
| `input-otp` (React)            | `bits-ui` PIN Input                    |                                           |
| `vaul` (React drawer)          | `bits-ui` Drawer or `vaul-svelte`      |                                           |

## Output placement

Preserve the source file's hierarchy level. Not every component is a UI primitive:

- **Source in `components/ui/`** (shadcn primitives like Button, Dialog, Select) → output in `components/ui/<name>/`
- **Source in `components/`** (business components like ModelCardDialog) → output in `components/<Name>.svelte` or `components/<Name>/` if compound
- **Source utilities/hooks** → output in `utils/` or `stores/` as appropriate

When the React source uses a shadcn `<Dialog>`, the Svelte output must use the bits-ui `Dialog` primitive — do not downgrade to a native `<dialog>` element.

## Data extraction

If the React source contains large data objects (lookup tables, static records, configuration maps) inline in the component file, extract them into a separate `.ts` file. Components should import data, not define it. This keeps the `.svelte` file focused on rendering.

## Compound component conversion

React shadcn exports multiple sub-components from one file (e.g. Dialog exports Root, Trigger, Content, Header, Footer, Title, Description). In Svelte:

1. Create a directory at the **same hierarchy level as the source** (e.g. `components/ui/<name>/` for primitives, `components/<Name>/` for business components)
2. Each sub-component becomes its own `.svelte` file
3. Create `index.ts` re-exporting all parts
4. Consumers import via namespace: `import * as Dialog from '$lib/components/ui/dialog/index.js'`

**React compound pattern:**

```tsx
const DialogHeader = ({className, ...props}) => (
    <div className={cn("flex flex-col space-y-1.5", className)} {...props} />
);
```

**Svelte equivalent:**

```svelte
<!--
  @component Header section of a dialog with title and description.
-->
<script lang="ts">
    import type {HTMLAttributes} from 'svelte/elements';
    import {mergeProps} from '../../util/mergeProps.js';

    interface Props extends HTMLAttributes<HTMLDivElement> {}
    const {...restProps}: Props = $props();
</script>

<div {...mergeProps(restProps, {class: 'dialog-header'})}>
    {@render restProps.children?.()}
</div>

<style>
    .dialog-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }
</style>
```

## CVA variant conversion

React shadcn uses `cva` with Tailwind class strings. Convert to CSS class names:

**React (Tailwind classes):**

```tsx
const buttonVariants = cva(
    "inline-flex items-center justify-center rounded-md text-sm font-medium",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive: "bg-destructive text-destructive-foreground",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 px-3",
            },
        },
        defaultVariants: {variant: "default", size: "default"},
    }
);
```

**Svelte (CSS class names):**

```svelte
<script module lang="ts">
    import {cva, type VariantProps} from 'class-variance-authority';

    const buttonVariants = cva('btn', {
        variants: {
            variant: {
                default: 'btn--default',
                destructive: 'btn--destructive',
            },
            size: {
                default: 'btn--size-default',
                sm: 'btn--size-sm',
            },
        },
        defaultVariants: {variant: 'default', size: 'default'},
    });
</script>

<style>
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--corner-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium, 500);
    }
    .btn--default {
        background: var(--color-primary);
        color: var(--color-primary-foreground);
    }
    .btn--default:hover { opacity: 0.9; }
    .btn--destructive {
        background: var(--color-destructive);
        color: var(--color-destructive-foreground);
    }
    .btn--size-default { height: 2.5rem; padding: var(--space-2) var(--space-4); }
    .btn--size-sm { height: 2.25rem; padding: var(--space-1) var(--space-3); }
</style>
```

## Radix to bits-ui mapping

React shadcn wraps Radix UI primitives. Svelte uses bits-ui (same concepts, Svelte API):

| Radix (React)               | bits-ui (Svelte)              | Notes                         |
|-----------------------------|-------------------------------|-------------------------------|
| `<DialogPrimitive.Root>`    | `<Dialog.Root>`               | Same structure                |
| `<DialogPrimitive.Trigger>` | `<Dialog.Trigger>`            |                               |
| `<DialogPrimitive.Portal>`  | Built into `<Dialog.Content>` | bits-ui portals automatically |
| `<DialogPrimitive.Overlay>` | `<Dialog.Overlay>`            |                               |
| `<DialogPrimitive.Content>` | `<Dialog.Content>`            |                               |
| `<DialogPrimitive.Close>`   | `<Dialog.Close>`              |                               |
| `<SelectPrimitive.Root>`    | `<Select.Root>`               |                               |
| `<SelectPrimitive.Trigger>` | `<Select.Trigger>`            |                               |
| `<SelectPrimitive.Content>` | `<Select.Content>`            |                               |
| `<SelectPrimitive.Item>`    | `<Select.Item>`               |                               |

Import pattern: `import {Dialog as DialogPrimitive} from 'bits-ui'`

Key differences:

- bits-ui handles portaling internally — no explicit `Portal` wrapper
- `ref` forwarding is automatic — no `React.forwardRef` needed
- State props like `open` use `$bindable()` for two-way binding
- `data-state`, `data-side`, `data-align` attributes work the same way

## Full conversion example

**React input (ModelSettingsPopover.tsx):**

```tsx
import {useState} from "react";
import {Settings} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Slider} from "@/components/ui/slider";

const ModelSettingsPopover = () => {
    const [temperature, setTemperature] = useState(0.7);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4"/>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
                <Slider value={[temperature]} onValueChange={(v) => setTemperature(v[0])}/>
            </PopoverContent>
        </Popover>
    );
};
```

**Svelte output (ModelSettingsPopover.svelte):**

```svelte
<!--
  @component Popover for adjusting model parameters (temperature, top-p).
-->
<script lang="ts">
    import {Settings} from 'lucide-svelte';
    import * as Popover from '$lib/components/ui/popover/index.js';
    import {Button} from '$lib/components/ui/button/index.js';
    import {Slider} from '$lib/components/ui/slider/index.js';

    let temperature = $state(0.7);
</script>

<Popover.Root>
    <Popover.Trigger>
        <Button variant="ghost" size="icon" class="trigger-btn">
            <Settings size={16} />
        </Button>
    </Popover.Trigger>
    <Popover.Content align="end" class="settings-content">
        <Slider
            value={temperature}
            onValueChange={(v) => { temperature = v; }}
        />
    </Popover.Content>
</Popover.Root>

<style>
    .trigger-btn { width: 2rem; height: 2rem; }
    .settings-content { width: 18rem; padding: var(--space-4); }
</style>
```

## Checklist

After conversion, verify:

- [ ] No React imports remain (`react`, `@radix-ui/*`, `lucide-react`)
- [ ] No `className` props — converted to `class`
- [ ] No Tailwind utility classes — all converted to scoped CSS
- [ ] No `cn()` calls — replaced with `cx()` or `mergeProps`
- [ ] No `React.forwardRef` — replaced with `$props()` + spread
- [ ] No `useState`/`useEffect`/`useMemo` — replaced with runes
- [ ] `@component` documentation block present on every `.svelte` file
- [ ] `Props` interface extends appropriate `HTMLAttributes<T>`
- [ ] CSS uses design tokens (`--color-*`, `--space-*`, etc.) — no raw `calc(0.25rem * N)` when a spacing token exists
- [ ] Events use lowercase (`onclick` not `onClick`)
- [ ] Compound components have `index.ts` re-export file
- [ ] Output placement matches source hierarchy (`components/ui/` vs `components/`)
- [ ] No `:global()` styles — use scoped classes instead
- [ ] No large data objects inlined in the component — extract to separate `.ts` files
- [ ] shadcn components (Dialog, Popover, etc.) use bits-ui primitives, not native HTML elements
- [ ] All code is written in English, non-english text is preserved in the output, but all comments and documentation are in English for consistency
