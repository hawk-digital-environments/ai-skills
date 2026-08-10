---
name: hawki-frontend
description: "[ REQUIRES 'svelte' skill! ] HAWKI frontend coding standards: kernel + plugin architecture, hooks, stores, snippets, UI primitives, composer. Use when writing or reviewing HAWKI Svelte 5 frontend code, creating components/stores/snippets, or when asked about frontend architecture."
---

> ONLY CONTINUE IF THE `svelte` SKILL IS AVAILABLE.
> This skill builds on top of the `svelte` skill. Read and understand the `svelte` skill first. If it isn't available, report an error: "The `svelte` skill is required for the `hawki-frontend` skill."

> **Migration phase.** HAWKI's frontend is mid-migration from legacy vanilla-JS to Svelte 5 SPA. Follow these rules in all new code; refactor toward them when possible. **Do not add new code to `public/js/`** (legacy vanilla-JS) or `public/css/`. All new frontend work lives under `resources/js/` and `resources/css/`, processed by Vite.

This skill only covers HAWKI-specific conventions. Generic Svelte 5 patterns (component docs, `Props extends HTMLAttributes`, `$bindable`, stable IDs via `$props.id()`, CVA variants, cascade layers, token reference, breakpoints, dark mode) are in the `svelte` skill and not repeated here.

## Divergences from the `svelte` skill

HAWKI overrides two generic patterns from the `svelte` skill. Use the HAWKI version in HAWKI code.

**`mergeProps`** — import from `bits-ui`, not a custom util:

```svelte
<script lang="ts">
    import {mergeProps} from 'bits-ui';
    // restProps FIRST so component-internal values win last for non-event/non-class keys.
    <div {...mergeProps(restProps, {class: ['card', focused && 'card--focused'], onfocus: () => {}})}>
</script>
```

`cx` still comes from `class-variance-authority` for ad-hoc class merging.

**Context** — plain Svelte `setContext`/`getContext` in typed factory functions, **not** the `runed` package. Define in a dedicated `*.svelte.ts` file (`.svelte.ts` required when the class uses runes; plain `.ts` works otherwise). Use a module-scoped `Symbol` key.

```ts
// ToolMenuFocusContext.svelte.ts
import {getContext, setContext} from 'svelte';

export class ToolMenuFocusContext { /* state and methods */ }

const key = Symbol('toolMenuFocus');

export function setToolMenuFocusContext(): ToolMenuFocusContext {
    const ctx = new ToolMenuFocusContext();
    setContext(key, ctx);
    return ctx;
}

export function useToolMenuFocusContext(): ToolMenuFocusContext {
    const ctx = getContext<ToolMenuFocusContext>(key);
    if (!ctx) throw new Error('useToolMenuFocusContext has no access to ToolMenuFocusContext.');
    return ctx;
}
```

Use `setContextXX` when the factory only creates/registers. Use `createContextXX` when setup is heavier (subscribing to stores, wiring multiple objects). Do not introduce `Context` from `runed` for new code.

## Directory & Path Aliases

```
resources/js/
├── app.ts                ← entry: createApp(extensions) + bootstrapper.run()
├── app/                  ← hooks (useApp, useConfig, useStore, ...) + app-owned schemas
├── kernel/               ← extension-assembled app core (api, client, config, encryption, stores, plugins, ...)
├── plugins/core/         ← the only first-party plugin (snippets, stores, schemas, modules)
├── legacy/               ← bridge to legacy vanilla-JS (@deprecated, do not extend)
├── components/
│   ├── ui/               ← low-level primitives (no business logic)
│   └── util/             ← composable utility components
└── utils/                ← shared utilities (flows, debounce, transitions, ...)
```

Path aliases (in `tsconfig.json` + `vite.config.ts`): **`$lib` = `resources/js/`**, **`$plugins` = `resources/js/plugins/`**. No `$components` alias — import components via `$lib/components/...`.

Import `.svelte.ts` stores with `.js` extension: `import {myStore} from '$lib/.../MyStore.svelte.js'`.

