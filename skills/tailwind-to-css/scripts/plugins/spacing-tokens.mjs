/**
 * PostCSS plugin: spacing-tokens
 *
 * Wraps Tailwind spacing calc() values on margin/padding properties with a
 * project token reference:
 *
 *   padding: calc(0.25rem * 4)
 *   → padding: var(--space-4, calc(0.25rem * 4))
 *
 * This allows projects to define --space-4 etc. as design-system tokens while
 * falling back to Tailwind's concrete value if the token is absent.
 *
 * Runs after apply-var-map so all var() references in values are already
 * resolved to concrete units (e.g. 0.25rem). The pattern matched is therefore
 * calc(<base> * <number>) on any known spacing/margin property.
 *
 * Tailwind-agnostic: no knowledge of Tailwind internals required.
 */

const SPACING_PROPERTIES = new Set([
    'padding', 'padding-inline', 'padding-block',
    'padding-inline-start', 'padding-inline-end',
    'padding-block-start', 'padding-block-end',
    'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'margin', 'margin-inline', 'margin-block',
    'margin-inline-start', 'margin-inline-end',
    'margin-block-start', 'margin-block-end',
    'margin-top', 'margin-bottom', 'margin-left', 'margin-right'
]);

// Matches calc(<anything-without-asterisk> * <number>) where number may be
// negative or decimal. Safe on spacing properties since Tailwind never
// produces other calc() patterns there.
const SPACING_CALC_RE = /calc\([^*]+\*\s*(-?[\d.]+)\)/g;
const TOKEN_PREFIX = '--space-';

function toTokenName(n) {
    // Replace decimal point with underscore: 0.5 → --space-0_5
    return `${TOKEN_PREFIX}${String(n).replace('.', '_')}`;
}

export function spacingTokens() {
    return {
        postcssPlugin: 'spacing-tokens',
        Declaration(decl) {
            if (!SPACING_PROPERTIES.has(decl.prop)) return;
            if (!decl.value.includes('calc(')) return;
            if (decl.value.includes(TOKEN_PREFIX)) return; // already wrapped

            const newValue = decl.value.replace(
                SPACING_CALC_RE,
                (match, n) => `var(${toTokenName(n)}, ${match})`
            );

            if (newValue !== decl.value) {
                decl.value = newValue;
            }
        }
    };
}

spacingTokens.postcss = true;
