---
name: documentator
description: "Write and review code documentation that stays at the architecture/concept level. Use when writing or updating project docs, contributor guides, onboarding tutorials, or architecture overviews. Enforces the principle that detailed reference lives in the code (docblocks, type signatures) while human-facing docs explain why and how, not every method by name."
---

# Writing Code Documentation

## Core principle

**Detailed reference lives in the code. Docs explain why and how — not what every method is named.**

Method-by-method, parameter-by-parameter documentation rots the moment code changes. It duplicates what the type system and docblocks already say, drifts from reality, and teaches the wrong level of abstraction. Docs win when they give the mental model the code cannot give itself: architecture, data flow, rationale, constraints, and where to look next.

## Gather information

Check if there is a `.documentation.md`file in the directory you should put the documentation in. Also check if parents of the the directory have a `.documentation.md` file. If there is, read it and follow its instructions. The information in the `.documentation.md` file is always of utmost importance. It may contain instructions on where to put the documentation, what to include, and what to leave out.

## Workflow

Before writing, build a plan. Skipping this produces docs that drift from code and miss the point.

0. **Confirm scope if not obvious.** If it is not absolutely clear which directory to document and which source to document from, ask the user before doing anything else. Multiple doc trees, mirrored layouts, or a request that names a topic but not a path all qualify as "not obvious". Do not guess; a wrong starting directory wastes the whole pass.
1. **Read the docs first.** Current page, sibling pages, etc. Note structure, audience, conventions already in use.
2. **Read the source.** Open the classes the page covers. Diff what the docs claim against what the code does.
3. **Stop on drift.** If the doc says one thing and the code says another, do not silently "fix" the doc to match the code, and do not silently leave the stale claim. Ask the prompter which side is wrong. The code may be the bug; the doc may be the intended design. You cannot tell from inside.
4. **Plan.** One short list: which pages change, what each gains or loses, which audience each serves. Note anything you intend to cut and why.
5. **Confirm before substantial changes.** Restructuring a section, splitting or merging pages, changing the audience of a page, removing content — summarize the plan and ask the prompter before writing. Typos, prose tightening, fixing a stale link: just do them.

## Before writing

Ask, for every sentence: **does the code already say this?**

- Signature, parameter type, return type → code says it. Drop.
- "This method does X then Y" → code says it. Drop, or compress to one line.
- Why this layer exists, why data flows this way, why a constraint holds → only docs say it. Keep.
- Which file owns which concern, how pieces compose, what the failure modes are → only docs say it. Keep.

When in doubt, link to the source file instead of restating it. A reader who needs the method list can open the class. A reader who needs the mental model reads the doc.

## Three audiences — pick one per page

1. **Newcomer** — onboarding, "how to get running", first mental model. Tutorial-shaped, walks one concrete example end-to-end.
2. **Contributor** — architecture, layer responsibilities, where to put new code, conventions. Reference-shaped, scannable tables, honest about debt.
3. **Plugin/extension author or end user of a library** — the public surface and extension points. API-stability contract, what is `@api` vs internal, how to hook in.

Do not mix. A page that tries to onboard newcomers *and* list every internal class serves neither. One page, one audience.

### Be selective with internals

Document internals only when the *why* is non-obvious and the reader cannot infer it from the code. A `ReactiveStoreFront` deserves a page because the reactive model is the library's central idea. A `FooBarController` with a name that already says what it does does not.

The test: would a reader holding this page make better decisions than one holding only the class? If not, cut it.

Name internal classes when they matter for the mental model, but do not drill into their methods. Example: the frontend `ComposerContext` can be mentioned as "the context object that wires the chat composer together" so a reader knows it exists and what role it plays. Its method list, internal state shape, and lifecycle hooks are implementation details — the code is the reference. A reader who needs them opens the class.

## Attitude

Readers are contributors in waiting. Treat confused questions as documentation bugs, not user failures.

- When a user misunderstands something the docs cover, the doc failed. Fix it and invite them to send a PR.
- Never berate. Politeness cascades into contributors; rudeness cascades into lost contributors and lost peers who witness it.
- Be honest about the codebase's rough edges. A "do as we say, not as we did" note builds more trust than pretending the code matches the ideals. Catalogue known debt in a register, not in scattered apologies.

## Balance: tutorial and reference

A good doc set has both, and each page knows which it is.

**Tutorial** (newcomer): one concrete scenario, walked layer by layer. "A logged-in user requests a file. We follow it to the `StreamedResponse`." Enough to understand each layer's job, without drowning in implementation. Pick the cleanest example in the codebase, not the most interesting one — teaching the wrong pattern costs more than teaching a boring one.

**Reference / overview** (contributor): concept-level. Layer responsibilities in a table, directory anatomy in a tree, "where to start" navigation table. No narrative arc. Scannable.

Both explain the *why*. Neither narrates every method.

## What to keep out of docs

Patterns that rot fast — avoid unless the page is explicitly a frozen-in-time snapshot:

- Full method lists, parameter tables, return-type enumerations for internal classes. Link to the class instead.
- Specifics of build tooling, container context, or composer/npm invocation that change with the toolchain. Put run commands in a single getting-started page and link out; do not repeat them per domain.
- Line-number references, exact file counts, "currently 42 models" — anything the code can invalidate silently.
- Implementation details of a single dedicated component that already has a clear name and a docblock.

## What belongs in docs

- **Architecture diagrams** (mermaid sequence/flowchart) — the one thing code cannot show.
- **Layer responsibility tables** — who does what, who must not do what.
- **Directory anatomy** — where things live and *why* there.
- **"Where to start" navigation tables** — "I want to… → read…".
- **Rationale** — why a pattern feels heavy, why a constraint exists, why a legacy path remains.
- **Honest notes** — migration phases, deprecated workarounds, technical debt register.
- **Extension points** — `@api` contract, plugin interception hooks, what is stable vs internal.

## Structure patterns

### Numbered files and folders

Numeric prefixes (`100-`, `200-`) order pages without depending on a separate config. Categories group related pages. `index.md` per folder acts as the overview.

```
500-Backend/
├── index.md                  ← overview, "where to start" table
├── 150-Life-of-a-Request.md  ← tutorial
├── 100-Architecture/
│   ├── index.md
│   └── 100-API-Stability.md
```

### Overview page recipe

Every overview page answers, in order:

1. What this is, in one sentence.
2. Where things live (directory map or tree).
3. Why the design is this way (rationale, not apology).
4. Where to go next (navigation table: "I want to → read").

Keep under ~80 lines. Deep dives live in sub-pages.

### Tutorial page recipe

1. Scenario — one concrete request, named.
2. Sequence diagram (mermaid).
3. Step-by-step, one heading per layer. Each step: what happens, why it lives here, one code snippet showing the shape (not the whole method).
4. "Where the other layers appear" — a table pointing to the rest, so the tutorial is a frame, not the whole map.

Pick the cleanest path in the codebase as the example. If the interesting path is messy, note it honestly and cover it in a dedicated page.

### Admonitions

Use sparingly for load-bearing notes:

- `:::tip[Why?]` — rationale a reader would otherwise miss.
- `:::warning[Not a general pattern]` — a thing that looks general but is scoped.
- `:::info[Migration phase]` — time-bound context the reader must know.

Do not use admonitions for normal prose. If everything is in a box, nothing is.

### Navigation tables

The single most useful structural device. Two columns: "I want to…" / "Read…". Lets a reader self-route without reading the whole section.

```markdown
| I want to…                  | Read                          |
|-----------------------------|-------------------------------|
| Understand layer rules      | Architecture Overview         |
| Walk a request end-to-end   | Life of a Request             |
| Extend without touching core| API Stability & Plugin Preview|
```

## Writing style

- Concise. Drop articles, filler, hedging. Fragments OK.
- Explain *why*, not just *what*. The reader can read *what* in the code.
- Present tense, active voice. "The controller delegates" not "delegation is performed".
- Code snippets show shape, not size. Trim to the lines that teach; elide the rest with `// …`.
- One term per concept. Do not alternate "room" / "chat space" / "conversation" for the same thing.
- Mermaid for anything with flow or ordering. Prose for rationale.
- No emojis unless the existing docs already use them and the user asks.

## Code in docs: real where it teaches, simplified where it illustrates

Two distinct uses of code in docs, with different rules.

### Real code — when the reader will copy it

Pages that teach the reader *how to write something* — a plugin, a service, a store, a form request, an extension point — show real, working code. The audience is an extension author or contributor; they need to see the actual shape they should produce, including the attributes, the constructor, the return types. Simplifying here is actively harmful: a reader who copies a simplified version and it does not compile has been misled.

Pull real snippets from the codebase. Trim unrelated lines, but keep every line that carries a convention: `#[Singleton]`, `readonly`, `#[Config('...')]`, `#[CurrentUser]`, return types, `@api` markers. If the real class is too long to show whole, show the load-bearing part and link to the full file.

### Extracts, not dumps

Showing real internal code as a "reference implementation" — pasting a whole class body as one monolithic block with a few bullets underneath — teaches nothing a reader cannot get by opening the file, and drifts the moment the code changes. When real internal code is the best teacher, extract the load-bearing part for each concern separately, with its own prose context leading or beside it. Never paste a full class body labeled "reference implementation" and explain it after the fact.

The test: could a reader who skipped the code block still learn the lesson from the prose? If yes, the block is decoration — cut it or shrink it to the one line that carries the convention. If the prose only makes sense after reading the block, the block is doing the teaching and the prose is a caption — restructure so each extract teaches one thing, with the prose leading.

A copyable template (the shape the reader should produce in their own code) is different: it is shown whole because the reader is meant to reproduce it. But a template is not a reference implementation. If the reader is told to *read* an existing class, not reproduce it, do not paste that class — name it, link it, and extract only the lines that carry the non-obvious convention, each with its own context.

### Simplified code — when the reader needs the idea, not the implementation

Pages that explain an *internal mechanism* (event bus, reactive store engine, sync pipeline) can show simplified code to convey the concept. The audience is a newcomer or contributor building a mental model; the real class has error handling, priorities, edge cases, and logging that obscure the core idea.