## Reaching the App: Hooks

Components never import stores or config directly. Reach the app through hooks in `app/hooks/`. Prefer the specific hook over `useApp()` when one fits.

| Hook | Returns | Use for |
|---|---|---|
| `useApp()` | `HawkiApp` | extension surfaces with no dedicated hook |
| `useConfig(ns?)` | reactive config namespace (default `'hawki-core'`) | runtime config values |
| `useConnection()` | full `Connection` union | API version / locale regardless of auth state |
| `useAuthenticatedConnection()` | authenticated connection or `null` | code requiring an active session |
| `useConnectionWithUserInfo()` | connection or `null` | user info for both auth + registering users |
| `useStore(name)` | typed `DataStore` | shared reactive state |
| `useTranslator()` | `Translator` (`__`, `hasLabel`, `getTranslations`, `getTranslationsFlat`) | user-facing strings |
| `useRestApi()` / `useLinkPreviewApi()` | `app.restApi` / `app.linkPreviewApi` | typed fetches / link previews |

Use the narrowest connection hook that fits the context — `useConnection()` everywhere suppresses type errors that would catch a component rendered in the wrong auth state. `Connection` is a discriminated union on `type`: `'internal'` (anonymous), `'internal_authenticated'` (logged in, has `userinfo`), `'internal_registering_user'` (mid-registration).

Config is safe to read after the `preparation` boot stage; stores after `main`.

## Config & Connection

**Config** (`app.config`) — frontend runtime config blob, fetched once during `preparation`, cached for page lifetime. Divided into namespaces; `'hawki-core'` is default (locale, file storage limits, allowed MIME types, WebSocket, AI display, crypto salts). Each namespace parsed against its registered Zod schema lazily on first read. Calling with an unregistered namespace throws — always a programming error.

```svelte
<script lang="ts">
    import {useConfig} from '$lib/app/hooks/useConfig.svelte.js';
    const coreConfig = useConfig();              // 'hawki-core' slice
    const myFeature = useConfig('my-feature');   // named namespace
</script>
```

**Connection** (`app.connection`) — auth state + route metadata, fetched once during `preparation`. Narrowing hooks return `null` (not throw) when not in expected state, so templates can check `null` directly.

## REST API & Resource Schemas

Fetch helpers live on `app.restApi`, reached via `useRestApi()`. They set `Accept`/`Content-Type`, decode the JSON:API envelope, parse error responses into readable messages before throwing.

```ts
const restApi = useRestApi();
const collection = await restApi.getResourceCollection('ai-models'); // typed + validated
const model = await restApi.getResource('ai-models', id);
const raw = await restApi.getResourceCollection('some-resource', {validateSchema: false});
const result = await restApi.getFromResourceAction('reports', 'generate', {schema: MySchema}); // RPC-style GET
await restApi.postToResourceAction('reports', 'generate', data);    // RPC-style POST
```

`HawkiResourceSchemas` (in `kernel/extendableTypes.ts`) is an empty interface grown by declaration merging. `restApi.getResource('ai-models')` returns the typed schema with no explicit assertion or lookup at the call site.

### Adding a resource schema

Create `{resource-type}.schema.ts` in `resources/js/app/schemas/resources/` (app-wide) or your plugin's `schemas/resources/`. Filename stem becomes the resource type key.

```ts
// resources/js/app/schemas/resources/my-thing.schema.ts
import z from 'zod';

const MyThingSchema = z.object({id: z.string(), name: z.string()});
export default MyThingSchema;
export type MyThing = z.infer<typeof MyThingSchema>;

declare module '$lib/kernel/extendableTypes.js' {
    interface HawkiResourceSchemas { 'my-thing': MyThing; }
}
```

Once the file exists, `restApi.getResourceCollection('my-thing')` returns `JsonApiCollection<MyThing>` and validates automatically. No wiring needed. Config namespaces work the same way, augmenting `HawkiConfigSchemas` in `schemas/config/`.

## Stores

