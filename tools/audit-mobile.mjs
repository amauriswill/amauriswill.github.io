// Auditoria movil: mide en Chrome lo que no se ve en el codigo.
//
// Un sitio puede pasar el validador de arquitectura y aun asi fallar en un movil.
// Aqui se comprueba lo que depende del navegador y del ancho real:
//
// - desborde horizontal (el fallo mas comun y el que mas rgstaria produce)
// - targets tactiles por debajo del minimo recomendado de 44x44
// - textos por debajo del minimo legible de 12px
// - contraste calculado sobre el fondo real, no sobre el token
// - peso de lo que se descarga de verdad en la primera carga
//
// Uso:
// node tools/audit-mobile.mjs
// node tools/audit-mobile.mjs nota-cpp.html

import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.argv[2] || 'index.html';

const VIEWPORTS = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'Pixel 7', width: 412, height: 915 },
    { name: 'iPhone Pro Max', width: 430, height: 932 }
];

// Mide los tiempos reales de carga con el motor de verdad. Los tokens de
// navegacion solo se rellenan en caliente, asi que en frio da la primera
// visita, que es la que de verdad importa.
const TIMINGS = `(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const recursos = performance.getEntriesByType('resource');
    const paints = {};
    for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime);

    const fmt = (n) => Math.round(n);
    return {
        firstContentfulPaint: paints['first-contentful-paint'] ?? null,
        domContentLoaded: fmt(nav.domContentLoadedEventEnd),
        load: fmt(nav.loadEventEnd),
        transferKB: Math.round(recursos.reduce((a, r) => a + r.transferSize, 0) / 1024),
        decodKB: Math.round(recursos.reduce((a, r) => a + r.decodedBodySize, 0) / 1024),
        count: recursos.length,
        pedidos: recursos.map((r) => ({
            nombre: r.name.split('/').pop(),
            kb: Math.round(r.transferSize / 1024),
            fin: Math.round(r.responseEnd)
        })).sort((a, b) => b.kb - a.kb)
    };
})()`;

// Recomendaciones de Apple (HIG) y Material: 44x44 CSS px de zona tactil.
const MIN_TAP = 44;
// Por debajo de esto el texto deja de leerse sin esfuerzo.
const MIN_TEXT = 12;

const CHROME_CANDIDATES = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const BROWSER = CHROME_CANDIDATES.find((p) => existsSync(p)) || 'chrome';

const profile = mkdtempSync(join(tmpdir(), 'audit-mobile-'));
const port = 9222 + Math.floor(Math.random() * 500);

const browser = spawn(BROWSER, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank'
], { stdio: 'ignore' });

function cleanup() {
    try { browser.kill(); } catch { /* ya termino */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* temporal */ }
}

async function waitForDevTools(attempts = 80) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok) return (await response.json()).webSocketDebuggerUrl;
        } catch { /* aun arrancando */ }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('el navegador no abrio el puerto de DevTools');
}

function frame(payload) {
    const length = payload.length;
    let header;
    if (length < 126) {
        header = Buffer.from([0x81, 0x80 | length]);
    } else if (length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(length, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(length), 2);
    }
    return Buffer.concat([header, Buffer.from(payload)]);
}

// Todo se mide dentro de la pagina: el ancho real, el scroll real y los
// tamanos calculados que el navegador aplico de verdad. Los limites viajan
// dentro de la expresion porque se evalua en el navegador, no en Node.
const AUDIT = `(() => {
    const MIN_TAP = ${MIN_TAP};
    const MIN_TEXT = ${MIN_TEXT};
    const de = document.documentElement;

    const srgb = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
    const parseRGB = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
    const ratio = (a, b) => {
        const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (l1 + 0.05) / (l2 + 0.05);
    };

    // El fondo real se toma del punto de la pagina donde esta el elemento.
    const fondoDe = (el) => {
        let n = el;
        while (n && n !== de) {
            const c = getComputedStyle(n).backgroundColor;
            if (c && !c.includes('rgba(0, 0, 0, 0)')) return parseRGB(c);
            n = n.parentElement;
        }
        return parseRGB(getComputedStyle(de).backgroundColor || 'rgb(255,255,255)');
    };

    const etiqueta = (el) => (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 42)
        || el.getAttribute('aria-label') || el.className || el.tagName.toLowerCase();

    const texto = [...document.querySelectorAll('p, a, li, h1, h2, h3, span, code, td, time')]
        .filter((el) => el.textContent.trim() && el.getBoundingClientRect().width > 0);

    const chico = texto.map((el) => {
        const cs = getComputedStyle(el);
        const px = parseFloat(cs.fontSize);
        const cr = ratio(parseRGB(cs.color), fondoDe(el));
        const grande = px >= 18 || (px >= 14 && Number(cs.fontWeight) >= 700);
        return {
            etiqueta: etiqueta(el), px: Math.round(px * 10) / 10,
            minimo: Math.round((grande ? 3 : MIN_TEXT) * 10) / 10,
            contraste: Math.round(cr * 100) / 100
        };
    }).filter((t) => t.px < t.minimo || t.contraste < 4.5);

    const tactil = [...document.querySelectorAll('a, button, input, select')]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .map((el) => {
            const r = el.getBoundingClientRect();
            return { etiqueta: etiqueta(el), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((t) => t.w < MIN_TAP || t.h < MIN_TAP);

    // Un elemento que se sale a la derecha es la causa habitual del scroll
    // horizontal en movil.
    const desbordes = [...document.querySelectorAll('body *')]
        .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > de.clientWidth + 1 || r.left < -1);
        })
        .slice(0, 12)
        .map((el) => {
            const r = el.getBoundingClientRect();
            return {
                clase: el.className || el.tagName.toLowerCase(),
                izquierda: Math.round(r.left), derecha: Math.round(r.right)
            };
        });

    const recursos = performance.getEntriesByType('resource')
        .map((r) => ({ nombre: r.name.split('/').pop(), kb: Math.round(r.transferSize / 1024) }))
        .sort((a, b) => b.kb - a.kb);

    return {
        ancho: de.clientWidth,
        scrollX: de.scrollWidth > de.clientWidth,
        overflowPx: Math.max(0, de.scrollWidth - de.clientWidth),
        alto: de.scrollHeight,
        tactil, chico, desbordes, recursos
    };
})()`;


