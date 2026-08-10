# Skills for the masses

Agent skills are reusable context files that teach an AI coding agent how to work with a specific technology, framework, or workflow. Instead of re-explaining conventions on every task, you install a skill once and the agent picks it up automatically whenever it's relevant.

Each skill lives in its own directory as a `SKILL.md` file. The file contains structured frontmatter (name, description, version) followed by the actual instructions the agent loads into context.

You can install the skills by running:

`npx skills add hawk-digital-environments/ai-skills`

## Included in the box

### General

- [humanizer](skills/humanizer/SKILL.md) — Remove signs of AI-generated writing from English text. Detects and fixes patterns such as inflated symbolism, em dash overuse, AI vocabulary words, and filler phrases.
- [humanizer-de](skills/humanizer-de/SKILL.md) — Same as `humanizer`, but tuned for German text.
- [skill-builder](skills/skill-builder/README.md) — Helps create or update a `SKILL.md` file based on an input document.

### Frontend

- [svelte](skills/svelte/SKILL.md) — Svelte 5 + TypeScript component patterns, store architecture, CSS cascade-layer styling, and utility conventions.
- [svelte-shadcn-primitives](skills/svelte-shadcn-primitives/SKILL.md) — Build primitive UI components (buttons, inputs, dialogs, etc.) in Svelte 5 following shadcn-svelte patterns without Tailwind CSS. Requires the `svelte` and `tailwind-to-css` skills.
- [tailwind-to-css](skills/tailwind-to-css/SKILL.md) — Convert Tailwind utility classes to vanilla CSS using the local converter script.
- [react-tailwind-to-svelte](skills/react-tailwind-to-svelte/SKILL.md) — Convert React + Tailwind components to Svelte 5 + vanilla CSS. Covers JSX → Svelte syntax, Tailwind class extraction, and CSS structuring. Requires the `tailwind-to-css`, `svelte`, and `tailwind-to-css` skills.

### Backend

- [laravel](skills/laravel/SKILL.md) — Laravel coding standards and architecture patterns: lightweight DDD, layer responsibilities, dependency injection, and PHP best practices.
- [phpunit](skills/phpunit/SKILL.md) — Comprehensive PHP testing with PHPUnit covering assertions, data providers, mocking, test doubles, database testing, and HTTP testing.

### HAWKI-specific

- [hawki-backend](skills/hawki-backend/SKILL.md) — HAWKI coding standards and architecture patterns for PHP. Requires the `laravel` skill.
- [hawki-frontend](skills/hawki-frontend/SKILL.md) — HAWKI frontend coding standards for Svelte 5 + TypeScript. Requires the `svelte` skill.
