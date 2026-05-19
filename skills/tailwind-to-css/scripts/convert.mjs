#!/usr/bin/env node
/**
 * Local Tailwind CSS → Vanilla CSS converter
 * Uses the @tailwindcss/cli installed in this directory.
 *
 * CLI:    node convert.mjs '[{"className":"card","classes":["p-6","bg-white"]}]'
 * stdin:  echo '[...]' | node convert.mjs
 * module: import { tailwindToCss } from './convert.mjs';
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR          = dirname(fileURLToPath(import.meta.url));
const WORK_DIR     = join(DIR, 'work');
const INPUT        = join(WORK_DIR, 'input.css');
const OUTPUT       = join(WORK_DIR, 'output.css');
const THEME_INPUT  = join(WORK_DIR, 'theme_input.css');
const THEME_OUTPUT = join(WORK_DIR, 'theme_output.css');
const CLI          = join(DIR, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

function ensureDeps() {
    if (!existsSync(join(DIR, 'node_modules'))) {
        process.stderr.write('Installing dependencies...\n');
        execSync('npm install', { cwd: DIR, stdio: 'inherit' });
    }
}

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

/**
 * Build the input CSS for the Tailwind CLI.
 *
 * @reference loads Tailwind's utility definitions for @apply without emitting
 * any of Tailwind's own CSS into the output, so the result contains only our
 * expanded class blocks.
 */
function buildInputCss(classDefinitions) {
    const rules = classDefinitions
        .map(({ className, classes }) =>
            `.${className} {\n    @apply ${classes.join(' ')};\n}`)
        .join('\n\n');

    return `@reference "tailwindcss";\n\n${rules}\n`;
}

// ---------------------------------------------------------------------------
// Tailwind theme — two-pass resolved variable map
// ---------------------------------------------------------------------------

/**
 * Build the theme CSS input for a Tailwind CLI run.
 * The full @import "tailwindcss" emits all :root custom properties.
 * An optional override file is appended after so its :root declarations win.
 *
 * @param {string|null} overrideFile  Absolute path to a CSS override file, or null.
 */
function buildThemeCss(overrideFile) {
    let css = '@import "tailwindcss";\n';
    if (overrideFile) {
        css += `@import "${overrideFile.replace(/\\/g, '/')}";\n`;
    }
    return css;
}

/**
 * Extract all CSS custom property declarations from :root blocks in a CSS string.
 * Recurses into at-rules (e.g. @layer, @media) so nested :root blocks are found too.
 *
 * @param {string} css
 * @returns {Map<string, string>}  e.g. Map { '--color-blue-600' => 'oklch(54.6% 0.245 262.881)' }
 */
function extractCssVars(css) {
    const vars   = new Map();
    const propRe = /(--[\w-]+)\s*:\s*([^;]+);/g;

    function collectFromBlocks(source) {
        for (const block of splitBlocks(source)) {
            const brace    = block.indexOf('{');
            const selector = block.slice(0, brace).trim();
            const body     = block.slice(brace + 1, block.lastIndexOf('}')).trim();

            if (selector === ':root' || selector.startsWith(':root')) {
                let p;
                propRe.lastIndex = 0;
                while ((p = propRe.exec(body)) !== null) {
                    vars.set(p[1].trim(), p[2].trim());
                }
            } else if (selector.startsWith('@')) {
                collectFromBlocks(body);
            }
        }
    }

    collectFromBlocks(css);
    return vars;
}

/**
 * Run a single Tailwind theme build and return the extracted CSS variables.
 *
 * @param {string|null} overrideFile
 * @returns {Map<string, string>}
 */
function buildThemeVars(overrideFile) {
    writeFileSync(THEME_INPUT, buildThemeCss(overrideFile), 'utf8');
    try {
        execSync(`node "${CLI}" -i "${THEME_INPUT}" -o "${THEME_OUTPUT}"`, {
            cwd: DIR,
            stdio: 'pipe',
        });
    } catch (err) {
        throw new Error(`Tailwind CLI (theme) failed:\n${err.stderr?.toString() ?? err.message}`);
    }
    return extractCssVars(readFileSync(THEME_OUTPUT, 'utf8'));
}

