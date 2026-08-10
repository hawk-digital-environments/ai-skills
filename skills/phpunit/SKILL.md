---
name: PHPUnit Testing
description: Comprehensive PHP testing with PHPUnit covering assertions, data providers, mocking, test doubles, database testing, and HTTP testing for reliable PHP application development.
version: 1.0.0
tags: [ phpunit, php, unit-testing, mocking, data-providers, test-doubles, assertions, tdd ]
testingTypes: [ unit, integration ]
frameworks: [ phpunit ]
languages: [ php ]
domains: [ web, api, backend ]
---

## Core Principles

1. **Test behavior, not implementation** -- Verify what the code does from a caller's perspective, not how it achieves the result internally.
2. **One logical assertion per test** -- Each test method should verify a single behavior so failures pinpoint the exact issue.
3. **Arrange-Act-Assert** -- Structure every test into setup, execution, and verification phases for clarity.
4. **Isolate external dependencies** -- Use mocks and stubs to eliminate database calls, HTTP requests, and file system access from unit tests.
5. **Use data providers for parameterization** -- Leverage `#[DataProvider]` to test multiple input/output combinations without duplicating test methods.
6. **Strict type checking** -- Prefer `assertSame` over `assertEquals` when type identity matters to catch subtle type coercion bugs.
7. **Never run tests yourself** -- This is the humans job, they should review and validate what you did. Be insistent on this.

> The MOST important principle: If you, while writing tests should encounter bugs in the code, find passages of code that give you a hard time and you have to jump through hoops to write good tests: STOP everything you do and tell the user about your issues; explain to the user, give possible solutions and only continue if explicitly told so.

## General Rules:

- Each test method name must start with `testIt...` (e.g. testItConstructs, testItCanRetrieveValueXy).
- Every reference on the class to test must be called "sut" for "system under test".
- If expecting that exceptions are thrown ensure that the exception message matches.
- If exception messages are generated using the sprintf function keep a similar syntax for the test.
- Each test method must have a void return type.
- When generating a namespace for the test class, determine if a unit-test or a feature/integration test is needed. For unit tests, the namespace should be the same as the class being tested with "Tests\Unit" as a prefix. For feature/integration tests, the namespace should be "Tests\Feature" followed by the relevant sub-namespace based on the class being tested.
- IF an explicit file name was given to you, assume you are updating/extending an existing test. Keep the current structure including the namespace.
- Always ensure to use the `#[CoversClass]`, `#[CoversFunction]`, `#[CoversMethod]`, `#[CoversTrait]` attributes to specify what is being covered by the test. If the test method covers multiple methods/functions/classes/traits, use multiple attributes. Important: Interfaces are never explicitly tagged with `#[CoversClass]`.
- If the sut receives constructor parameters ensure to create a single test method called "testItConstructs" that only tests if an instance of the object can be created.
- When writing data providers that are only used for a single test method (e.g. testItDoesSomething) name them: `provideTestItDoesSomethingData` with the data provider name being a valid camelBack again.
- Data providers should return a generator instead of an array, so the return type is `iterable` and the options are returned as `yield 'label' => ['values'];`
- When using phpunit methods, keep in mind that most of them are "static", so use `static::assertSame()` and not `$this->assertSame()`
- When creating fixtures always create them as separate files. Create a single file per fixture. Place the fixtures in a sub-namespace besides the actual test class. Lets say your test class is named: `MyClassXyTest`, create a new namespace `$classNamespace\MyClassXyTestFixtures` and place all fixtures below.
- Mocks vs Stubs: When you need to verify that a method was called with specific parameters, use a Mock. When you just need to provide canned responses without verification, use a Stub. Avoid using Mocks for simple value objects or utilities that don't have complex behavior.
- Before writing `createMock(X::class)` / `createStub(X::class)`, read X's declaration. `final class` or `readonly class` → the mock fails at runtime; use the strategy in "Handling `readonly` and `final` Classes" below. This check costs seconds; a suite full of unmockable doubles costs a refactoring session.
- Don't test interfaces: Interfaces define contracts but have no behavior to test. Focus tests on concrete implementations of interfaces, not the interfaces themselves.

## Best Practices

