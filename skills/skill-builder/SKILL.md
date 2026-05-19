---
name: skill-builder
description: helps to create or update a SKILL.md file based on an input document
---

Your job is to build or update an agent SKILL.md file.

1. Ask the user to provide a file reference of the source file/folder (normally some kind of documentation written for humans) if not already provided.
2. If there is a .skill.md on the same directory level as the source read it, as it contains specific instructions that are important for the skills creation.
3. If the .skill.md contains distinct instructions that the skill file is located in a different directory than the source documentation, follow the instructions to the new directory. Resume from Step 2 in that directory (there may be another .skill.md file in the new directory).
4. Check, if on the same directory level of the source there is already a SKILL.md
5. If there is a SKILL.md file assume you are updating that skill with changes from the source.
6. Use the source to either update the existing SKILL.md or write a new one from scratch, if available the .skill.md is always of utmost importance, even if it contradicts the tutorial of step 5.

## BE CONCISE

Skills eat up tokens fast, so try to be as concise as possible without loosing important information:

- Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Technical terms exact. Code blocks unchanged. Errors quoted exact.

- Pattern: [thing] [action] [reason]. [next step].

- Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..." Yes: "Bug in auth middleware. Token expiry check use < not <=. Fix:"
- Example — "Explain database connection pooling.": "Pool reuse open DB connections. No new connection per request. Skip handshake overhead."

## Key writing principles

- **Progressive Disclosure**: Three-level loading — metadata (always), SKILL.md body (on trigger), bundled resources (on demand). Keep SKILL.md under 500 lines. Move large reference material to separate files linked from SKILL.md.
- **Lack of Surprise**: Skill contents must match its description in intent. Never misleading.
- **Generalize, don't overfit**: Write patterns for diverse real-world scenarios, not for specific edge cases. Explain *why* rather than rigid ALL-CAPS rules — the model reasons better with rationale.
- **Explain the Why**: Help the model understand reasoning behind instructions instead of just listing rules.

## Additional rules for writing a SKILL.md

When writing a SKILL.md, follow these additional rules:

- **Challenge every sentence**: Claude is already smart. Only add context it doesn't already have. Ask "does this justify its token cost?" before including anything.
- **Naming**: prefer short, verb-led names. Namespace by tool when it aids clarity or triggering (e.g. `gh-address-comments`, `linear-close-issue`).
- **No extraneous files**: do NOT create README.md, CHANGELOG.md, QUICK_REFERENCE.md or similar alongside the skill. Only SKILL.md and its functional resources.
- **References stay shallow**: all reference files must link directly from SKILL.md — never nest references inside other references.
- **TOC for long reference files**: any reference file over 100 lines should start with a table of contents.

## Scripts in skills

### One-off commands (no scripts/ dir needed)

When an existing package does what you need, reference it directly in SKILL.md. Pin versions for reproducibility. State prerequisites ("Requires Node.js 18+").

```bash
npx eslint@9 --fix .
uvx ruff@0.8.0 check .
```

Move complex commands into a script when they'd be hard to get right on the first try.

### Bundled scripts

Store reusable scripts in `scripts/`. Reference via **relative paths from the skill directory root**:

```markdown
## Available scripts

- **`scripts/validate.sh`** — Validates configuration files
```

Use `${CLAUDE_SKILL_DIR}` in bash injection blocks when you need the absolute path to the skill dir regardless of install location.

Self-contained scripts declare dependencies inline — no separate install step:

- **Python** (PEP 723): `# /// script` block + `uv run scripts/foo.py`
- **Deno**: `import * as x from "npm:package@1.0.0"` + `deno run scripts/foo.ts`
- **Bun**: version in import path + `bun run scripts/foo.ts`
- **Ruby**: `require 'bundler/inline'` + `gemfile do` block + `ruby scripts/foo.rb`

### Designing scripts for agentic use

Agents run in non-interactive shells. Scripts must never block on TTY prompts.

- **No interactive prompts**: accept all input via flags, env vars, or stdin. Emit clear error + usage on missing args.
- **`--help` output**: include description, flags, and examples — this is the primary way an agent learns the interface.
- **Helpful errors**: say what went wrong, what was expected, what to try. `Error: --format must be one of: json, csv, table. Received: "xml"`
- **Structured output**: prefer JSON/CSV/TSV over free-form text. Send data to stdout, diagnostics to stderr.
- **Idempotency**: agents may retry. "Create if not exists" > "create and fail on duplicate."
- **Dry-run flag**: for destructive/stateful ops, add `--dry-run`.
- **Exit codes**: use distinct codes for different failure types; document them in `--help`.
- **Predictable output size**: default to summary/limit; add `--offset` or `--output` for large output.
