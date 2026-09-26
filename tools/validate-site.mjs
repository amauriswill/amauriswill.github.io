#!/usr/bin/env node
/**
 * validate-site.mjs — Pruebas de conformidad arquitectónica del portafolio.
 * -----------------------------------------------------------------------------
 * Es el "contrato ejecutable" del proyecto: comprueba que las 9 páginas
 * respeten las decisiones de arquitectura y las reglas de estilo.
 * Sin dependencias externas (solo Node >= 18).
 *
 * Uso:  node tools/validate-site.mjs
 * Salida: informe por comprobación; código de salida 1 si algo falla.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Contrato: archivo  ->  enlace de navegación que debe marcarse como activo. */
const PAGES = {
    'index.html': 'index.html',
    'proyectos.html': 'proyectos.html',
    'notas.html': 'notas.html',
    'nota-cpp.html': 'notas.html',
    'nota-ia.html': 'notas.html',
    'nota-automatizacion.html': 'notas.html',
    'nota-omarchy.html': 'notas.html',
    'nota-educacion.html': 'notas.html',
    'nota-psicologia.html': 'notas.html'
};

const NAV_ORDER = ['index.html', 'proyectos.html', 'notas.html'];

const FOOTER_LINKS = [
    'mailto:amauriswillwork@gmail.com',
    'https://github.com/amauriswill',
    'https://www.linkedin.com/in/amauriswill/',
    'https://behance.net/amauriswill',
    'https://youtube.com/@amaurisfolio'
];

const STYLESHEET = 'assets/css/main.css';

/** Nombre público del sitio: debe ser idéntico en la cabecera de las 9 páginas. */
const SITE_NAME = 'Amauris Willmore';

/** Tokens que la capa de diseño debe exponer siempre. */
const REQUIRED_TOKENS = [
    '--color-bg', '--color-text', '--color-muted', '--color-link', '--color-border',
    '--font-sans', '--font-mono', '--space-lg', '--text-base', '--reading-measure'
];

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr']);

const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

/* =============================================================================
 * Utilidades puras
 * ========================================================================== */

function lineOf(html, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) if (html[i] === '\n') line += 1;
    return line;
}

/** Sustituye los comentarios por espacios conservando los saltos de línea. */
function blankComments(html) {
    return html.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function parseTags(html) {
    const source = blankComments(html);
    const result = [];
    let match;
    TAG_PATTERN.lastIndex = 0;
    while ((match = TAG_PATTERN.exec(source)) !== null) {
        result.push({
            closing: match[1] === '/',
            name: match[2].toLowerCase(),
            attributes: match[3],
            selfClosing: match[4] === '/',
            line: lineOf(source, match.index)
        });
    }
    return result;
}

function openings(tags, name) {
    return tags.filter((tag) => tag.name === name && !tag.closing);
}

function attributeValue(tag, name) {
    const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag.attributes);
    return match ? match[1] : null;
}

function hasAttribute(tag, name) {
    return new RegExp(`\\b${name}(\\s|=|$)`, 'i').test(tag.attributes);
}

function sliceElement(html, open, close) {
    const start = html.indexOf(open);
    if (start === -1) return null;
    const end = html.indexOf(close, start);
    return end === -1 ? null : html.slice(start, end + close.length);
}

function loadPage(file) {
    const path = join(ROOT, file);
    const failures = [];

    if (!existsSync(path) || !statSync(path).isFile()) {
        return { file, missing: true, failures: [`${file}: no existe como archivo en la raíz`] };
    }

    const buffer = readFileSync(path);
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        failures.push(`${file}: comienza con BOM (se exige UTF-8 sin BOM)`);
    }

    let html = '';
    try {
        html = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        failures.push(`${file}: el contenido no es UTF-8 válido`);
    }
    if (html.includes('\uFFFD')) {
        failures.push(`${file}: contiene U+FFFD (codificación dañada)`);
    }

    return { file, buffer, html, tags: parseTags(html), failures };
}

/* =============================================================================
 * Comprobaciones
 * ========================================================================== */

function checkPagesExist(pages) {
    return [...pages.values()].flatMap((page) => page.failures);
}

