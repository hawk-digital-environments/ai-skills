# Kernel, Extensions, Plugins, Encryption & Migrations

## Table of Contents

1. [App assembly](#app-assembly)
2. [The `app.*` surface](#the-app-surface)
3. [Declaration merging](#declaration-merging)
4. [Boot stages](#boot-stages)
5. [Extensions](#extensions)
6. [Plugins](#plugins)
7. [Encryption](#encryption)
8. [Frontend migrations](#frontend-migrations)

Sources: `resources/js/kernel/`, `resources/js/plugins/core/core.plugin.ts`.

---

## App assembly

`app.ts` creates a `Bootstrapper` and hands it + an ordered list of extensions to `createApp()`. Each extension's `init()` runs in array order; `provideProperties()` are merged onto the app object; then `ready()` runs on each. `bootstrapper.run()` executes six ordered boot stages.

```ts
// resources/js/app.ts
const bootstrapper = new Bootstrapper();
setHawkiApp(await createApp(bootstrapper, [
    new ResourceSchemaExtension(),   // 1. Zod schema registry (no deps)
    new ClientExtension(),            // 2. HTTP client + connection
    new PluginExtension(),            // 3. discovers & drives plugins
    new ConfigurationExtension(),     // 4. server config
    new MigrationExtension(),         // 5. frontend migrations
    new LocalizationExtension(),      // 6. locale + translator
    new ModuleExtension(),             // 7. feature-module registry
    new RoutingExtension(),            // 8. routing (not yet wired)
    new StoreExtension(),              // 9. data-store registry
    new SnippetExtension(),            // 10. legacy snippet registry (@deprecated)
    new LegacyToastExtension()         // 11. app-wide toast holder (@deprecated)
]));
await bootstrapper.run();
```

`init()` runs in array order — an extension may only reach extensions registered *before* it via `app.getOrFail('name')`. Reorder only when you understand the dependency chain.

---

## The `app.*` surface

Every property is contributed by an extension's `provideProperties()` and typed via declaration merging. Components reach these through hooks (`app/hooks/`), not by grabbing `app` directly.

| Property | Role | Provided by |
|---|---|---|
| `app.config` | Namespaced, Zod-validated server config | `ConfigurationExtension` |
| `app.client` | HTTP client bundle (restApi, connection) | `ClientExtension` |
| `app.restApi` | Typed JSON:API client | `ClientExtension` |
| `app.uriBuilder` | Builds API/asset/link-preview URIs | `ClientExtension` |
| `app.connection` | Current connection (discriminated union on `type`) | `ClientExtension` |
| `app.authenticatedConnection` | Connection narrowed to authenticated (throws otherwise) | `ClientExtension` |
| `app.connectionWithUserInfo` | Connection narrowed to authenticated or registering | `ClientExtension` |
| `app.linkPreviewApi` | Link-preview fetching | `ClientExtension` |
| `app.resourceSchemas` | Zod schema registry for JSON:API resources | `ResourceSchemaExtension` |
| `app.plugins` | Plugin registry + lifecycle driver | `PluginExtension` |
| `app.migration` | Frontend migration runner | `MigrationExtension` |
| `app.localization` | Active locale + loaded label sets | `LocalizationExtension` |
| `app.translator` | Ready `Translator` (`__`, `translate`, …) | `LocalizationExtension` |
| `app.modules` | Feature-module registry (`core:chat`, …) | `ModuleExtension` |
| `app.stores` | Data-store registry | `StoreExtension` |
| `app.snippets` | Named Svelte-component registry for legacy UI | `SnippetExtension` (`@deprecated`) |
| `app.toast` | App-wide `ToastContext` holder | `LegacyToastExtension` (`@deprecated`) |

`app.snippets` and `app.toast` are transitional bridges deleted once the SPA rewrite gives the page a single Svelte root.

---

## Declaration merging

`kernel/extendableTypes.ts` exports five **empty** interfaces. Each contributing module augments the relevant interface via `declare module` — this is the whole wiring step.

| Interface | Populated by | Keys become… |
|---|---|---|
| `HawkiAppExtensions` | every extension | properties on `app` |
| `HawkiConfigSchemas` | each config schema file | typed `app.config.get('namespace')` returns |
| `HawkiResourceSchemas` | each resource schema file | typed `app.restApi.getResource('ai-models')` returns |
| `HawkiDataStores` | each store class | typed `app.stores.get('theme')` / `useStore('theme')` |
| `HawkiPlugins` | each plugin class | typed `app.plugins.get('core')` |

`WithoutAppExtensionInternals<T>` strips `init`/`ready`/`provideProperties` so `app.yourName` exposes only the public API, not lifecycle plumbing.

---

## Boot stages

`bootstrapper.run()` is idempotent. Stages run in order; each fully resolves before the next begins.

```
preparation → migration → early → main → late → finalization
```

| Stage | What runs |
|---|---|
| `preparation` | `ClientExtension` fetches connection; `ConfigurationExtension` fetches config — concurrently. Everything else depends on both. |
| `migration` | *(currently unused — reserved)*. Frontend migrations run on demand via `app.migration.apply(runType)` after login/passkey. |
| `early` | *(currently unused — reserved)* |
| `main` | `StoreExtension` calls `loadData(app)` on every store; `LocalizationExtension` loads translation labels — concurrent. |
| `late` | `app.ts` injects `LegacySharedContent` snippet into the DOM. |
| `finalization` | Plugin `ready()` hooks; `app.ts` waits for `DOMContentLoaded`; core plugin defines `<svelte-snippet>` custom element. |

### Registering work in a stage

| Method | When | Execution |
|---|---|---|
| `onStageReached(stage, fn)` | Before stage starts | Serial |
| `onStage(stage, fn)` | During stage | Concurrent (max 3, sliding window) |
| `onStagePassed(stage, fn)` | After stage completes | Serial |

Named shorthands: `onPreparationStage`, `onMigrationStage`, `onEarlyStage`, `onMainStage`, `onLateStage`, `onFinalizationStage`.

Late registration (after the target timing passed) runs the handler immediately with a console warning — never silently dropped.

```ts
import {bootstrapper} from '$lib/kernel/Bootstrapper.js';
bootstrapper.onMainStage(async () => { await loadMyFeature(); });
```

---

## Extensions

An **extension** is a self-contained subsystem plugged into `HawkiApp` during startup. Add an extension only when the surface must live on `app.*` and be available to other extensions/plugins during assembly. Most features go in a plugin instead.

```ts
export type HawkiAppExtension = {
    /** Property descriptors merged onto the app object. Called once, right after init(). */
    provideProperties(): Record<string, any>;
    /** Runs while the app is still being assembled; may register bootstrapper hooks. */
    init?(app: UnfinishedHawkiApp, bootstrapper: Bootstrapper): void | Promise<void>;
    /** Runs once every extension has been added and the app is fully assembled. */
    ready?(app: HawkiApp, bootstrapper: Bootstrapper): void | Promise<void>;
};
```

- `init` — runs in array order. App is `UnfinishedHawkiApp`: later extensions unavailable. Reach earlier extensions with `app.getOrFail('name')`. Register boot-stage work here.
- `ready` — runs after every extension added; full `app` surface available.
- `provideProperties` — returns object whose keys become real properties on `app` (via getters resolving to the live extension instance). Called right after `init()`, before `ready()`.

Make the property typed by augmenting `HawkiAppExtensions` next to your class:

```ts
declare module '$lib/kernel/extendableTypes.js' {
    interface HawkiAppExtensions {
        myFeature: WithoutAppExtensionInternals<MyFeatureExtension>;
    }
}
```

Forgetting `WithoutAppExtensionInternals` leaks lifecycle methods onto `app.myFeature`. Never touch plugins from `provideProperties()` (runs before plugin `boot()`); only from `init()`/`ready()` via `app.getOrFail('plugins')`.

---

## Plugins

A **plugin** is HAWKI's unit of feature composition. Implements only the lifecycle hooks it needs; the kernel calls them at the right point in startup. Only **built-in** plugins are supported today (auto-discovered from `$lib/plugins/**/*.plugin.ts` via `import.meta.glob`, eager). Third-party runtime plugins are planned for v3.0.0.

```ts
export interface HawkiPlugin {
    readonly name: string;
    init?(context: HawkiPluginContext): void | Promise<void>;
    extensions?(registrar: AppExtensionRegistrar, context): void | Promise<void>;
    resourceSchemas?(registrar, context): void | Promise<void>;
    configSchemas?(registrar, context): void | Promise<void>;
    modules?(registrar, context: HawkiPluginContextWithConfig): void | Promise<void>;
    routes?(registrar, context: HawkiPluginContextWithConfig): void | Promise<void>;
    stores?(registrar, context: HawkiPluginContextWithConfig): void | Promise<void>;
    boot?(app: HawkiApp, context: HawkiPluginContextWithConfig): void | Promise<void>;
    ready?(app: HawkiApp, context: HawkiPluginContextWithConfig): void | Promise<void>;
}
// HawkiCorePlugin additionally may register migrations.
```

`HawkiPluginContext` = `{ client, bootstrapper, plugins }` (early hooks). `HawkiPluginContextWithConfig` = that plus `config` (later hooks).

| Hook | Called by | When |
|---|---|---|
| `init` | `PluginExtension.init()` | first, before app extensions/schemas exist |
| `extensions` | `PluginExtension.init()` | right after `init` — register further `HawkiAppExtension`s |
| `resourceSchemas` | `PluginExtension.init()` | during assembly |
| `configSchemas` | `ConfigurationExtension.init()` | during assembly |
| `modules` | `ModuleExtension.init()` | during assembly |
| `stores` | `StoreExtension.init()` | during assembly |
| `migrations` | `MigrationExtension` | core plugins only |
| `boot` | `PluginExtension.ready()` | after `preparation` (config+connection available; stores not loaded) |
| `ready` | `PluginExtension.ready()` | at `finalization`, just before Svelte app mounts |

Stores registered in `stores()` have `loadData(app)` called automatically on the `main` stage.

Make `app.plugins.get('myPlugin')` typed by augmenting `HawkiPlugins` next to your class.

### Minimal plugin

```ts
// resources/js/plugins/myPlugin/myPlugin.plugin.ts
import type {HawkiPlugin, HawkiPluginContextWithConfig} from '$lib/kernel/plugins/types.js';
import type {StoreRegistrar} from '$lib/kernel/stores/storeRegistrar.js';
import {MyStore} from './stores/MyStore.svelte.js';

declare module '$lib/kernel/extendableTypes.js' {
    interface HawkiPlugins { myPlugin: MyPlugin; }
}

export default class MyPlugin implements HawkiPlugin {
    readonly name = 'myPlugin';
    public stores({add}: StoreRegistrar): void | Promise<void> { add(new MyStore()); }
    public ready(app: HawkiApp, ctx: HawkiPluginContextWithConfig): void | Promise<void> {}
}
```

Discovery rules: file matches `$lib/plugins/**/*.plugin.ts`, `export default` a class implementing `HawkiPlugin`/`HawkiCorePlugin`, non-empty string `name`. Duplicate names skipped with warning. A hook that throws is caught and logged; kernel continues.

### Registering snippets (core plugin pattern)

```ts
public boot(app: HawkiApp, ctx): void | Promise<void> {
    const glob = import.meta.glob('$lib/plugins/core/snippets/**/*.svelte', {eager: true});
    for (const [path, module] of Object.entries(glob)) {
        const snippetName = path.split('/').pop()?.replace('.svelte', '');
        if (snippetName) app.snippets.register(snippetName, (module as {default: Component}).default);
    }
}
```

---

## Encryption

Browser-native **Web Crypto API** wrapped in `resources/js/kernel/encryption/`. Wire-compatible with PHP `hawki-crypto` value objects — a value encrypted in-browser can be decrypted server-side untransformed. **Never call `window.crypto.subtle` directly** — use these helpers.

| Scenario | Module |
|---|---|
| Both sides share same key (e.g. derived from passkey) | `symmetric.ts` |
| Encrypt short value (typically an AES key) for an RSA public key | `asymmetric.ts` |
| Encrypt arbitrary-length plaintext for an RSA public key | `hybrid.ts` |

RSA primitives in `asymmetric.ts` have a hard limit (~446 bytes for 4096-bit/SHA-256). Always use `hybrid.ts` when plaintext length is unbounded.

### Symmetric (AES-256-GCM, 12-byte IV, 16-byte tag)

```ts
import {generateSymmetricKey, encryptSymmetric, decryptSymmetric, loadSymmetricCryptoValue} from '$lib/kernel/encryption/symmetric.js';
const key = await generateSymmetricKey();
const encrypted = await encryptSymmetric('hello', key);
const stored = encrypted.toString();           // "base64(iv)|base64(tag)|base64(ciphertext)"
const plaintext = await decryptSymmetric(loadSymmetricCryptoValue(stored), key);
```

Key wrapping: `encryptKeySymmetric(cryptoKey, aesKey)` / `decryptKeySymmetric(value, aesKey)`. Loaders for JSON and separate-string formats also exist.

### Asymmetric (RSA-OAEP 4096-bit, SHA-256)

```ts
import {generateAsymmetricKeyPair, exportPublicKeyToString, exportPrivateKeyToString, loadPublicKey, loadPrivateKey, encryptAsymmetric, decryptAsymmetric} from '$lib/kernel/encryption/asymmetric.js';
const {publicKey, privateKey} = await generateAsymmetricKeyPair();
const pubBase64 = await exportPublicKeyToString(publicKey);   // SPKI base64
const privBase64 = await exportPrivateKeyToString(privateKey); // PKCS#8 base64
const pubKey = await loadPublicKey(serverPubBase64);   // extractable: false by default
const ciphertext = await encryptAsymmetric('short value', pubKey); // base64 string
const plaintext = await decryptAsymmetric(ciphertext, privKey);
```

Key wrapping: `encryptKeyAsymmetric(aesKey, pubKey)` / `decryptKeyAsymmetric(base64, privKey)` — returned `CryptoKey` ready for symmetric ops.

### Hybrid (RSA-OAEP + AES-256-GCM)

Correct module for user data readable by an RSA private key holder. Generates a fresh AES key per operation, encrypts plaintext with it, then encrypts the AES key with the recipient's RSA public key.

```ts
import {encryptHybrid, decryptHybrid, loadHybridCryptoValue} from '$lib/kernel/encryption/hybrid.js';
const encrypted = await encryptHybrid('secret data', pubKey);
const stored = encrypted.toString(); // "base64(encryptedAesKey)|base64(symmetricPayload)"
const plaintext = await decryptHybrid(loadHybridCryptoValue(stored), privKey);
```

### Key derivation (`utils.ts`)

`deriveKey(passkey, label, salt)` — PBKDF2 100 000 iterations, SHA-256. The `label` is concatenated with the server salt, so the same passkey with different labels produces independent keys (safe to derive separate keys per purpose from one passkey). Always pass the server salt from connection config to prevent offline dictionary attacks. Feature code should not import `utils.ts` directly — it's used internally.

---

## Frontend migrations

One-time JS scripts run in the browser to transform/re-key locally-stored or encrypted data. Necessary when encryption formats change or user-data structures update in ways the server can't handle (server never has plaintext). Spans PHP backend (Laravel migration registers + builds per-user payloads) and TS frontend (actual in-browser transformation).

### Run types

Inferred from the **directory** under `resources/js/plugins/core/migrations/`:

| Directory | Run type | When |
|---|---|---|
| `migrations/` (direct) | `after_login` | Default — as soon as user authenticates |
| `migrations/after_passkey/` | `after_passkey` | After passkey verified (needs key material) |
| `migrations/my_type/` | `my_type` | Custom — caller must trigger `applyMigrations('my_type')` |

Migrations are a `HawkiCorePlugin` hook — third-party plugins cannot register them.

### Creating one

```bash
bin/env artisan make:frontend-migration your_migration_name
```

Scaffolds a Laravel DB migration + a JS file. Run `php artisan migrate` after creation so the backend records the migration and builds per-user payloads.

### Writing the JS file

Export a single async `migrate` function. `MigrationContext` provides run type, name, the fully-assembled `HawkiApp` (reach config, stores, restApi, keychain), and the optional server payload.

```ts
import type {MigrationContext} from '$lib/kernel/migrations/MigrationExtension.js';

export async function migrate({name, data, app}: MigrationContext): Promise<void> {
    if (!data) return;                      // new users may have no legacy data
    // Transform data. Use app.config.get(), app.stores.get('keychain'), app.restApi, encryption helpers.
}
```

Failed migrations are **not** marked applied on the server — retried next `applyMigrations` call. Write migrations idempotent: guard against already-migrated state at the start. `after_passkey` run type is essential when the passkey is required (available only after passkey verification, not at `after_login`).

### Backend `userDataFinder`

The Laravel migration calls `FrontendMigrationBuilder::register(migrationName:, userDataFinder:)`. The closure runs once per existing user during `php artisan migrate` and returns the array that becomes `ctx.data`. Return `null`/`false` to skip a user. The entire `register()` call is atomic.