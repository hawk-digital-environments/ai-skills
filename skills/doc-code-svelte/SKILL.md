---
name: doc-code-svelte
description: "Write or review inline documentation (@component blocks, JSDoc, comments) in Svelte 5 + TypeScript code. Use when asked to document, add docblocks to, or review documentation coverage of a Svelte component, store, snippet, or utility module."
---

> ONLY CONTINUE IF THE `svelte` SKILL IS AVAILABLE.
> This skill builds on top of the `svelte` skill. Read and understand the `svelte` skill first. If it isn't available, report an error: "The `svelte` skill is required for the `doc-code-svelte` skill."

# Documenting Svelte Code

## Core principle

**Docblocks explain why and how — not what the code already says.**

The `svelte` skill defines the *mechanics*: `@component` blocks, per-prop JSDoc, member-first priority for stores/classes. This skill is the judgment layer on top — what earns a docblock, what doesn't, how much to say, and how to say it.

Before writing any docblock, ask: **does the code already say this?**

- Parameter name, type, return type → code says it. Drop, or don't repeat it in prose.
- A setter's mechanical action ("sets X") for a setter named `setX` → obvious. Skip.
- What `X` *represents*, when you'd set it, what else it's affected by → often not obvious, and usually belongs on the property/field, not the setter. A boolean flag on a model needs a doc on the flag itself ("true once the trial period has ended and billing is enforced"), not on `setActive(value)`.
- Why this exists, what breaks if misused, what the caller needs to know that the signature can't express → only the docblock says it. Write it.

## Placement: closest wins

Document at the smallest scope that owns the fact:

- A prop's constraint → JSDoc on that prop, not the component's `@component` line.
- A method's side effect → JSDoc on that method, not the class block.
- A file-wide concern (why this module exists, what pattern it implements) → the top-level `@component`/class block, once.

Never push detail up to a bigger scope "to keep it together." A reader scanning a method doesn't re-read the class block, and a class block that repeats every method drifts the moment one method changes and the docblock doesn't.

## What earns a docblock

Non-obvious only. Before adding one, check it clears at least one of:

- **Behavior a caller can't predict from the name/signature** — a `set()` that resets unrelated state, a prop that changes rendering mode based on another prop's value, an async method that must resolve before a sibling call is safe.
- **A constraint or invariant** — units, ranges, ordering requirements, what happens on the empty/null case.
- **Why it exists** — which pattern it implements, why it lives here instead of somewhere else, what breaks if it's removed. Belongs on a class/component block, not a member.
- **A gotcha** — a footgun, compiler restriction, timing dependency. See [Insights and gotchas](#insights-and-gotchas).

Skip: a `size` prop typed `'sm' | 'md' | 'lg'` with no surprises. A `disabled` boolean. A getter returning a field with the same name. If the docblock would just reword the identifier, don't write it — this is the single most common way docblocks turn into noise. `svelte` skill's anti-patterns already flag this for class members; it applies the same way to props, snippets, and utility functions.

## Examples: show usage, not internals

When behavior isn't obvious from the signature, a short `@example` beats a paragraph of prose:

```ts
/**
 * Delays invoking `fn` until `wait` ms after the last call. Later calls reset
 * the timer; only the last call in a burst fires.
 *
 * @example
 * const search = debounce((q: string) => api.search(q), 300);
 * input.oninput = (e) => search(e.target.value); // fires once, 300ms after typing stops
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T { /* ... */ }
```

The example shows the *shape of a call site*, not a copy of the implementation — real code is fine here even where the surrounding rule (concept over implementation, below) says otherwise. A reader copies the example, not the prose.

Skip the example when the one-line description already tells the whole story — `/** Formats bytes as a human-readable string, e.g. "4.2 MB". */` needs no example.

## Skip redundant `@param`/`@return` in TypeScript

The signature already gives the type, compiler-checked, visible in every editor. A `@param`/`@return` that only repeats it is dead weight:

```ts
/**
 * @param wait - number   ← useless, IDE already shows this
 * @returns void
 */
```

Add the tag only when there's real information beyond the type — units, valid range, what a specific return value means, edge-case behavior:

```ts
/**
 * @param wait - Delay in ms. Values below the browser's minimum timer resolution (~4ms) are clamped.
 * @returns The debounced function; call `.cancel()` on it to drop a pending invocation before it fires.
 */
```

If there's nothing to add beyond the type, omit the tag — a bare one-line description above the signature carries the doc.

## Insights and gotchas

Capture what a reader would otherwise only learn by getting burned. The clearest example of the category is a compiler-breaking case from the `svelte` skill itself:

**IMPORTANT** When writing docblocks for svelte components, do not nest HTML comments inside each other: `<!-- <!-- nested comment --> -->` is invalid, so is the use of `/* */` inside of documentation blocks, and will break the compiler. Use `// ...` for nested comments instead.

That's the bar: something a reader can't infer from the type system or the name, that costs real debugging time if missed. State it flat, one sentence when possible — no "note that" or "it's worth mentioning."

## Don't overdocument

A file where every prop, every method, and every variable has a docblock is as unhelpful as a file with none — the reader can no longer tell which comments carry real information and which are padding. Symptoms:

- A docblock on every prop even when most just restate the name.
- A class-level block listing every method ("has `get()`, `set()`, `reset()`…") — the members already speak for themselves.
- A multi-paragraph `@component` block on a component with no real behavior — a pure layout wrapper doesn't need an essay.
- Comments restating the adjacent line (`// increment counter` above `counter++`).

If a component/class has no architectural context worth adding, skip the top-level block entirely and let the props/members document themselves.

## Concepts, not implementation

A docblock is a mental-model reminder, not a walkthrough of the function body. Describe what the caller needs to know to use this correctly and why it's built this way — not the control flow inside.

Bad (implementation, restates code):
```ts
/** Loops over items, filters out nulls, then maps to labels and joins with commas. */
```

Good (concept, the why):
```ts
/** Comma-joined labels for display; nullish items are dropped rather than shown as "—". */
```

Exception: `@example` blocks. Those are expected to show real call-site code — the rule targets prose, not examples.

## Style

- Concise, present tense, active voice. Fragments are fine in a one-liner.
- No hedging, no filler ("basically", "simply", "just"), no significance inflation ("crucial", "powerful").
- One sentence when a sentence is enough. Multi-line only when there's a constraint, example, or gotcha to add — not to pad.
- State facts flat. "Resets to defaults on `null`", not "please note that this will reset to the defaults if you pass null."

## Workflow: reviewing existing documentation

1. Read the file's current docblocks against its actual behavior — code and comment drift apart quietly. The code wins: when they disagree, update the docblock to match the code.
2. Trim any block that only rewords the identifier or repeats the type signature.
3. Fill gaps: members with real non-obvious behavior and no docblock — add one, following the placement and "what earns a docblock" rules above.
4. Don't restructure a file's documentation pattern wholesale without checking — a file mid-migration to a new convention may be intentional.

## Review checklist

- [ ] Every docblock earns its place (non-obvious behavior, constraint, rationale, or gotcha — not a reworded identifier).
- [ ] Docblocks sit at the smallest scope that owns the fact (member, not class; class, not file).
- [ ] Examples show call-site usage, not internals — added only where the one-liner isn't enough.
- [ ] No docblock restates a name, type, or control-flow step the code already shows.
- [ ] Gotchas/insights captured where they'd cost real debugging time, stated flat.
- [ ] No multi-paragraph docblock on a component/class with no real architectural context.
- [ ] Drift between docblock claims and actual behavior resolved in favor of the code — stale docs corrected, not left standing.
- [ ] No `@param`/`@return` tag that only restates a TypeScript type with no added information.