Reactive state shared across components lives in stores — TypeScript classes using Svelte 5 runes, `implements DataStore`, with a `name` and optional `loadData(app)`. Registered by a plugin into `app.stores`; `loadData` runs on the `main` boot stage (concurrent). Source: `resources/js/plugins/core/stores/*.svelte.ts`.

Access via `useStore()` — the string key is typed against `HawkiDataStores` (augmented next to each store class), so `useStore('theme')` returns `ThemeStore`. Unknown name is a compile error.

```svelte
<script lang="ts">
    import {useStore} from '$lib/app/hooks/useStore.svelte.js';
    const aiModelStore = useStore('ai-models');
    const themeStore = useStore('theme');
    const isDark = $derived(themeStore.theme === 'dark');
</script>
```

In non-component code: `getHawkiApp().stores.get('theme')`.

### Store registry

| Key | Class | Holds |
|---|---|---|
| `'ai-models'` | `AiModelStore` | All AI models + system-role assignments (`models`, `systemModels`; `getOneById`, `getModelByIdOrFallback`, `getSystemModelByType`) |
| `'ai-tools'` | `AiToolStore` | AI tools + capabilities merged into one reactive list (`tools`; `AiToolOrCapabilityWrapper` — discriminate with `is_capability`) |
| `'system-prompts'` | `SystemPromptStore` | Server-configured system prompts (`getPromptByType` — non-nullable for well-known types) |
| `'keychain'` | `KeychainStore` | User encryption keys (async load; `publicKey`, `privateKey`, `aiConvKey`, `roomKeys`, `waitingToLoad`) |
| `'theme'` | `ThemeStore` | Active UI theme `'dark'`/`'light'`; observes `<html>` class list via `MutationObserver` |
| `'ai-handle'` | `AiHandleStore` | `@handle` string + `getHandlesIn(message)` generator |

### Writing a store

```ts
// resources/js/plugins/myPlugin/stores/MyStore.svelte.ts
import type {DataStore} from '$lib/kernel/stores/types.js';
import type {HawkiApp} from '$lib/kernel/HawkiApp.js';

declare module '$lib/kernel/extendableTypes.js' {
    interface HawkiDataStores { 'my-thing': MyStore; }
}

export class MyStore implements DataStore {
    public readonly name = 'my-thing';
    public count = $state(0);
    public async loadData(app: HawkiApp) { /* fetch/hydrate; runs once on 'main' stage. Omit if no server data. */ }
}
```

Register from your plugin's `stores()` hook: `add(new MyStore())`. That's the whole wiring.

## Translations

```svelte
<script lang="ts">
    import {useTranslator} from '$lib/app/hooks/useTranslator.svelte.js';
    const {__} = useTranslator();
</script>
<textarea placeholder={__('chat.composer.textareaPlaceholder', {model: modelLabel})}></textarea>
```

`useTranslator()` returns a plain object — safe to destructure without losing `this`. In non-component code: `getHawkiApp().translator`.

- `__(label, replacements?, ignoreMissing?)` — primary function. `translate(...)` is an alias. Dot notation resolves nested keys. Missing key → logs warning + returns `"Missing translation: {label}"`; pass `ignoreMissing: true` for empty string instead.
- Replacements: `:name` (as-is), `:Name` (first letter uppercased), `:NAME` (fully uppercased) — all three substituted simultaneously, mirroring Laravel's `Translator::makeReplacements()`. Function value → replaces `<key>content</key>` with `fn(innerContent)` (wrap in HTML/components).
- `hasLabel(label)` — boolean; use to conditionally render optional UI.
- `getTranslations(label, ...)` — like `__` but allows non-string (returns nested object as-is).
- `getTranslationsFlat(path)` — flattens a nested label sub-tree into dot-notated `Record<string, string>` (for third-party libs expecting flat maps; used by `Markdown` for `markstream-svelte`).

Labels loaded automatically during `main` boot stage by `LocalizationExtension`. Active locale from connection. Add new labels server-side in `resources/lang/`.

## Hybrid Architecture: Snippets