Rules for simplified code:

- Say so explicitly: "Simplified view from `src/internal/.../Foo.ts`".
- Never present simplified code as the real implementation. A reader who copies it as a reference for their own code will be wrong.
- Keep the shape honest. If the real dispatch is a `Map<string, Function[]>`, the simplified version is a `Map`, not an array. Simplify detail, not design.
- Link to the real file so a reader who wants the truth can get it in one click.

### Internal classes — name, do not enumerate

Clearly internal classes (e.g. the frontend `ComposerContext`) can be named when they matter to the mental model, but their method list, state shape, and lifecycle are implementation details. One sentence on their role is enough; the code is the reference for the rest.

## Prose style

Docs are read by humans scanning for an answer. Write accordingly.

### Concise and direct

- Drop articles, filler, hedging. Fragments OK where they scan faster.
- Present tense, active voice. "The controller delegates to the service" not "delegation is performed by the controller".
- Simple copulas over elaborate verbs. "X is the entry point" not "X serves as the entry point". Avoid `serves as`, `stands as`, `boasts`, `features`, `offers [a]` as copula substitutes.
- One term per concept. Do not alternate "room" / "chat space" / "conversation" for the same thing.
- Explain *why*, not just *what*. The reader can read *what* in the code.

### Avoid AI-writing tells

Docs are technical prose, not marketing. Strip these patterns on every pass — they bloat the text and signal generated content:

- **Significance inflation.** Drop `pivotal`, `crucial`, `vital role`, `testament to`, `underscores the importance of`, `marks a shift`, `setting the stage for`. State the fact; the reader supplies the weight.
- **Superficial `-ing` clauses.** "…highlighting X, reflecting Y, contributing to Z" tacks on fake depth. Cut the trailing participles; if the connection matters, write a real clause.
- **Rule of three.** Do not force ideas into triples to look comprehensive. Two items is fine. Four is fine. Three only when there are actually three.
- **Promotional language.** No `vibrant`, `rich`, `groundbreaking`, `seamless`, `powerful`, `nestled`. Docs describe, they do not sell.
- **Vague attribution.** "Experts argue", "industry observers note" — either name a source or drop the hedge. In internal docs, state the claim directly.
- **Em dash overuse.** Commas, periods, or parentheses usually scan better. Reserve em dashes for the rare case where they are genuinely the best punctuation.
- **Boldface overuse.** Bold for the single load-bearing term a scanner needs, not for every key phrase. If everything is bold, nothing is.
- **Inline-header lists.** `- **Topic:** sentence` repeated is padding. Use a real list or fold into prose.
- **Signposting.** "Let's dive in", "here's what you need to know", "now let's look at". Just write the next sentence.
- **Generic conclusions.** "The future looks bright", "this represents a major step forward". End on the concrete next step or a link, not uplift.
- **Hedging.** "It could potentially be argued that this might…" Pick a stance or cite a source.
- **Title case in headings.** Sentence case, unless the existing doc set uses title case consistently.
- **Sycophantic framing.** No "Great question!", "This is an excellent point". Docs are not a conversation.

### Rhythm

Vary sentence length. A run of same-length sentences reads generated. Short sentence. Then a longer one that takes its time. Mix.

### Tone

You are allowed to have opinions where the architecture warrants them. "This pattern feels heavy because it is groundwork for the v3 plugin system" is more useful than neutral reporting. Neutral is fine when there is no opinion to have; do not manufacture one.

## When updating existing docs

1. Read the current page and any `.skill.md` / sibling guidance in the same directory.
2. Diff the code against what the page claims. Anything that drifted → either fix the doc to match, or mark it as known-debt in the register. Do not silently leave stale claims.
3. If a page has grown method-by-method reference, collapse it to a concept-level paragraph plus a link to the class.
4. Keep existing structure (numbered files, admonition style, navigation tables) unless the whole set is being restructured.

## Review checklist

- [ ] Scope (target directory + source) confirmed with user when not obvious.
- [ ] Docs read first, source read second, drift flagged to prompter before writing.
- [ ] Substantial changes confirmed with prompter before implementation.
- [ ] Every page serves exactly one audience (newcomer / contributor / extension author).
- [ ] Nothing restates what the code or type system already says.
- [ ] Each page explains *why*, not just *what*.
- [ ] Real code where the reader copies it; simplified code labeled and linked to source.
- [ ] Real internal code shown as per-concern extracts with context, not monolithic class dumps.
- [ ] Internal classes named for role, not enumerated method-by-method.
- [ ] Architecture/flow shown with mermaid, not prose.
- [ ] Navigation tables where readers need to self-route.
- [ ] No method/parameter enumerations of internal classes.
- [ ] No build-toolchain specifics scattered across domain pages.
- [ ] Honest about migration phases and technical debt.
- [ ] Prose stripped of AI tells (significance inflation, rule of three, promotional language, `-ing` tails, signposting, generic conclusions).
- [ ] Consistent terminology throughout.
- [ ] Links point to real files; no line-number or count references that rot.