function checkDocumentShell(pages) {
    const failures = [];
    const titles = new Map();

    for (const page of pages.values()) {
        if (page.missing) continue;
        const { file, html, tags } = page;

        if (!/^\s*<!DOCTYPE html>/i.test(html)) failures.push(`${file}: falta <!DOCTYPE html>`);

        const htmlTag = openings(tags, 'html')[0];
        if (!htmlTag || attributeValue(htmlTag, 'lang') !== 'es') {
            failures.push(`${file}: el elemento <html> debe declarar lang="es"`);
        }

        const charset = openings(tags, 'meta').find((tag) => hasAttribute(tag, 'charset'));
        if (!charset || (attributeValue(charset, 'charset') || '').toLowerCase() !== 'utf-8') {
            failures.push(`${file}: falta <meta charset="UTF-8"> o no declara UTF-8`);
        }

        const viewport = openings(tags, 'meta').find((tag) => attributeValue(tag, 'name') === 'viewport');
        if (!viewport || !(attributeValue(viewport, 'content') || '').includes('width=device-width')) {
            failures.push(`${file}: falta un <meta name="viewport"> responsivo`);
        }

        const description = openings(tags, 'meta').find((tag) => attributeValue(tag, 'name') === 'description');
        if (!description || !(attributeValue(description, 'content') || '').trim()) {
            failures.push(`${file}: falta <meta name="description"> con contenido`);
        }

        const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
        const title = titleMatch ? titleMatch[1].trim() : '';
        if (!title) failures.push(`${file}: falta un <title> no vacío`);
        else if (titles.has(title)) failures.push(`${file}: el <title> se repite con ${titles.get(title)}`);
        else titles.set(title, file);

        for (const name of ['header', 'main', 'footer']) {
            const count = openings(tags, name).length;
            if (count !== 1) failures.push(`${file}: se esperaba un único <${name}>, hay ${count}`);
        }
    }
    return failures;
}

function checkStyleLayer(pages) {
    const failures = [];

    for (const page of pages.values()) {
        if (page.missing) continue;
        const { file, html, tags } = page;

        const sheets = openings(tags, 'link').filter((tag) => attributeValue(tag, 'rel') === 'stylesheet');
        if (sheets.length !== 1) {
            failures.push(`${file}: se esperaba una única hoja de estilos, hay ${sheets.length}`);
        } else if (attributeValue(sheets[0], 'href') !== STYLESHEET) {
            failures.push(`${file}: la hoja debe ser "${STYLESHEET}", es "${attributeValue(sheets[0], 'href')}"`);
        }

        if (/<style[\s>]/i.test(html)) failures.push(`${file}: contiene CSS embebido (<style>)`);

        const inlineStyle = blankComments(html).match(/[^-\w]style\s*=/i);
        if (inlineStyle) {
            failures.push(`${file}: contiene un atributo style en línea (línea ${lineOf(html, inlineStyle.index)})`);
        }
    }

    if (!existsSync(join(ROOT, STYLESHEET))) failures.push(`${STYLESHEET}: la hoja de estilos no existe`);
    return failures;
}

function checkNoScripts(pages) {
    const failures = [];

    for (const page of pages.values()) {
        if (page.missing) continue;
        const source = blankComments(page.html);

        if (/<script[\s>]/i.test(source)) failures.push(`${page.file}: contiene JavaScript (<script>)`);

        const handler = source.match(/\son[a-z]+\s*=/i);
        if (handler) {
            failures.push(`${page.file}: contiene un manejador de eventos en línea (línea ${lineOf(source, handler.index)})`);
        }
    }
    return failures;
}

function checkTagNesting(pages) {
    const failures = [];

    for (const page of pages.values()) {
        if (page.missing) continue;
        const stack = [];

        for (const tag of page.tags) {
            if (VOID_TAGS.has(tag.name) || tag.selfClosing) continue;

            if (tag.closing) {
                const open = stack.pop();
                if (!open) failures.push(`${page.file}:${tag.line}: </${tag.name}> sin etiqueta de apertura`);
                else if (open.name !== tag.name) {
                    failures.push(`${page.file}:${tag.line}: </${tag.name}> no cierra <${open.name}> (abierta en la línea ${open.line})`);
                }
            } else {
                stack.push(tag);
            }
        }

        for (const open of stack) {
            failures.push(`${page.file}: <${open.name}> abierta en la línea ${open.line} nunca se cierra`);
        }
    }
    return failures;
}