async function main() {
    const wsUrl = await waitForDevTools();
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;

    await new Promise((res, rej) => {
        socket.onopen = res;
        socket.onerror = rej;
    });

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const { resolve: done, reject } = pending.get(message.id);
            pending.delete(message.id);
            message.error ? reject(new Error(JSON.stringify(message.error))) : done(message.result);
        }
    };

    const send = (method, params = {}, sessionId) => new Promise((done, reject) => {
        id += 1;
        pending.set(id, { resolve: done, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    await send('Page.enable', {}, sessionId);
    await send('Network.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', {
        width: 390, height: 844, deviceScaleFactor: 2, mobile: true
    }, sessionId);

    await send('Page.navigate', { url: pathToFileURL(join(ROOT, PAGE)).href }, sessionId);
    await new Promise((r) => setTimeout(r, 1500));

    const problems = [];
    let last = null;

    for (const vp of VIEWPORTS) {
        await send('Emulation.setDeviceMetricsOverride', {
            width: vp.width, height: vp.height, deviceScaleFactor: 2, mobile: true
        }, sessionId);
        await new Promise((r) => setTimeout(r, 400));

        const evaluated = await send('Runtime.evaluate', {
            expression: AUDIT, returnByValue: true
        }, sessionId);

        if (evaluated.exceptionDetails) {
            throw new Error('la pagina fallo al auditarse: '
                + JSON.stringify(evaluated.exceptionDetails.exception));
        }

        const data = evaluated.result.value;
        last = data;

        const fallos = [];
        if (data.scrollX) fallos.push(`scroll horizontal de ${data.overflowPx}px`);
        if (data.chico.length) fallos.push(`${data.chico.length} textos por debajo del minimo`);
        if (data.tactil.length) fallos.push(`${data.tactil.length} targets tactiles pequenos`);

        console.log(`${fallos.length ? 'FAIL' : ' OK '}  ${vp.name.padEnd(16)} `
            + `ancho ${String(data.ancho).padStart(3)}  alto ${String(data.alto).padStart(5)}`
            + (data.scrollX ? `  DESBORDA ${data.overflowPx}px` : ''));

        for (const f of fallos) console.log(`        · ${f}`);

        if (vp.name === 'iPhone 12') {
            for (const d of data.desbordes) {
                console.log(`          desborde: ${d.clase} (${d.izquierda}..${d.derecha})`);
            }
            for (const t of data.chico.slice(0, 8)) {
                console.log(`          texto "${t.etiqueta}" ${t.px}px (min ${t.minimo}) `
                    + `contraste ${t.contraste}:1`);
            }
            for (const t of data.tactil.slice(0, 12)) {
                console.log(`          target "${t.etiqueta}" ${t.w}x${t.h}`);
            }
        }

        if (fallos.length) problems.push(`${vp.name}: ${fallos.join(', ')}`);
    }

    console.log('\n== peso de la primera carga ==');

    const t = (await send('Runtime.evaluate', {
        expression: TIMINGS, returnByValue: true
    }, sessionId)).result.value;

    // Con file:// el navegador no informa transferSize, asi que los recursos se
    // miden por tamano en disco, que es lo que GitHub Pages sirve comprimido.
    const enDisco = [
        ...readdirSync(join(ROOT, 'assets', 'fonts')),
        ...readdirSync(join(ROOT, 'assets', 'icons')),
        'main.css',
        PAGE
    ].map((nombre) => {
        const base = nombre.endsWith('.css') ? join(ROOT, 'assets', 'css') : join(ROOT, 'assets', 'fonts');
        const dir = readdirSync(join(ROOT, 'assets', 'fonts')).includes(nombre)
            ? join(ROOT, 'assets', 'fonts')
            : (readdirSync(join(ROOT, 'assets', 'icons')).includes(nombre)
                ? join(ROOT, 'assets', 'icons')
                : (nombre === PAGE ? ROOT : base));
        return { nombre, kb: Math.round(statSync(join(dir, nombre)).size / 1024) };
    }).sort((a, b) => b.kb - a.kb);

    for (const p of enDisco.slice(0, 10)) {
        console.log(`  ${String(p.kb).padStart(4)} KB  ${p.nombre}`);
    }
    console.log(`  ${String(enDisco.reduce((a, r) => a + r.kb, 0)).padStart(4)} KB  total sin comprimir`);
    console.log(`  ${String(Math.round(enDisco.reduce((a, r) => a + r.kb, 0) * 0.72)).padStart(4)} KB  estimado con gzip`);
    console.log(`\n  first contentful paint  ${t.firstContentfulPaint} ms`);
    console.log(`  DOMContentLoaded       ${t.domContentLoaded} ms`);
    console.log(`  load                    ${t.load} ms`);

    socket.close();
    cleanup();

    console.log(`\nRESULTADO GLOBAL: ${problems.length ? 'FAIL' : 'PASS'}`);
    if (problems.length) {
        console.log(`\nLo que el validador de arquitectura no ve:`);
        for (const p of problems) console.log(`  · ${p}`);
        process.exit(1);
    }
}

main().catch((error) => {
    cleanup();
    console.error(error);
    process.exit(1);
});