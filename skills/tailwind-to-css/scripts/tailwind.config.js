const fs   = require('fs');
const path = require('path');

const base = {
    experimental: {
        applyComplexClasses: true,
    },
};

// If an agent has written a conversion config (e.g. a stripped-down version of
// the source project's tailwind.config), merge its theme extensions so Tailwind
// recognises custom utilities like bg-primary or text-muted-foreground.
// The file must export a plain object; plugins and content are intentionally
// ignored — only theme extensions are merged.
const conversionConfigPath = path.join(__dirname, 'work', 'tailwind.conversion.config.js');

if (fs.existsSync(conversionConfigPath)) {
    let extra = {};
    try {
        extra = require(conversionConfigPath);
    } catch (e) {
        process.stderr.write(`[tailwind.config.js] Could not load conversion config: ${e.message}\n`);
    }

    if (extra.theme?.extend) {
        base.theme = {
            extend: { ...extra.theme.extend },
        };
    }

    if (extra.darkMode) {
        base.darkMode = extra.darkMode;
    }
}

module.exports = base;