function checkInternalLinks(pages) {
    const failures = [];

    for (const page of pages.values()) {
        if (page.missing) continue;

        for (const anchor of openings(page.tags, 'a')) {
            const href = attributeValue(anchor, 'href');

            if (!href) {
                failures.push(`${page.file}:${anchor.line}: <a> sin href`);
                continue;
            }
            if (href === '#') {
                failures.push(`${page.file}:${anchor.line}: enlace placeholder href="#"`);
                continue;
            }
            if (/^(mailto:|https?:)/.test(href)) continue;
            if (!existsSync(join(ROOT, href))) {
                failures.push(`${page.file}:${anchor.line}: enlace interno roto -> ${href}`);
            }
        }
    }
    return failures;
}

function checkNavigation(pages) {
    const failures = [];

    for (const [file, expectedActive] of Object.entries(PAGES)) {
        const page = pages.get(file);
        if (!page || page.missing) continue;

        const header = sliceElement(page.html, '<header', '</header>');
        if (!header) {
            failures.push(`${file}: no se encontró el elemento <header>`);
            continue;
        }

        const nav = sliceElement(header, '<nav', '</nav>');
        if (!nav) {
            failures.push(`${file}: la cabecera no contiene un <nav>`);
            continue;
        }

        const navTag = openings(parseTags(nav), 'nav')[0];
        if (!navTag || !(attributeValue(navTag, 'aria-label') || '').trim()) {
            failures.push(`${file}: el <nav> de la cabecera necesita un aria-label`);
        }

        const anchors = openings(parseTags(nav), 'a');
        const hrefs = anchors.map((anchor) => attributeValue(anchor, 'href'));
        if (JSON.stringify(hrefs) !== JSON.stringify(NAV_ORDER)) {
            failures.push(`${file}: la navegación debe ser [${NAV_ORDER.join(', ')}] y es [${hrefs.join(', ')}]`);
        }

        const active = anchors.filter((anchor) => hasAttribute(anchor, 'aria-current'));
        if (active.length !== 1) {
            failures.push(`${file}: se esperaba un único enlace con aria-current y hay ${active.length}`);
        } else {
            const value = attributeValue(active[0], 'aria-current');
            const href = attributeValue(active[0], 'href');
            if (value !== 'page') failures.push(`${file}: aria-current debe valer "page" y vale "${value}"`);
            if (href !== expectedActive) {
                failures.push(`${file}: la página activa es "${href}" y debería ser "${expectedActive}"`);
            }
        }
    }
    return failures;
}

function checkFooterContract(pages) {
    const failures = [];

    for (const page of pages.values()) {
        if (page.missing) continue;

        const footer = sliceElement(page.html, '<footer', '</footer>');
        if (!footer) {
            failures.push(`${page.file}: no se encontró el elemento <footer>`);
            continue;
        }

        const anchors = openings(parseTags(footer), 'a');
        const hrefs = anchors.map((anchor) => attributeValue(anchor, 'href'));
        if (JSON.stringify(hrefs) !== JSON.stringify(FOOTER_LINKS)) {
            failures.push(`${page.file}: el pie debe contener [${FOOTER_LINKS.join(', ')}] y contiene [${hrefs.join(', ')}]`);
        }

        for (const anchor of anchors) {
            const href = attributeValue(anchor, 'href') || '';
            if (!/^https?:/.test(href)) continue;

            if (attributeValue(anchor, 'target') !== '_blank') {
                failures.push(`${page.file}: el enlace externo ${href} no abre en una pestaña nueva`);
            }
            const rel = attributeValue(anchor, 'rel') || '';
            if (!rel.includes('noopener') || !rel.includes('noreferrer')) {
                failures.push(`${page.file}: el enlace externo ${href} no declara rel="noopener noreferrer"`);
            }
        }
    }
    return failures;
}

function stripCssComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function checkSiteIdentity(pages) {
    const failures = [];

    for (const page of pages.values()) {
        if (page.missing) continue;

        const header = sliceElement(page.html, '<header', '</header>');
        if (!header) continue; // checkNavigation ya reporta la ausencia de cabecera

        const block = /<div class="site-title">\s*<a href="index\.html">([^<]*)<\/a>\s*<\/div>/.exec(header);
        if (!block) {
            failures.push(`${page.file}: .site-title debe ser un enlace a index.html`);
            continue;
        }

        const name = block[1].trim();
        if (name !== SITE_NAME) {
            failures.push(`${page.file}: el nombre del sitio debe ser "${SITE_NAME}" y es "${name}"`);
        }
    }

    return failures;
}

function checkDesignTokens() {
    const path = join(ROOT, STYLESHEET);
    if (!existsSync(path)) return [`${STYLESHEET}: no existe`];

    const failures = [];
    const css = readFileSync(path, 'utf8');
    /* Las comprobaciones de declaraciones se hacen sobre el código sin comentarios:
       un comentario que documente una regla no debe activar la regla. */
    const code = stripCssComments(css);

    for (const token of REQUIRED_TOKENS) {
        if (!new RegExp(`\\n\\s*${token}\\s*:`).test(code)) failures.push(`${STYLESHEET}: falta el token ${token}`);
    }

    const dark = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?)\n\}/.exec(code);
    if (!dark) failures.push(`${STYLESHEET}: falta el bloque @media (prefers-color-scheme: dark)`);
    else if (!/--color-bg\s*:/.test(dark[1])) failures.push(`${STYLESHEET}: el modo oscuro no redefine --color-bg`);

    if (/!important/.test(code)) failures.push(`${STYLESHEET}: contiene !important`);
    if (/(^|[\s,>])#[a-zA-Z][\w-]*\s*[,{]/.test(code)) failures.push(`${STYLESHEET}: contiene selectores de ID`);

    const breakpoints = code.match(/@media\s*\(max-width:\s*\d+px\)/g) || [];
    if (breakpoints.length !== 1) {
        failures.push(`${STYLESHEET}: se esperaba un único breakpoint responsive y hay ${breakpoints.length}`);
    }

    const declared = new Set([...code.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
    const used = new Set([...code.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]));
    for (const token of used) {
        if (!declared.has(token)) failures.push(`${STYLESHEET}: se usa ${token} sin declararlo en los tokens`);
    }

    return failures;
}

/* =============================================================================
 * Ejecución
 * ========================================================================== */

const CHECKS = [
    ['1. Existencia de las 9 páginas en la raíz', checkPagesExist],
    ['2. Esqueleto del documento (doctype, lang, meta y título)', checkDocumentShell],
    ['3. Capa de estilos externa única (sin CSS embebido ni en línea)', checkStyleLayer],
    ['4. Cero JavaScript', checkNoScripts],
    ['5. Anidamiento correcto de etiquetas', checkTagNesting],
    ['6. Enlaces internos resueltos (sin placeholders)', checkInternalLinks],
    ['7. Contrato de navegación (orden y aria-current)', checkNavigation],
    ['8. Contrato de pie de página (5 enlaces y rel seguro)', checkFooterContract],
    ['9. Contrato de identidad (nombre del sitio en la cabecera)', checkSiteIdentity],
    ['10. Tokens de diseño de la hoja única', checkDesignTokens]
];

function main() {
    const pages = new Map(Object.keys(PAGES).map((file) => [file, loadPage(file)]));
    let failed = 0;

    console.log(`validate-site — ${Object.keys(PAGES).length} páginas analizadas\n`);

    for (const [name, run] of CHECKS) {
        const failures = run(pages);
        if (failures.length === 0) {
            console.log(`PASS  ${name}`);
            continue;
        }
        failed += 1;
        console.log(`FAIL  ${name}`);
        for (const failure of failures) console.log(`      · ${failure}`);
    }

    console.log(failed === 0
        ? '\nRESULTADO GLOBAL: PASS'
        : `\nRESULTADO GLOBAL: FAIL (${failed} de ${CHECKS.length} comprobaciones)`);

    process.exit(failed === 0 ? 0 : 1);
}

main();