Svelte is embedded into Blade via **snippets** — self-contained components mounted in server-rendered pages. Transitional toward full SPA; snippets become SPA building blocks.

Each snippet is its own separately mounted Svelte app — no shared Svelte component tree or Svelte context across snippets on the same page. Stores and the app cross snippet boundaries automatically (both resolve through the single `HawkiApp` instance assembled in `app.ts`).

### Embedding with `<x-svelte>`

```blade
<x-svelte type="ChatInput" />
<x-svelte type="ChatInput" :props="['readonly' => true]" class="my-class" />
```

`type` = filename inside `resources/js/plugins/core/snippets/` without `.svelte`. Props JSON-encoded automatically. Extra HTML attributes forwarded verbatim. `<svelte-snippet>` custom element defined by core plugin on `finalization` boot stage.

**Lifecycle:** mounted when element enters DOM, destroyed when it leaves, destroyed + remounted when `type`/`props` change. Treat snippets as stateless from outside — internal state resets on every remount.

### Adding a snippet

1. Create `resources/js/plugins/core/snippets/MyWidget.svelte`.
2. Use in Blade: `<x-svelte type="MyWidget" />`.

No imports/registrations needed — core plugin's `boot()` eager-globs `plugins/core/snippets/**/*.svelte`.

### The `root` prop

Every snippet auto-receives `root` — reference to the `<svelte-snippet>` DOM element. Use to read Blade-set HTML attributes or dispatch custom events to legacy vanilla-JS:

```svelte
<script lang="ts">
    import {HTMLSvelteSnippetElement} from '$lib/legacy/svelteSnippetLoader.js';
    interface Props { root: HTMLSvelteSnippetElement; }
    const {root}: Props = $props();
    function notifyLegacy(value: string) {
        root.dispatchEvent(new CustomEvent('myWidget:change', {detail: {value}, bubbles: true}));
    }
</script>
```

### `LegacySharedContent.svelte`

Special snippet auto-injected at top of every page during `late` boot stage. Hosts UI that must exist exactly once per page. Renders shared `Toaster`. Any page-level singleton UI belongs here, not in a regular snippet. Do not instantiate `Toaster` yourself — use `useToastContext()`.

## Styling: HAWKI Additions

Cascade layers, token reference, breakpoints, dark mode, and the component-local token pattern are in the `svelte` skill. HAWKI adds:

### Z-Index & Stacking

**Avoid ad-hoc `z-index`.** In a component ecosystem, hand-rolled stacking values break when two popovers or a modal-from-inside-a-tooltip combine. A global `--z-*` token ladder breaks the same way.

**The real fix is portals.** `Dialog`, `BottomSheet`, `Popover` teleport their DOM to a root-level container (`<body>`), escaping any ancestor stacking context. Use these portaled overlay components — don't roll `position: fixed` + `z-index`. Don't add `z-index` in your own component code to patch stacking. DOM ordering is a secondary aid only within a shared stacking context (many CSS props create new stacking contexts — `transform`, `opacity < 1`, `filter`, `isolation: isolate`, positioned `z-index`).

Only introduce `z-index` as a last resort, with a component-local token and a comment:

```css
.my-component {
    --my-component-z: 1;  /* document why 1 and what it sits above */
    z-index: var(--my-component-z);
}
```

Never bare numeric `z-index` or a global `--z-*` token ladder.

### Adding global styles

When a rule doesn't belong inside a Svelte `<style>` block (e.g. a modifier class the legacy Blade layer applies to affect Svelte rendering), add it in `resources/css/layers/` and import in `resources/css/app.css` under the appropriate `@layer`. Do not use `:global()` in Svelte components for cross-boundary rules — a `layers/` file is the correct home.

## UI Primitives

`components/ui/` — shadcn-style, no business logic, no app-state/domain-type deps. Compose into higher-level `components/`; snippets should not import directly from `ui/` unless trivially simple. Build on `bits-ui` primitives where one fits (accessibility + keyboard nav). Style with the token system — no Tailwind, no hardcoded values.

