#!/usr/bin/env node
/**
 * Walks up the directory tree from a given starting path and returns the
 * absolute path of the first .tailwind-override.css file found.
 *
 * CLI:    node find-closest-override.mjs /path/to/start
 * stdout: absolute path on success, empty on not found
 * exit:   0 in both cases, 1 on usage error
 */

import { existsSync } from 'node:fs';
import { join, dirname, resolve, parse } from 'node:path';

/**
 * @param {string} startDir  Absolute path to the directory to start from.
 * @returns {string|null}    Absolute path to the override file, or null.
 */
export function findClosestOverride(startDir) {
    let dir = resolve(startDir);
    const { root } = parse(dir);

    while (true) {
        const candidate = join(dir, '.tailwind-override.css');
        if (existsSync(candidate)) return candidate;
        if (dir === root) return null;
        dir = dirname(dir);
    }
}

const isMain = process.argv[1] &&
    (await import('node:url')).fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
    const startDir = process.argv[2];
    if (!startDir) {
        process.stderr.write('Usage: node find-closest-override.mjs <directory>\n');
        process.exit(1);
    }

    const result = findClosestOverride(startDir);
    if (result) process.stdout.write(result + '\n');
}
