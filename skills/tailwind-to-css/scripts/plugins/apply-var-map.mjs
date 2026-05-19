/**
 * PostCSS plugin: apply-var-map
 *
 * Resolves CSS custom property references (var(--name)) in declaration values
 * using a pre-built map of name → resolved value.
 *
 * Tailwind-agnostic: the map is built outside this plugin by the converter's
 * two-pass theme build and passed in as plain data.
 *
 * Handles nested var() correctly (e.g. var(--a, var(--b, fallback))) by
 * recursively resolving inner references before outer ones.
 *
 * @param {Map<string, string>} resolvedMap  name → concrete value or project token ref
 */

import valueParser from 'postcss-value-parser';

/**
 * Recursively resolve var() nodes using the resolved map.
 * Inner vars are resolved before outer ones so fallbacks are always concrete
 * by the time an outer var is processed.
 *
 * Resolution rules for var(--name, fallback):
 *   - --name in map  → replace the entire var() with the mapped value
 *                      (concrete value or project token reference, no fallback kept)
 *   - --name not in map, fallback present  → strip the var() wrapper, return the
 *                      already-resolved fallback nodes (eliminates unknown tokens)
 *   - --name not in map, no fallback       → keep var(--name) as-is
 *                      (intentional project token with no default)
 *
 * @param {Array} nodes  postcss-value-parser node array
 * @param {Map<string, string>} resolvedMap
 * @returns {Array}  new node array with vars substituted
 */
function resolveNodes(nodes, resolvedMap) {
    return nodes.flatMap(node => {
        // Recurse into any function node first (inner vars resolved before outer)
        if (node.type === 'function') {
            const resolvedChildren = resolveNodes(node.nodes, resolvedMap);

            if (node.value.toLowerCase() === 'var') {
                const nameNode = resolvedChildren.find(
                    n => n.type === 'word' && n.value.startsWith('--'),
                );

                if (nameNode) {
                    if (resolvedMap.has(nameNode.value)) {
                        // Known token: replace entirely with mapped value (discard fallback)
                        return valueParser(resolvedMap.get(nameNode.value)).nodes;
                    }

                    // Unknown token: fall through to the fallback if one exists
                    const commaIdx = resolvedChildren.findIndex(
                        n => n.type === 'div' && n.value === ',',
                    );
                    if (commaIdx !== -1) {
                        return resolvedChildren.slice(commaIdx + 1);
                    }
                }
            }

            return [{ ...node, nodes: resolvedChildren }];
        }

        return [node];
    });
}

export function applyVarMap(resolvedMap) {
    return {
        postcssPlugin: 'apply-var-map',
        Declaration(decl) {
            if (!decl.value.includes('var(')) return;

            const parsed   = valueParser(decl.value);
            const resolved = resolveNodes(parsed.nodes, resolvedMap);
            const newValue = valueParser.stringify(resolved);

            if (newValue !== decl.value) {
                decl.value = newValue;
            }
        },
    };
}

applyVarMap.postcss = true;
