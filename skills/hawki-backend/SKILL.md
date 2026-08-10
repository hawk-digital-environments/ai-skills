---
name: hawki-backend
description: "[ REQUIRES 'laravel' skill! ] HAWKI coding standards and architecture patterns. Use when writing or reviewing PHP code for HAWKI, creating new classes/services, or when asked about project structure, DDD patterns, or code conventions."
---

> ONLY CONTINUE IF THE `laravel` SKILL IS AVAILABLE.
> This skill builds on top of the `laravel` skill, it is imperative that you have read and understood the `laravel` skill before continuing. If you don't have the `laravel` skill available, report an error: "The `laravel` skill is required for the `hawki-backend` skill."

> **Note:** The current codebase may not fully follow these guidelines — folder names are inconsistent and some naming conventions are mid-migration. Follow these rules in all new code and refactor old code toward them when possible. See the Technical Debt Register (`_documentation/500-Backend/100-Architecture/300-Technical-Debt.md`) for known violations; **never copy patterns from listed classes**.

## Stack

Laravel 13 / PHP 8.3. Transitioning from server-rendered MVC to a pure API server for a Svelte 5 SPA. New work targets the API layer; Blade routes still exist but are read-only except the page shell.

## Code Style

Follow **PER Coding Style** (the modern successor to PSR-12). Full spec in the bundled reference: [`assets/per_coding-style.md`](assets/per_coding-style.md). Run before every commit:

```bash
bin/env style php          # in Docker
composer run php-cs-fixer  # locally
```

## Request Context (HAWKI-Specific)

Two request-scoped singletons populated by `SystemContextBootingMiddleware` before any controller runs. Inject via constructor — never call `Auth::user()` or `Auth::id()` in services.

**`UserContext`** (`App\Services\System\UserTypes\UserContext`) — **WHO** is calling. `WellKnownUserTypes`: `GUEST` (default), `REGISTERING_USER`, `USER`, `EXTERNAL_APP`. A `set()` that changes the type dispatches `UserTypeChangedEvent` synchronously.

**`UsageContext`** (`App\Services\System\UsageTypes\UsageContext`) — **WHAT surface**: `MAIN_APP` (default) or `EXTERNAL_APP`. Contextual scopes and AI dispatch read this to apply the right filtering.

In controllers, resolve the authenticated user via the `#[CurrentUser]` contextual attribute, not `Auth::user()`.

## JSON:API Surface

Main API at `/api/hawki/v1`, built on `laravel-json-api/laravel`. Schemas live in `app/JsonApi/V1/`, serializers in `app/Http/Resources/`. 20 registered schemas (see `_documentation/500-Backend/300-JSON-API.md` for the inventory).

Conventions:
- `authorizable(): false` on most schemas — HAWKI handles auth at the middleware layer (`UserContext`/`UsageContext`); row-level access uses Eloquent query scopes (`BelongsToUserScope`, `RoomAccessScope`), not schema policies.
- `PagePagination` is standard; default page sizes per-resource in the schema class.
- Custom actions: `POST .../actions/{action-name}`.
- `ServiceLocatorTrait` is permitted **only** in JSON:API resource + schema classes. Never in services, models, or repositories.
- `_hawki_sync_log` meta slot auto-injected on mutating responses (currently empty; SyncLog system is designed but disabled until v3).
- `ApiRequestMigrator` translates legacy v2 request shapes transparently — don't touch for new features.

## HAWKI Utility Classes

### `App\Utils\ServiceLocatorTrait`

Use in API Resources when constructor injection is unavailable (laravel-json-api instantiates outside the container). HAWKI-specific test API:

```php
// Production
class MessageResource extends JsonResource {
    use ServiceLocatorTrait;
    public function toArray(Request $request): array {
        return ['text' => $this->getService(FormatterService::class)->format($this->text)];
    }
}

// Test — inject mocks; PHPUnit auto-disables container fallback so missing mocks throw
$resource = new MessageResource($model);
$resource->useServiceContainerFallback(false);
$resource->setService(FormatterService::class, $mockFormatter);
```

### `App\Events\Traits\DispatchableFilter`

Use instead of `Dispatchable` for filter events (see `laravel` skill for filter event rules). Returns the event instance from `dispatch()` so callers read mutated state immediately. Never `ShouldBroadcast` or `ShouldQueue` — always synchronous.

