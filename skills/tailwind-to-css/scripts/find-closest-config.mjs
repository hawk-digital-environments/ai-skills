#!/usr/bin/env node
/**
 * Walks up the directory tree from a given starting path and returns the
 * absolute path of the first Tailwind config file found.
 *
 * Checks in order: tailwind.config.ts, tailwind.config.js,
 * tailwind.config.mjs, tailwind.config.cjs
 *
 * CLI:    node find-closest-config.mjs /path/to/source/file
 * stdout: absolute path on success, empty on not found
 * exit:   0 in both cases, 1 on usage error
 */

import { existsSync } from 'node:fs';
import { join, dirname, resolve, parse } from 'node:path';

const CONFIG_NAMES = [
    'tailwind.config.ts',
    'tailwind.config.js',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
];

/**
 * @param {string} startPath  Path to the file being converted (or its directory).
 * @returns {string|null}     Absolute path to the config file, or null.
 */
export function findClosestConfig(startPath) {
    let dir = resolve(startPath);
    const { root } = parse(dir);

    while (true) {
        for (const name of CONFIG_NAMES) {
            const candidate = join(dir, name);
            if (existsSync(candidate)) return candidate;
        }
        if (dir === root) return null;
        dir = dirname(dir);
    }
}

const isMain = process.argv[1] &&
    (await import('node:url')).fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
    const startPath = process.argv[2];
    if (!startPath) {
        process.stderr.write('Usage: node find-closest-config.mjs <file-or-directory>\n');
        process.exit(1);
    }

    const result = findClosestConfig(startPath);
    if (result) process.stdout.write(result + '\n');
}
