/**
 * PostCSS plugin: font-weight-tokens
 *
 * Wraps hardcoded font-weight values with a project token reference:
 *
 *   font-weight: 700
 *   → font-weight: var(--font-weight-bold, 700)
 *
 * Tailwind v4 outputs font-weight as hardcoded numeric values rather than
 * CSS custom properties, so override-file mappings cannot intercept them.
 * This plugin provides the same mechanism as spacing-tokens: the project
 * can optionally define --font-weight-* tokens; the fallback keeps the
 * concrete value if the token is absent.
 *
 * Tailwind-agnostic: only the CSS font-weight property and its numeric
 * values are inspected — no Tailwind internals required.
 */

// Standard CSS font-weight numeric values → semantic token names.
// Projects that only define a subset (e.g. normal/medium/bold) will fall
// back to the hardcoded numeric value for weights they don't define.
const WEIGHT_TOKENS = new Map([
    ['100', '--font-weight-thin'],
    ['200', '--font-weight-extralight'],
    ['300', '--font-weight-light'],
    ['400', '--font-weight-normal'],
    ['500', '--font-weight-medium'],
    ['600', '--font-weight-semibold'],
    ['700', '--font-weight-bold'],
    ['800', '--font-weight-extrabold'],
    ['900', '--font-weight-black']
]);

const TOKEN_PREFIX = '--font-weight-';

export function fontWeightTokens() {
    return {
        postcssPlugin: 'font-weight-tokens',
        Declaration(decl) {
            if (decl.prop !== 'font-weight') return;
            if (decl.value.includes(TOKEN_PREFIX)) return; // already wrapped

            const token = WEIGHT_TOKENS.get(decl.value.trim());
            if (!token) return;

            decl.value = `var(${token}, ${decl.value.trim()})`;
        }
    };
}

fontWeightTokens.postcss = true;