/**
 * Build the resolved variable map used by PostCSS plugins.
 *
 * Two Tailwind CLI builds are run:
 *   1. Tailwind only   → tailwindVars  (concrete defaults, no project influence)
 *   2. Tailwind + override → effectiveVars (project may remap tokens to its own vars)
 *
 * For each Tailwind token:
 *   - if overridden (values differ) → keep the override value (a project token reference
 *     like var(--color-surface-raised) that should survive into the output)
 *   - if not overridden → keep the concrete Tailwind value (strip the Tailwind dependency)
 *
 * Vars that only appear in the override (project-only tokens) are excluded — they
 * are never referenced directly from Tailwind class output.
 *
 * @param {string|null} overrideFile
 * @returns {Map<string, string>}
 */
function buildResolvedMap(overrideFile) {
    const tailwindVars = buildThemeVars(null);
    if (!overrideFile) return tailwindVars;

    const effectiveVars = buildThemeVars(overrideFile);
    const resolvedMap   = new Map(tailwindVars);

    for (const [name, effectiveValue] of effectiveVars) {
        if (!tailwindVars.has(name)) {
            // Tailwind override slot: defined in override but never in Tailwind's :root.
            // Tailwind utility CSS references these as var(--name, hardcoded-fallback).
            // Only add if the value is itself a var() reference — those are intentional
            // project token redirects (e.g. --text-lg: var(--font-size-base)).
            // Concrete values (e.g. --font-size-base: 1.10rem) are project design-token
            // definitions that must NOT be resolved away in converter output.
            if (effectiveValue.startsWith('var(')) {
                resolvedMap.set(name, effectiveValue);
            }
        } else if (effectiveValue !== tailwindVars.get(name)) {
            // Overridden by the project — keep the project token reference
            resolvedMap.set(name, effectiveValue);
        }
    }

    return resolvedMap;
}

// ---------------------------------------------------------------------------
// CSS extraction (safety net if boilerplate slips through)
// ---------------------------------------------------------------------------

/**
 * Split a CSS string into top-level blocks, respecting brace nesting.
 * Statements without braces (e.g. `@layer foo;`, `@import "...";`) are skipped.
 * Comments are also skipped so they never bleed into a selector string.
 */
function splitBlocks(css) {
    const blocks = [];
    const len = css.length;
    let i = 0;

    while (i < len) {
        // Skip whitespace
        while (i < len && css[i] <= ' ') i++;
        if (i >= len) break;

        // Skip block comments  /* … */
        if (css[i] === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end === -1 ? len : end + 2;
            continue;
        }

        const blockStart = i;

        // Scan forward to the first { or ; at depth 0
        let j = i;
        while (j < len && css[j] !== '{' && css[j] !== ';') j++;
        if (j >= len) break;

        if (css[j] === ';') {
            // Statement without a block — not a rule we care about, skip it
            i = j + 1;
            continue;
        }

        // css[j] === '{' — walk to the matching closing brace
        let depth = 0;
        let k = j;
        while (k < len) {
            if (css[k] === '{')      depth++;
            else if (css[k] === '}') {
                if (--depth === 0) {
                    blocks.push(css.slice(blockStart, k + 1).trim());
                    i = k + 1;
                    break;
                }
            }
            k++;
        }
        if (depth !== 0) break; // unmatched brace — stop
    }

    return blocks;
}