| Component(s) | Directory | Purpose |
|---|---|---|
| `Button`, `ButtonWithTooltip` | `ui/button/` | Standard button + button with attached tooltip |
| `Txt` | `ui/Txt.svelte` | Typography primitive with semantic variant prop |
| `Dialog`, `ConfirmDialog`, `InfoDialog` | `ui/dialog/` | Modal dialogs (generic, confirm, info) |
| `DropdownMenu` + items | `ui/dropdown-menu/` | Groups, separators, checkbox/radio/switch items |
| `Popover`, `InfoPopover` | `ui/popover/` | Floating popover + pre-styled info variant |
| `SingleSelect` | `ui/select/` | Styled single-value select |
| `BottomSheet` | `ui/sheet/` | Mobile-friendly bottom drawer (portaled) |
| `Slider` | `ui/slider/` | Range input |
| `Switch` | `ui/switch/` | Toggle switch |
| `Tabs` | `ui/tabs/` | Tab navigation |
| `Tooltip` | `ui/tooltip/` | Floating tooltip |
| `Toaster` + `ToastContext` | `ui/toast/` | Toast system — `useToastContext()`; `Toaster` rendered by `LegacySharedContent`, do not instantiate |
| `Badge` | `ui/badge/` | Label/badge chip |
| `RadialProgress` | `ui/radial-progress/` | Circular progress |
| `BorderBeam` | `ui/border-beam/` | Animated border highlight |
| `StatusDot` | `ui/status-dot/` | Colored status indicator |
| `Separator` | `ui/separator/` | Visual divider |
| `RadioCard`, `RadioCardGroup` | `ui/radio-card/` | Card-style radio group (spring-animated indicator, full ARIA) |
| `Citation`, `CitationList`, `CitationReference`, `CitationRoot` | `ui/citations/` | Web-search citation tiles + inline chips |

### Toasts

```svelte
<script lang="ts">
    import {useToastContext} from '$lib/components/ui/toast/ToastContext.svelte.js';
    const toast = useToastContext();
</script>
<button onclick={() => toast.success('Saved!')}>Save</button>
<button onclick={() => toast.error('Something went wrong.')}>Fail</button>
<button onclick={() => toast.info('Processing…')}>Info</button>
```

`ToastContext` is set up by the `LegacySharedContent` snippet (auto-injected on every page). Do not instantiate `Toaster` yourself.

### RadioCard

```svelte
<script lang="ts">
    import RadioCardGroup from '$lib/components/ui/radio-card/RadioCardGroup.svelte';
    import RadioCard from '$lib/components/ui/radio-card/RadioCard.svelte';
    let selected = $state('a');
</script>
<RadioCardGroup bind:value={selected} name="my-group">
    <RadioCard value="a">Option A</RadioCard>
    <RadioCard value="b">Option B</RadioCard>
    <RadioCard value="c" disabled>Option C (disabled)</RadioCard>
</RadioCardGroup>
```

### Citations

Four components wire together: `CitationRoot` (wraps message + citation area, sets up `CitationContext`), `CitationList` (renders "Sources" heading + tile grid, after message body), `Citation` (single source tile — favicon, domain, number; scrolls + flashes when chip clicked), `CitationReference` (inline chip in rendered markdown). `injectCitationsIntoMarkdown` pre-processes markdown, rewriting citation ranges into anchors that `ExtendedLinkNode` turns into `CitationReference` chips. `Citation` expects `EnrichedUrlCitation` (`{ url, title, ranges, identifier }`).

## Utility Components

`components/util/` — composable helpers, no business logic/app state.

### `Link` — accessible anchor

`components/util/link/Link.svelte` is the standard anchor. Use instead of bare `<a>` when you need auto `rel="noopener noreferrer"` on `target="_blank"`, a `disabled` state that blocks navigation without removing the element, or a consistent `disabled` class. All `HTMLAnchorAttributes` forwarded via rest-props.

