#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
    ROOT, STYLESHEET, CONTRAST_REQUIREMENTS, contrastRatio, themeColor, rootTokens,
    stripCssComments
} from './validate-site.mjs';

const DECORATIVE = ['--color-line', '--color-surface', '--color-code-dark'];

const EXTRA_PAIRS = [
    { label: 'texto del bloque de código', fg: '--code-text', bg: '--color-code-dark', min: 4.5 }
];

const THEMES = ['claro', 'oscuro'];

function verdict(ratio, min) {
    if (ratio >= min) return 'PASS';
    return ratio >= 3 ? 'solo texto grande o graficos' : 'FALLA';
}

function px(rem) {
    const value = Number.parseFloat(rem);
    return Number.isFinite(value) ? Math.round(value * 16 * 100) / 100 : rem;
}

const code = stripCssComments(readFileSync(join(ROOT, STYLESHEET), 'utf8'));
const tokens = rootTokens(code);
const color = (name, theme) => themeColor(tokens.get(name) ?? '', theme);

console.log(`Informe de accesibilidad visual — ${STYLESHEET}\n`);

console.log('== Contraste sobre el fondo de la pagina (WCAG 2.1) ==');
const row = (label, theme, ratio, min) => {
    const result = min === null ? 'decorativo' : verdict(ratio, min);
    const cell = `${label}`.padEnd(28) + `${theme}`.padEnd(9)
        + `${ratio.toFixed(2)}:1`.padEnd(10) + (min ? `${min}:1`.padEnd(9) : '—'.padEnd(9))
        + result;
    console.log('  ' + cell);
    return min === null || ratio >= min;
};

let ok = true;
const background = { claro: color('--color-bg', 'claro'), oscuro: color('--color-bg', 'oscuro') };

for (const theme of THEMES) {
    for (const requirement of CONTRAST_REQUIREMENTS) {
        const ratio = contrastRatio(color(requirement.fg, theme), background[theme]);
        ok = row(requirement.label, theme, ratio, requirement.min) && ok;
    }
    for (const name of DECORATIVE) {
        row(name.replace('--color-', ''), theme, contrastRatio(color(name, theme), background[theme]), null);
    }
    for (const pair of EXTRA_PAIRS) {
        const ratio = contrastRatio(color(pair.fg, theme), color(pair.bg, theme));
        ok = row(pair.label, theme, ratio, pair.min) && ok;
    }
}

console.log('\n== Tipografia ==');
console.log('  sans   ' + tokens.get('--font-sans'));
console.log('  mono   ' + tokens.get('--font-mono'));
const faces = [...code.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map((match) => /font-family:\s*"([^"]+)"/.exec(match[1])[1]);
console.log('  @font-face  ' + faces.length + ' declaraciones: ' + [...new Set(faces)].join(', '));
console.log('  escala en uso');
for (const [name, value] of tokens) {
    if (/^--text-/.test(name) && /(rem|px|em)$/.test(value)) {
        console.log(`    ${name.padEnd(16)} ${value.padEnd(12)} ${px(value)}px`);
    }
}

console.log('\n== CSS ==');
const sheets = [];
const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.git') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) collect(full);
        else if (entry.name.endsWith('.css')) sheets.push(full);
    }
};
collect(ROOT);
const bytes = sheets.reduce((total, file) => total + statSync(file).size, 0);
console.log(`  hojas      ${sheets.length} (${sheets.map((file) => relative(ROOT, file)).join(', ')})`);
console.log(`  peso       ${(bytes / 1024).toFixed(1)} KB`);
console.log(`  reglas     ${(code.match(/^[.#a-zA-Z@*][^{}\n]*\{/gm) ?? []).length}`);

console.log('\n' + (ok
    ? 'Todos los pares de texto cumplen el mínimo exigido por el contrato.'
    : 'Hay pares por debajo del mínimo: revisa el bloque anterior.'));
process.exit(ok ? 0 : 1);