```php
class ModelPermissionFilterEvent {
    use DispatchableFilter;
    private bool $allowed;
    public function __construct(
        private readonly User $user,
        private readonly AiModel $model,
        bool $allowed = true,
    ) { $this->allowed = $allowed; }
    public function getUser(): User { return $this->user; }
    public function getModel(): AiModel { return $this->model; }
    public function isAllowed(): bool { return $this->allowed; }
    public function setAllowed(bool $allowed): void { $this->allowed = $allowed; }
}

$isAllowed = ModelPermissionFilterEvent::dispatch($user, $model)->isAllowed();
```

### `App\Utils\DecoratorTrait`

Use in `@api` service Decorators. Copies all constructor-injected public/protected properties from the original via reflection — no constructor call, no double-wiring. Cannot copy `private` properties; call only `public`/`protected` methods from the decorator.

```php
class DecoratedAiService extends AiService {
    use DecoratorTrait;
    public function getModels(): AiModelCollection {
        return $this->filter(parent::getModels());
    }
}

$this->app->extend(AiService::class, fn($orig) => DecoratedAiService::createDecoratedOf($orig));
```

### `App\Services\System\Time\CarbonClockInterface`

Extends PSR-20 `Psr\Clock\ClockInterface` but types `now()` to return `CarbonImmutable`. Inject this (not the PSR interface) in HAWKI services for Carbon's API without a cast. Use `Psr\Clock\ClockInterface` only when a class must stay framework/PSR-agnostic. Both bind to the same `CarbonClock` singleton.

### `App\Utils\Casts\AbstractCastableObject`

Reflection-based base for typed, serializable value objects hydrated from/persisted to flat string maps (DB rows, config). Extend and declare `public` typed properties; scalar, array, enum, date, encrypted, and nested-castable types auto-handled. Use `fromStringArray()` / `toStringArray()`. Add `#[CastedValue(...]` only when auto-inference fails. Base for `AbstractConfig` (public config blocks) and provider-settings value objects.

**HAWKI Eloquent casts** (in `app/Casts/`):

| Cast | Purpose |
|---|---|
| `AsInstance` | Generic for `CastableInstanceInterface` (`fromArray()`/`toArray()`) |
| `AsLocale` | DB string → `Locale` value object via `LocaleService::getMostLikelyLocale()` |
| `AsAsymmetricPublicKeyCast` | Transparent asymmetric public-key encrypt/decrypt |
| `AsHybridCryptoValueCast` | Transparent hybrid (AES key + RSA wrapping) encrypt/decrypt |
| `AsSymmetricCryptoValueCast` | Transparent symmetric AES-GCM encrypt/decrypt |

## Contextual Scopes (HAWKI-Specific)

`HasContextualScopesTrait` on Eloquent models enables per-query scope control without leaking state. Models declare scopes via `registerScopes(ScopeRegistrar $registrar)`. Bypass via sandboxed API in a repository:

```php
AiModel::scopeContext()->runSandboxed(function (ModelScopeContext $ctx): void {
    $ctx->disableScope('active_filter');
    $allModels = AiModel::all();
}); // scope state auto-restored after
```

`AbstractRepository` (`App\Services\System\Database\Eloquent\Repositories\AbstractRepository`) is the base for all repositories — `#[Singleton]`, resolves its model by stripping the `Repository` suffix. Use `#[UseModel(MyModel::class)]` when names don't match. `AbstractRepositoryWithContextualScopes` adds `runWithScopeDisabled(key, Closure)`.

Currently registered: `AiModel` (`active_filter`, `usage_type_filter`), `AiProvider` (`active_filter`), `AiModelDescription` (`locale_aware`), `AiTool` (`active_filter`), `Room` (`RoomAccessScope`).

## Extension Points (Plugin Groundwork)

Register in a `ServiceProvider::boot()` via `$app->extend()`. These are the stable surface the v3 plugin system builds on.

| Extension point | How |
|---|---|
| `ProviderAdapterRegistry::declare()` | `$r->declare('key', MyAdapter::class)` — new AI provider adapter (`@api`) |
| `AgentRegistry::declare()` | `$r->declare(MyFactory::class, before: ..., after: ...)` — custom agent factory |
| `AiModelSettingRegistry` | `$r->register('key', defaultValue: ..., ...)` — per-model runtime toggle |
| `AiModelCapabilityRegistry` | `$r->declare(key, titleLabel, descLabel, iconPath)` — capability + UI metadata |
| `PublicConfigRegistry` | `$r->register(MyConfigBlock::class)` — add a `configs` resource block |
| `ToolInterface::class` tag | `$app->tag([MyTool::class], ToolInterface::class)` in `register()` — function tool |
| `HealthCheckEvent::addResult()` | Listener injects custom health check result |
| `DecoratorTrait` + `$app->extend()` | Wrap any `@api` service |
| Filter events | Listener on any `...FilterEvent` intercepts a pipeline |
| Event auto-discovery | Listeners in `app/Services/*/Listeners/` auto-discovered — no manual registration |

