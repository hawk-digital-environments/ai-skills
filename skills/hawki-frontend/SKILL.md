---
name: hawki-frontend
description: "[ REQUIRES 'svelte' skill! ] HAWKI frontend coding standards for Svelte 5 + TypeScript. Use when writing or reviewing frontend code for HAWKI, creating Svelte components, snippets, stores, or when asked about frontend architecture."
---

> ONLY CONTINUE IF THE `svelte` SKILL IS AVAILABLE.
> This skill builds on top of the `svelte` skill, it is imperative that you have read and understood the `svelte` skill before continuing. If you don't have the `svelte` skill available, report an error: "The `svelte` skill is required for the `hawki-frontend` skill."

> **Note:** The current codebase may not fully follow these guidelines. Follow these rules in all new code and refactor toward them when possible. **Do not add new code to the legacy vanilla-JS layer (`public/js/`).** All new frontend work must follow the patterns described here.

## Directory Structure

HAWKI sources live under `resources/js/` (not `src/`):

```
resources/js/
├── svelte/
│   ├── components/          ← Reusable general-purpose Svelte components
│   │   └── ui/              ← Low-level primitives (shadcn-style, no business logic)
│   ├── snippets/            ← Blade-embeddable entry points (one per page slot)
│   ├── stores/              ← Svelte 5 reactive store classes (*.svelte.ts)
│   ├── types/
│   │   ├── ai.ts            ← AiModelResource, SystemModelResource, SystemPromptResource, labels
│   │   ├── connection.ts    ← InternalConnectionConfig, route types
│   │   └── translation.ts  ← Locale, LocaleCode, LocaleRecord
│   └── svelteSnippetLoader.ts ← Custom-element bridge for Blade integration
└── util/
    ├── hawkiConnection.ts   ← Server-rendered connection data accessor
    ├── translator.ts        ← Client-side translation helper
    ├── mergeProps.ts        ← mergeProps + cx re-exported from CVA
    └── fileIconSvg.ts       ← File-type icon helper
```

Always extend shared types in `resources/js/svelte/types/` instead of defining one-off local interfaces:

| File             | Contents                                                                                 |
|------------------|------------------------------------------------------------------------------------------|
| `ai.ts`          | `AiModelResource`, `SystemModelResource`, `SystemPromptResource`, capability/tool labels |
| `connection.ts`  | `InternalConnectionConfig`, `CommonConnectionConfig`, route types                        |
| `translation.ts` | `Locale`, `LocaleCode`, `LocaleRecord`                                                   |

## Hybrid Architecture: Snippets

HAWKI embeds Svelte into Blade via **Snippets** — self-contained components mounted in server-rendered pages. Transitional architecture toward a full SPA; snippets become SPA building blocks.

### Embedding with `<x-svelte>`

```blade
<x-svelte type="ChatInput" />
<x-svelte type="ChatInput" :props="['readonly' => true]" class="my-class" />
```

`type` = filename inside `resources/js/svelte/snippets/` without `.svelte`. Props are JSON-encoded automatically. Extra HTML attributes forwarded verbatim to the rendered element.

**No manual imports or registrations needed** — Vite's `import.meta.glob` discovers all snippets at build time.

**Lifecycle:** mounted when element enters the DOM, destroyed when it leaves, destroyed + remounted when `type` or `props` change. Treat snippets as stateless from the outside — internal state resets on every remount.

### Adding a Snippet

1. Create `resources/js/svelte/snippets/MyWidget.svelte`
2. Use in Blade: `<x-svelte type="MyWidget" />`

### The `root` Prop

Every snippet automatically receives `root` — a reference to the `<svelte-snippet>` DOM element. Use it to read additional HTML attributes or dispatch custom events to legacy vanilla-JS:

```svelte
<script lang="ts">
    import type {HTMLSvelteSnippetElement} from '../svelteSnippetLoader.js';
    interface Props { root: HTMLSvelteSnippetElement; }
    const {root}: Props = $props();

    function notifyLegacy(value: string) {
        root.dispatchEvent(new CustomEvent('myWidget:change', {detail: {value}, bubbles: true}));
    }
</script>
```

## Accessing Server Data

The backend injects a JSON blob into the page. Access via `hawkiConnection`:

```ts
import {hawkiConnection} from '../../util/hawkiConnection.js';

const config = hawkiConnection();                                            // full config
const aiConfig = hawkiConnection('ai');                                      // top-level key
const mimeTypes = hawkiConnection('storage.allowedMimeTypes') as string[];   // dot-notation
```

Return type derived from `InternalConnectionConfig` in `resources/js/svelte/types/connection.ts`. Add new fields there when the backend exposes new data.

## Translations

```ts
import {translate} from '../../util/translator.ts';

translate('chat.send_button');
translate('errors.file_too_large', {size: '10 MB'});
translate('room.invite', {name: (inner) => `<strong>${inner}</strong>`});
```

Mirrors Laravel's `Translator::makeReplacements()`: supports `:placeholder`, `:Placeholder`, `:PLACEHOLDER` casing variants and tag-callback replacements. Keys sourced from `translation.labels` in the connection blob (from `resources/language/*.json`).

## HAWKI-Specific CSS

Token files live in `resources/css/tokens/`:

| File              | Contents                                                                                                                                                        |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `colors.css`      | OKLCH color scales + semantic aliases                                                                                                                           |
| `typography.css`  | font sizes, weights, line heights                                                                                                                               |
| `spacing.css`     | `--space-1` (4px) → `--space-16` (64px)                                                                                                                         |
| `radius.css`      | `--corner-sm/md/lg/full`                                                                                                                                        |
| `shadows.css`     | `--elevation-none/1/2`                                                                                                                                          |
| `transitions.css` | `--duration-*` and `--easing-*`                                                                                                                                 |
| `breakpoints.css` | CSS Custom Media Queries — processed by `postcss-custom-media`, made globally available (including Svelte `<style>` blocks) via `@csstools/postcss-global-data` |

**Legacy styles** in `public/css/` keep loading during the SPA transition — do not add new rules there.

## `Link.svelte` — Accessible Anchor Primitive

`components/ui/Link.svelte` is the standard anchor component. Use it instead of a bare `<a>` when you need:

- Automatic `rel="noopener noreferrer"` on `target="_blank"` (prevents tabnabbing)
- A `disabled` state that blocks navigation without removing the element from the DOM
- A consistent `disabled` class for styling

```svelte
<Link href="/dashboard">Dashboard</Link>
<Link href="https://example.com" target="_blank">External (rel auto-set)</Link>
<Link href="/action" disabled>Disabled</Link>
```

| Prop       | Type      | Default | Description                                                          |
|------------|-----------|---------|----------------------------------------------------------------------|
| `href`     | `string`  | `''`    | Target; replaced with `javascript:void(0)` when empty or disabled.   |
| `target`   | `string`  | `''`    | Standard anchor `target`.                                            |
| `rel`      | `string`  | `''`    | Overrides auto `rel`. Defaults to `noopener noreferrer` on `_blank`. |
| `disabled` | `boolean` | `false` | Blocks navigation; adds `disabled` class.                            |
| `children` | `Snippet` | —       | Link content.                                                        |

All `HTMLAnchorAttributes` forwarded via rest-props. `href`, `rel`, and `onclick` are computed with `$derived.by()` so they react to `disabled`/`target` changes. Empty attributes are omitted from the rendered `<a>` to keep HTML clean.