```svelte
<Link href="/dashboard">Dashboard</Link>
<Link href="https://example.com" target="_blank">External (rel auto-set)</Link>
<Link href="/action" disabled>Disabled</Link>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `href` | `string` | `''` | Target; `javascript:void(0)` when empty or disabled. |
| `target` | `string` | `''` | Standard anchor `target`. |
| `rel` | `string` | `''` | Overrides auto `rel`. Defaults to `noopener noreferrer` on `_blank`. |
| `disabled` | `boolean` | `false` | Blocks navigation; adds `disabled` class. |
| `children` | `Snippet` | — | Link content. |

### `SnippetOrString` — polymorphic content props

Type polymorphic props (`label`, `description`, `error`) as `string | Snippet`. For one-off use, branch inline. When the pattern repeats across components, use `components/util/snippetOrString/SnippetOrString.svelte` (generic, accepts typed snippet args). `SnippetOrStringTrigger.svelte` is a companion for trigger elements inside dropdowns/popovers.

### `Breakpoint` — reactive viewport detection

`components/util/breakpoints/` exposes the current breakpoint as a reactive value for branches that affect component structure/behaviour (not just CSS).

```svelte
<script lang="ts">
    import {useBreakpoint} from '$lib/components/util/breakpoints/breakpoints.js';
    const bp = useBreakpoint();