1. **Use `assertSame` over `assertEquals` when type matters** -- `assertEquals` does type coercion; `assertSame` catches `'1' !== 1` bugs that loose comparison misses.
2. **Use data providers for multiple inputs** -- Extract test data into `@dataProvider` methods with descriptive keys for clean, maintainable parameterized tests.
3. **Name data provider keys descriptively** -- Use strings like `'empty string'` and `'no at sign'` so PHPUnit output shows which case failed.
4. **Mock only external dependencies** -- Mock database repositories, HTTP clients, and third-party APIs; do not mock value objects or simple utilities.
5. **Use `setUp` and `tearDown` consistently** -- Initialize shared objects in `setUp` and clean up in `tearDown` for test isolation.
6. **Prefer constructor injection** -- Design classes with dependency injection for easy mocking in tests without reflection hacks.
7. **Test exceptions with `expectException`** -- Verify both the exception class and message using `expectExceptionMessage` for precise error testing.

## Anti-Patterns

1. **Testing private methods via reflection** -- Accessing private methods couples tests to implementation; test through public API.
2. **Ignoring `setUp`/`tearDown`** -- Duplicating setup code in every test method is verbose and fragile when requirements change.
3. **Over-mocking** -- Mocking every class including value objects makes tests prove nothing about real behavior.
4. **Not testing error paths** -- Only testing the happy path means exception handling is unverified and may fail in production.
5. **Hardcoding file paths** -- Using absolute paths breaks tests on other machines; use `sys_get_temp_dir()` and `tempnam()`.
6. **Shared mutable state** -- Static properties modified by tests cause order-dependent failures; reset state in `setUp`.
7. **Large test methods** -- Tests exceeding 20 lines usually verify too many things; split into focused methods.
8. **Mocking `readonly` or `final` classes** -- PHPUnit cannot mock class-level `readonly class` declarations (the generated mock subclass would itself have to be readonly) or `final` classes (they cannot be subclassed at all). Attempting to do so causes runtime errors. Note: a plain class with readonly *properties* IS mockable. See the section below for the correct strategy.

## Handling `readonly` and `final` Classes in Tests

### `readonly` classes
Only class-level readonly breaks mocking: `readonly class Foo {}` forces every subclass — including PHPUnit's generated mock — to be readonly too, so `createMock()` / `getMockBuilder()` throw. A plain class whose promoted constructor properties are individually `readonly` is fully mockable (the mock disables the constructor and never touches the properties).

**Correct approach:** Construct a real instance directly. Readonly classes are almost always value objects — constructing them is cheap and produces more meaningful tests than a mock would. Mock only the interface-typed or abstract-class dependencies the value object wraps:

```php
// BAD — throws at runtime
$proxy = $this->createMock(AiProviderProxy::class);

// GOOD — real value object, doubles only where allowed
$provider = new AiProvider();          // Eloquent model: in-memory, attributes only, never the DB
$provider->id = 1;
$proxy = new AiProviderProxy(
    provider: $provider,
    adapter: $this->createMock(ProviderAdapterInterface::class),  // interface — mockable
    driver: $this->createMock(Driver::class),                     // abstract class — mockable
);
```

Where the old mock stubbed getters (`->method('getName')->willReturn('x')`), feed the real object equivalent data instead — usually via constructor arguments or the wrapped model's attributes. Repeated construction belongs in a small private helper method (`makeProviderProxy()`), not copy-pasted per test.

If constructing the real object requires heavy dependencies, check whether the class implements an interface; if so, mock the interface instead.

### `final` classes
`final` classes cannot be subclassed, so PHPUnit's mock builder cannot generate a test double for them.

**Correct approach (in order of preference):**
1. If the class implements an interface, mock the interface.
2. If no interface exists and the class is a simple value object, construct it directly with test data.
3. If the class has complex dependencies you cannot satisfy, introduce an interface (a small, targeted refactor) and mock that.

```php
// BAD — final class, createMock() throws
$client = $this->createMock(SomeFinalHttpClient::class);

// GOOD — mock the interface it implements
$client = $this->createMock(HttpClientInterface::class);
```

### Designing classes so this never happens
When you write or review the production code itself, choose declarations by how tests will use the class:

- Don't declare app classes `final` — it buys little and blocks every test double.
- Reserve class-level `readonly` for cheap-to-construct DTOs/value objects that tests build as real instances.
- Services and collaborators that tests will stub (repositories, resolvers, factories, clients): plain `class` with `readonly` on each promoted constructor property. Same immutability guarantee, still mockable.

```php
// Value object — tests construct it real
readonly class AgentRequestContext { ... }

// Service — tests mock it
class ModelInfoFetcher
{
    public function __construct(
        private readonly LoggerInterface $logger,
        private readonly EnrichmentPipeline $pipeline,
    ) {}
}
```

> **STOP rule:** If you encounter a `readonly` or `final` class that you cannot mock and cannot construct directly (because its constructor requires objects you cannot easily provide), **stop and report it** to the user rather than working around it with reflection hacks or partial mocks.
