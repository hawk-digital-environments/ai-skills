---
name: hawki-backend
description: "[ REQUIRES 'laravel' skill! ] HAWKI coding standards and architecture patterns. Use when writing or reviewing PHP code for HAWKI, creating new classes/services, or when asked about project structure, DDD patterns, or code conventions."
---

> ONLY CONTINUE IF THE `laravel` SKILL IS AVAILABLE.
> This skill builds on top of the `laravel` skill, it is imperative that you have read and understood the `laravel` skill before continuing. If you don't have the `laravel` skill available, report an error: "The `laravel` skill is required for the `hawki-backend` skill."

> **Note:** The current codebase may not fully follow these guidelines — folder names are inconsistent and some naming conventions are mid-migration. Follow these rules in all new code and refactor old code toward them when possible.

## HAWKI-Specific Architecture

Follow the `laravel` skill for general DDD patterns. HAWKI additions:

**`Providers/` structural namespace** — external provider integrations (e.g. `Auth/Providers/Ldap/LdapAuthProvider.php`). Internal implementations of a contract; no `@api`.

**Listener auto-discovery** — no manual registration needed. The bootstrap auto-discovers listeners from `App\Services\{Domain}\Listeners\`.

## HAWKI Utility Classes

### `App\Utils\ServiceLocatorTrait`

Use in API Resources when constructor injection is unavailable (see `laravel` skill for when/why). HAWKI-specific test API:

```php
// Production
class MessageResource extends JsonResource {
    use ServiceLocatorTrait;
    public function toArray(Request $request): array {
        return ['text' => $this->getServiceInstance(FormatterService::class)->format($this->text)];
    }
}

// Test — inject mocks; throw on any unset service to catch accidental container fallthrough
$resource = new MessageResource($model);
$resource->setFailOnMissingLocalService(true);
$resource->setService(FormatterService::class, $mockFormatter);
```

### `App\Events\Traits\DispatchableFilter`

Use instead of `Dispatchable` for filter events (see `laravel` skill for filter event rules). Returns the event instance from `dispatch()` so callers read mutated state immediately:

```php
class ModelPermissionFilterEvent {
    use DispatchableFilter; // App\Events\Traits\DispatchableFilter
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

Use in `@api` service decorators. Copies all constructor-injected properties from the original instance via reflection — no constructor call, no double-wiring:

```php
class DecoratedAiService extends AiService {
    use DecoratorTrait; // App\Utils\DecoratorTrait
    public function getModels(): AiModelCollection {
        return $this->filter(parent::getModels());
    }
}

$this->app->extend(AiService::class, fn($orig) => DecoratedAiService::createDecoratedOf($orig));
```

## Additional DI Injections

Beyond what the `laravel` skill documents:

| Need | How                                        |
|------|--------------------------------------------|
| Mail | `Illuminate\Contracts\Mail\Mailer $mailer` |

## Code Style

HAWKI follows **PSR-12**. Run before every commit:

```bash
bin/env style php          # in Docker
composer run php-cs-fixer  # locally
```

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

**PHPStan** — fix all errors; suppress only genuine false positives in third-party code:

```bash
bin/env test php stan      # in Docker
composer run test:stan     # locally
```

**Run tests:**

```bash
bin/env test php unit      # unit only, in Docker
composer run test:unit     # unit only, locally
bin/env test php feature   # feature only, in Docker
bin/env test php all       # all suites, in Docker
```