</script>
{#if bp.isMobile}<BottomSheet>…</BottomSheet>{:else}<Popover>…</Popover>{/if}
```

Use CSS media queries (`--bp-*` custom media tokens) for purely visual adjustments. Use `Breakpoint` only when the branch affects structure/behaviour that CSS alone can't express.

### `Markdown` — message body renderer

`components/util/markdown/Markdown.svelte` wraps `markstream-svelte` with HAWKI extensions: KaTeX + Mermaid in web workers (non-blocking), `ExtendedLinkNode` routes links (`#citation-…` → `CitationReference` chip, other `#…` → smooth-scroll, external `http(s)` → `TextLink` with favicon + `UrlPreviewTooltip`, same-origin/`mailto:` → plain `TextLink`, other protocols → text only).

```svelte
<Markdown message={body} />
<Markdown message={partialBody} isStreaming={true} />
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | — | Raw markdown string. |
| `isStreaming` | `boolean` | `false` | Enables typewriter effect + incremental mode. |

Do not use `markstream-svelte`'s `MarkdownRender` directly — always use this wrapper.

## Icons

Hugeicons "Core Free" set, rendered as native Svelte components. Wrapper components under `components/ui/icons/iconset/` are **generated**, not hand-written. Import by Hugeicons name (PascalCase, `Icon` suffix):

```svelte
<script lang="ts">
    import ToolboxIcon from '$lib/components/ui/icons/iconset/ToolboxIcon.svelte';
</script>
<ToolboxIcon size={16} />
```

`iconset/` is **gitignored** (4000+ files) — generated on first `npm run dev`/`npm run build`. Never hand-edit; overwritten on regeneration. Browse available names on the Hugeicons site (free "stroke rounded" only).

Pass icons through props with the `IconComponent` type (`components/ui/icons/index.ts`) — pass the component reference itself, not a rendered element:

```svelte
<script lang="ts">
    import type {IconComponent} from '$lib/components/ui/icons/index.js';
    import Button from '$lib/components/ui/button/Button.svelte';
    import PlusSignIcon from '$lib/components/ui/icons/iconset/PlusSignIcon.svelte';
    interface Props { icon?: IconComponent; }
    const {icon: Icon}: Props = $props();
</script>
{#if Icon}<Icon class="my-icon" />{/if}
<Button iconLeft={PlusSignIcon}>Add</Button>
```

Prefer leaving `color` unset and controlling via CSS `color`. Each generated component forwards `size`, `color`, `strokeWidth`, `class`, and any `SVGAttributes`.

## Event System

No general-purpose event bus. Three purpose-built dispatcher classes, each enforcing a different execution contract at the TypeScript level. Source: `resources/js/utils/flows/`.

| Situation | Use |
|---|---|
| Handlers must complete synchronously — no Promises allowed | `SyncPipeline` |
| Handlers are async and must run one after another | `AsyncPipeline` |
| Handlers are async and can run concurrently (up to N at a time) | `ParallelAsyncWorkflow` |

All three: `on(type, handler)` registers (returns idempotent unsubscribe), `trigger(type, data?)` fires all registered handlers.

```ts
import {SyncPipeline} from '$lib/utils/flows/SyncPipeline.js';
interface Events { userLoggedIn: {userId: string}; userLoggedOut: void; }
const pipeline = new SyncPipeline<Events>();
const off = pipeline.on('userLoggedIn', ({userId}) => console.log(userId));
pipeline.trigger('userLoggedIn', {userId: '42'});
pipeline.triggerVoid('userLoggedOut');
off();
```

`SyncHandler` is `(data: TData) => void` — registering an `async` handler is a **TypeScript error** (eliminates the silent never-awaited bug). `AsyncPipeline` accepts `(data) => Promise<void> | void` and `await`s each in registration order. `ParallelAsyncWorkflow` extends `AsyncPipeline` with a sliding concurrency pool (default `chunkSize: 5`) — starts the next pending handler as soon as any running one resolves, not after the whole batch finishes. `trigger`/`triggerVoid` variants differ only in return type (data vs `void`/`Promise<void>`).

## Misc Utilities

`$lib/utils/` — small focused helpers.

- `debounce(func, wait)` (`utils/debounce.js`) — delays invoking until `wait` ms after last call.
- `buildStorageFileUrl(fileIdentifier)` (`utils/storageFileProxy.js`) — proxied URL for backend-stored files. Returns `null` when falsy.
- `getFileIconSvg(extension)` (`utils/fileIconSvg.js`) — `data:image/svg+xml,...` URL for a file-type icon; colour derived from extension.
- `growTransition` (`utils/transitions/growTransition.js`) — Svelte CSS transition animating height/width from 0. Params: `direction: 'in'|'out'` (default `'in'` — spring overshoot enter, cubicOut leave), `mode: 'vertical'|'horizontal'` (default `'vertical'`).
- `WithoutChild<T>`, `WithoutChildren<T>`, `WithoutChildrenOrChild<T>`, `WithElementRef<T, U>` (`utils/utils.js`) — bits-ui prop type helpers. `WithElementRef` adds optional `ref` binding.

## Keychain

User's encryption keys exposed reactively through the `keychain` store (`useStore('keychain')`). `publicKey`, `privateKey`, `aiConvKey` (all `CryptoKey | null`), `roomKeys` (`Record<string, RoomKeys>`), `waitingToLoad` (`Promise<void>` resolving once initial load completes). Loads asynchronously once the user's passkey becomes available — not on the `main` stage. Also exposes `validateKeychainPassword`, `initializeNewKeychain`, `createNewRoomKey(slug)`, `importRoomKey(slug, key)`. Lower-level handle: `kernel/keychain/keychainHandle.ts`. See [Encryption](references/kernel-extensions-plugins.md#encryption) for the crypto primitives.

## Advanced Topics

For rarely-needed details, see the reference files:

- **[Kernel, Extensions, Plugins, Encryption & Migrations](references/kernel-extensions-plugins.md)** — app assembly, `app.*` surface, declaration merging, boot stages, writing extensions/plugins, encryption modules (symmetric/asymmetric/hybrid), frontend migrations. Read when adding an app-wide subsystem, a plugin, working with crypto, or creating a migration.
- **[Composer & Legacy Bridge](references/composer-and-bridge.md)** — `ComposerContext` slices/modes/checkpointing/send pipeline, `OldUiBridge` event bus, `OldUiMessageHistory`, window globals. Read when working on the chat composer or bridging to legacy vanilla-JS.

Routing (`kernel/routing/`) is scaffolding for the SPA rewrite (v3.0.0) — not wired into the running app. `RoutingExtension` is registered in `app.ts` but the frontend still navigates through the legacy Blade layer. Plugins can declare a `routes()` hook but the kernel does not dispatch/render those routes yet.