## AI Service Layer

Most complex domain. Built on `laravel/ai` SDK. **Class hierarchy (bottom-up):**

1. `AgentInterface` (`App\Services\Ai\Agents\Contracts\`) — HAWKI's contract: `getContext()`, `getUsage()`, `send()`, `sendStreaming()`.
2. `AbstractLaravelAgent` — bridges to Laravel AI's `Agent` contract + `Promptable` trait. Fires domain events: `AgentSendingEvent`, `AgentResponseReceivedEvent`, `AgentStreamInitiatedEvent`, `AgentStreamCompletedEvent`.
3. `AbstractTextGeneratingAgent` — conversational layer (`Conversational`, `HasTools`, `HasProviderOptions`, `HasMiddleware`). Pops last `UserMessage` as the prompt; wraps system instructions via `MessageMetaBlocks::wrapInstructions()` (HKI_META preamble).
4. `ChatAgent` — thin concrete subclass.

`AgentRegistry` (`#[Singleton]`) iterates `AgentFactoryInterface` classes in topological order; a factory returns `null` to decline. `AbstractAgentFactory` provides `createRequestContext()`. Built-in: `ChatAgentFromLegacyRequestFactory`.

`ProviderAdapterInterface` (8 methods) — bridge to a provider (OpenAI, Anthropic, Gemini, etc.). `AbstractProviderAdapter` gives no-op defaults. `ProviderAdapterRegistry` maps string keys → adapter classes via `LazySingletonList`. `DriverFactory` merges config layers. `ProviderDriverPortal` is a one-shot static transfer registry: passes a pre-built `Driver` through the SDK's string-only `provider` param. `ExtendedAiManager` retrieves it without re-resolution; `getDefaultInstance()` throws (no global default).

`AlternatingMessageHistory` merges consecutive same-role messages with `[[MESSAGE BOUNDARY]]` separator (no empty placeholder messages). `HKI_META_MESSAGE_BOUNDARY` block explains the merge to the model.

Tool filter events for intercept/mock: `BeforeCallingMcpToolFilterEvent` (essential for testing without a real MCP server), `ToolByNameResolvedFilterEvent`, `ToolForCapabilityResolvedFilterEvent`, `NativeToolResolvedFilterEvent`, `McpToolCalledFilterEvent`.

## Auth

`ChainedAuthService` (registered as `AuthServiceInterface`) holds an ordered provider list; first success wins. Config: `AUTHENTICATION_METHOD` (`LDAP`, `Shibboleth`, `OIDC`, or FQCN). Built-ins: `LdapService`, `OidcService`, `ShibbolethService`, `TestAuthService` (dev only via `TEST_USERS_ACTIVE=true`).

`AuthServiceInterface::authenticate(Request): AuthenticatedUserInfo|Response`. Mixin interfaces for extra capabilities: `AuthServiceWithCredentialsInterface`, `AuthServiceWithLogoutRedirectInterface`, `AuthServiceWithPostProcessingInterface`. `AuthenticatedUserInfo` is a `readonly` VO: `username`, `displayName`, `email`, `employeeType`.

First-login users get `UserContext = REGISTERING_USER`; the `/handshake` Blade flow runs client-side key generation, then subsequent logins resolve to `USER`.

## Storage

Security property: **no direct storage URLs are ever exposed to clients**. All file access goes through `StorageProxyController` (`GET /proxy/storage/{identifier}`), which checks access and streams with ETag caching.

`StoredFileIdentifier` (`App\Services\Storage\Values\`) — format `{category}-{uuid}[.{ext}]`. Factory methods: `fromString()`, `tryFromUserAvatar()`, `tryFromRoomAvatar()`, `fromCategoryAndFilename()`, `fromCategoryAndUuid()`. `StoredFileCategory` enum: `ROOM_AVATAR`, `PROFILE_AVATAR`, `GROUP`, `PRIVATE` (the value is the top-level disk directory).

Two-step upload: client uploads → `FileStorageService::storeTemporary()` lands in `temp/{category}/...` → on message send, `persistTemporaryFile()` moves to permanent storage → `AttachmentRepository::assignToMessage()`. `filestorage:cleanup` removes temp files older than 5 min and soft-deleted attachments (6-month retention).

Files use 4-level UUID sharding. Only `pdf`, `doc`, `docx`, `jpg`, `jpeg`, `png`, `gif` keep their extension on disk; all others get `.blob` (original ext in `.meta.json` sidecar, restored on serve). `FileStorageService` enables content extraction; `AvatarStorageService` disables it (2 MB limit). `FileConverterInterface` (pluggable via `config/file_converter.php`) extracts text for AI context.

## Encryption (Three Tiers)

Client-first model: server stores ciphertext blobs, never plaintext.

| Tier | Algorithm | Use | Wire format |
|---|---|---|---|
| Symmetric | AES-256-GCM (random 12-byte IV) | Room messages, AI-convs, keychain | `base64(iv)\|base64(tag)\|base64(ciphertext)` |
| Asymmetric | RSA-OAEP-4096 | Key distribution (encrypt sym key for one recipient) | PEM public key in `user_keychain_values` |
| Hybrid | AES key + RSA wrapping | Large data only server decrypts (ext-app secrets) | `base64(encryptedAesKey)\|base64(symmetricPayload)` |

`SaltProvider` (`App\Services\Encryption\SaltProvider`) — single source for server-side salts. `SaltType` enum: `USERDATA`, `INVITATION`, `AI`, `PASSKEY`, `BACKUP`. **Production: all five salt env vars must be set to random independent values before the first `php artisan migrate`.** Re-seeding salts after migration invalidates all encrypted records. Frontend fetches salts via the `crypto_salt` config block in connection bootstrap.

Model casts: `AsSymmetricCryptoValueCast`, `AsAsymmetricPublicKeyCast`, `AsHybridCryptoValueCast` (see Utility Classes).

## Cross-Cutting Rules

- **SSRF**: All outbound HTTP must use `Http::getSsrfSafe()` (registered by `SsrfSafeGetterMacro`), not `Http::get()`. Validates every URL + redirect hop against a public-IP allowlist.
- **Translation**: `TranslationServiceProvider` replaces Laravel's; `CustomTranslator` is the `translator` binding so `__()`/`trans()` work unchanged. `LocaleService` (`#[Singleton]`) resolves locale via session → `lastLanguage_cookie` → `config('app.locale')` (NOT `Accept-Language`). Add keys to `resources/lang/{locale}/*.json`. Frontend fetches via `GET /translation-labels/{locale}`.
- **Frontend migrations**: When a schema change requires transforming client-encrypted data, use `php artisan make:frontend-migration <name>` (creates a PHP + TS file pair). PHP `up()` calls `FrontendMigrator::register(migrationName: __FILE__, userDataFinder: Closure(User): array|null)`. `down()` must always throw. Run types: `AFTER_LOGIN` or `AFTER_PASSKEY`. Write migrations idempotent.

## Additional DI Injections

Beyond what the `laravel` skill documents:

| Need | How |
|---|---|
| Mail | `Illuminate\Contracts\Mail\Mailer $mailer` |
| Current time | `App\Services\System\Time\CarbonClockInterface $clock` (prefer over PSR interface) |
| Current user (controllers) | `#[CurrentUser] private readonly User $currentUser` |

## Testing

HAWKI-specific conventions (PHPUnit itself is covered by the `phpunit` skill).

**Namespaces** — mirror `app/` under `tests/`:
- Unit: `Tests\Unit\{mirrored namespace}`
- Feature: `Tests\Feature\{relevant sub-namespace}`

**Test methods:**
- Name: `testIt...` with `void` return — `testItConstructs`, `testItCanRetrieveXy`
- Class under test: always named `$sut`
- Always include `testItConstructs` when the class has constructor args
- Assertions: `static::assertSame()` not `$this->assertSame()`
- When expecting exceptions, also assert the message; mirror the `sprintf` pattern from the source class
- Section dividers: `// =========================================================================` between logical sections

**Coverage** — always annotate with attributes from `PHPUnit\Framework\Attributes`. Never tag interfaces:

```php
#[CoversClass(MyClass::class)]
#[CoversTrait(MyTrait::class)]
#[CoversMethod(MyClass::class, 'methodName')]
```

**Data providers:**

```php
public static function provideTestItDoesSomethingData(): iterable {
    yield 'descriptive label' => ['value1', 'value2'];
}
```

**Fixtures** — one file per fixture, in a sub-namespace beside the test class:
`MyClassTest/MyClassTestFixtures/MyFixtureStub.php`

**Anti-patterns to avoid:** testing private methods via reflection · over-mocking · hardcoding absolute file paths · test methods longer than ~20 lines.

**Commands:**

```bash
bin/env test php unit      # unit only, in Docker
composer run test:unit     # unit only, locally
bin/env test php feature   # feature only, in Docker
bin/env test php all       # all suites, in Docker
bin/env test php stan      # PHPStan, in Docker
composer run test:stan     # PHPStan, locally
```

PHPStan — fix all errors; suppress only genuine false positives in third-party code.