/** Keep only CSS blocks whose selector references one of our class names. */
function extractClasses(css, classNames) {
    const matches = (selector) =>
        classNames.some(name => {
            const cls = `.${name}`;
            const idx = selector.indexOf(cls);
            if (idx === -1) return false;
            // Ensure cls isn't a substring of a longer class name
            const charAfter = selector[idx + cls.length];
            return charAfter === undefined || ':[ ,>+~{'.includes(charAfter);
        });

    return splitBlocks(css)
        .flatMap(block => {
            const brace    = block.indexOf('{');
            const selector = block.slice(0, brace).trim();
            const body     = block.slice(brace + 1, block.lastIndexOf('}')).trim();

            if (selector.startsWith('@')) {
                const inner = extractClasses(body, classNames);
                return inner ? [`${selector} {\n${inner}\n}`] : [];
            }

            return matches(selector) ? [block] : [];
        })
        .join('\n\n');
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Convert Tailwind utility classes to vanilla CSS.
 *
 * The output is processed through a PostCSS pipeline:
 *  1. apply-var-map   — resolves var(--tailwind-token) references; Tailwind tokens
 *                       are replaced with concrete values unless the project override
 *                       remapped them to project token references (which are kept).
 *  2. spacing-tokens  — wraps spacing calc() values with var(--space-N, <fallback>)
 *                       so projects can optionally provide named spacing tokens.
 *
 * @param {Array<{ className: string; classes: string[] }>} classDefinitions
 * @param {string|null} overrideFile  Optional absolute path to a CSS override file.
 * @returns {Promise<string>} Generated CSS
 */
export async function tailwindToCss(classDefinitions, overrideFile = null) {
    if (!Array.isArray(classDefinitions) || classDefinitions.length === 0) {
        throw new TypeError('classDefinitions must be a non-empty array');
    }

    ensureDeps();

    // Step 1: Generate class CSS via Tailwind CLI
    writeFileSync(INPUT, buildInputCss(classDefinitions), 'utf8');
    try {
        execSync(`node "${CLI}" -i "${INPUT}" -o "${OUTPUT}"`, {
            cwd: DIR,
            stdio: 'pipe',
        });
    } catch (err) {
        throw new Error(`Tailwind CLI failed:\n${err.stderr?.toString() ?? err.message}`);
    }

    const raw        = readFileSync(OUTPUT, 'utf8');
    const classNames = classDefinitions.map(d => d.className);
    const extracted  = extractClasses(raw, classNames);

    // Step 2: Build the resolved variable map (two Tailwind theme builds)
    const resolvedMap = buildResolvedMap(overrideFile);

    // Step 3: Run PostCSS pipeline — plugins are Tailwind-agnostic
    // Two passes: first resolve all Tailwind var() references to concrete values,
    // then wrap concrete values with project token references.
    // Separate passes prevent apply-var-map from unwrapping tokens injected by
    // the wrapping plugins (its fallback logic would strip unknown var() calls).
    const postcss                = (await import('postcss')).default;
    const { applyVarMap }        = await import('./plugins/apply-var-map.mjs');
    const { spacingTokens }      = await import('./plugins/spacing-tokens.mjs');
    const { fontWeightTokens }   = await import('./plugins/font-weight-tokens.mjs');

    const css = extracted || raw;

    // Pass 1: resolve Tailwind var() references
    const resolved = await postcss([
        applyVarMap(resolvedMap),
    ]).process(css, { from: undefined });

    // Pass 2: wrap concrete values with project token references
    const result = await postcss([
        spacingTokens(),
        fontWeightTokens(),
    ]).process(resolved.css, { from: undefined });

    return result.css;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
    const args = process.argv.slice(2);

    // Extract optional --override <path> flag
    let overrideFile = null;
    const overrideIdx = args.indexOf('--override');
    if (overrideIdx !== -1) {
        if (!args[overrideIdx + 1]) {
            process.stderr.write('--override requires a file path argument\n');
            process.exit(1);
        }
        overrideFile = resolve(args[overrideIdx + 1]);
        args.splice(overrideIdx, 2);
    }

    let input = args[0] ?? '';

    if (!input) {
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        input = Buffer.concat(chunks).toString('utf8').trim();
    }

    if (!input) {
        process.stderr.write(
            'Usage:\n' +
            '  node convert.mjs \'[{"className":"card","classes":["p-6","bg-white"]}]\'\n' +
            '  node convert.mjs \'[...]\' --override /path/to/overrides.css\n' +
            '  echo \'[...]\' | node convert.mjs\n',
        );
        process.exit(1);
    }

    let defs;
    try {
        defs = JSON.parse(input);
    } catch (err) {
        process.stderr.write(`Invalid JSON: ${err.message}\n`);
        process.exit(1);
    }

    try {
        process.stdout.write(await tailwindToCss(defs, overrideFile));
    } catch (err) {
        process.stderr.write(`${err.message}\n`);
        process.exit(1);
    }
}

const isMain = process.argv[1] &&
    (await import('node:url')).fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) await main();
